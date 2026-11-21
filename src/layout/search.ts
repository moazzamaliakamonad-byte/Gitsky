/**
 * File search. `paths` must already be lowercased (SkyModel.searchPaths).
 *
 * Ranking, best first:
 *   0  file name equals the query          index.ts
 *   1  file name starts with it            indexer.ts
 *   2  file name contains it               reindex.ts
 *   3  full path contains it               src/index/…
 * Ties: shallower paths first, then shorter, then path order.
 * A query containing "/" matches against the full path only.
 */
export function searchFiles(paths: string[], query: string, limit = 50): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pathMode = q.includes('/');
  const hits: { i: number; score: number; depth: number; len: number }[] = [];

  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    let score: number;
    if (pathMode) {
      if (!p.includes(q)) continue;
      score = 3;
    } else {
      const slash = p.lastIndexOf('/');
      const name = p.slice(slash + 1);
      if (name === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 2;
      else if (p.includes(q)) score = 3;
      else continue;
    }
    let depth = 0;
    for (let k = 0; k < p.length; k++) if (p.charCodeAt(k) === 47) depth++;
    hits.push({ i, score, depth, len: p.length });
  }

  hits.sort((a, b) => a.score - b.score || a.depth - b.depth || a.len - b.len || a.i - b.i);
  return hits.slice(0, limit).map((h) => h.i);
}

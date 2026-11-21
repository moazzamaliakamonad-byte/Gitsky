import type { SkyModel } from '../state/model';
import { LANGUAGES, OTHER } from './color';

/**
 * "Understand this repo in 30 seconds." Every number here is computed from the
 * snapshot, and anything based on commits says it's from the sample.
 */
export interface Insights {
  summary: string[];
  hottest: { index: number; count: number }[];
  largest: { index: number; bytes: number }[];
  languages: { id: number; name: string; color: string; bytes: number; share: number }[];
  quiet: { folder: number; files: number; bytes: number }[];
  contributors: { name: string; commits: number; files: number }[];
  /** The top-level folder most sampled commits touched. */
  busiest: { folder: number; commits: number } | null;
}

const TOP = 6;

const pct = (x: number) =>
  x >= 0.995 ? 'nearly all' : x < 0.01 ? 'under 1%' : `${Math.round(x * 100)}%`;

export function computeInsights(model: SkyModel): Insights {
  const { files, commits, meta } = model.data;
  const { tree } = model.layout;
  const counts = model.churn.counts;
  const n = files.length;

  const hottest = Array.from({ length: n }, (_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || (files[a].path < files[b].path ? -1 : 1))
    .slice(0, TOP)
    .map((index) => ({ index, count: counts[index] }));

  const largest = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => files[b].size - files[a].size || (files[a].path < files[b].path ? -1 : 1))
    .slice(0, TOP)
    .map((index) => ({ index, bytes: files[index].size }));

  // Languages by bytes.
  const bytesBy = new Float64Array(LANGUAGES.length);
  let totalBytes = 0;
  for (let i = 0; i < n; i++) {
    bytesBy[model.languageIds[i]] += files[i].size;
    totalBytes += files[i].size;
  }
  const langs = Array.from(bytesBy, (bytes, id) => ({ id, bytes }))
    .filter((l) => l.bytes > 0 && l.id !== OTHER.id)
    .sort((a, b) => b.bytes - a.bytes);
  const top = langs.slice(0, TOP);
  const rest = totalBytes - top.reduce((s, l) => s + l.bytes, 0);
  const languages = top.map((l) => ({
    id: l.id,
    name: LANGUAGES[l.id].name,
    color: LANGUAGES[l.id].color,
    bytes: l.bytes,
    share: totalBytes ? l.bytes / totalBytes : 0,
  }));
  if (rest > 0 && totalBytes > 0) {
    languages.push({
      id: OTHER.id,
      name: 'Other',
      color: OTHER.color,
      bytes: rest,
      share: rest / totalBytes,
    });
  }

  // Touched files per folder subtree.
  const F = tree.folders.length;
  const touched = new Uint32Array(F);
  for (let i = 0; i < n; i++) if (counts[i] > 0) touched[tree.fileFolder[i]]++;
  for (let f = F - 1; f > 0; f--) touched[tree.folders[f].parent] += touched[f];

  // Quiet zones: sizeable folders (depth 1–2) the sample never touched.
  const quiet: Insights['quiet'] = [];
  if (commits.length > 0) {
    const minFiles = Math.max(10, Math.round(n * 0.02));
    const candidates = tree.folders
      .filter(
        (f) => f.depth >= 1 && f.depth <= 2 && f.totalFiles >= minFiles && touched[f.index] === 0,
      )
      .sort((a, b) => b.totalFiles - a.totalFiles || a.index - b.index);
    for (const f of candidates) {
      if (quiet.length >= 4) break;
      if (quiet.some((q) => f.path.startsWith(`${tree.folders[q.folder].path}/`))) continue;
      quiet.push({ folder: f.index, files: f.totalFiles, bytes: f.totalBytes });
    }
  }

  // Contributors in the sample, and the top-level folder that drew the most commits.
  const byAuthor = new Map<string, { commits: number; files: Set<number> }>();
  const commitsPerTop = new Map<number, number>();
  const topOf = (folder: number) => {
    let f = folder;
    while (f > 0 && tree.folders[f].depth > 1) f = tree.folders[f].parent;
    return f;
  };
  for (const c of commits) {
    const a = byAuthor.get(c.author) ?? { commits: 0, files: new Set<number>() };
    a.commits++;
    for (const i of c.files) a.files.add(i);
    byAuthor.set(c.author, a);
    const tops = new Set(c.files.map((i) => topOf(tree.fileFolder[i])).filter((f) => f > 0));
    for (const t of tops) commitsPerTop.set(t, (commitsPerTop.get(t) ?? 0) + 1);
  }
  const contributors = [...byAuthor.entries()]
    .map(([name, v]) => ({ name, commits: v.commits, files: v.files.size }))
    .sort((a, b) => b.commits - a.commits || b.files - a.files || a.name.localeCompare(b.name))
    .slice(0, TOP);
  const busiestEntry = [...commitsPerTop.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const busiest = busiestEntry ? { folder: busiestEntry[0], commits: busiestEntry[1] } : null;

  // The plain-language summary.
  const summary: string[] = [];
  const lead = languages.filter((l) => l.id !== OTHER.id);
  if (lead.length > 0) {
    const second =
      lead[1] && lead[1].share >= 0.08 ? `, then ${lead[1].name} (${pct(lead[1].share)})` : '';
    summary.push(
      `${meta.fullName} is mostly ${lead[0].name}: ${pct(lead[0].share)} of its bytes${second}.`,
    );
  }
  const k = commits.length;
  if (k > 0 && busiest) {
    summary.push(
      `In the last ${k} sampled commits, work concentrated in ${tree.folders[busiest.folder].path}/ (${busiest.commits} of ${k}).`,
    );
  } else if (k === 0) {
    summary.push('No commits were sampled for this sky, so activity is not shown.');
  }
  if (quiet[0]) {
    const q = quiet[0];
    summary.push(
      `${tree.folders[q.folder].path}/ is the largest quiet area: ${q.files.toLocaleString()} files, none changed in the sample.`,
    );
  }
  if (contributors[0] && k > 1) {
    const c = contributors[0];
    summary.push(`${c.name} made ${c.commits} of those ${k} commits.`);
  }

  return { summary, hottest, largest, languages, quiet, contributors, busiest };
}

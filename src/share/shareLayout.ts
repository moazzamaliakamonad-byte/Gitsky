/** Pure helpers for the share card: links, text wrapping, stat lines. */

/** The deep link for a repo: this page's URL with only `?repo=owner/name[@branch]`. */
export function shareUrl(href: string, fullName: string, branch?: string): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('repo', branch ? `${fullName}@${branch}` : fullName);
  return url.toString();
}

/**
 * Greedy word wrap to `maxWidth`, at most `maxLines` lines; the last line gets an
 * ellipsis if text was cut. `measure` returns a string's width (canvas measureText in
 * the app, a fake in tests).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (s: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Split any single word that is wider than a line into line-sized pieces.
  const pieces: string[] = [];
  for (const w of words) {
    if (measure(w) <= maxWidth) {
      pieces.push(w);
      continue;
    }
    let chunk = '';
    for (const ch of w) {
      if (measure(chunk + ch) > maxWidth && chunk) {
        pieces.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    if (chunk) pieces.push(chunk);
  }

  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < pieces.length; i++) {
    const next = line ? `${line} ${pieces[i]}` : pieces[i];
    if (measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = pieces[i];
    if (lines.length === maxLines) break;
  }
  const cut = i < pieces.length;
  if (!cut && line) lines.push(line);

  if (lines.length > maxLines || cut) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** Stat pairs [value, label] for the card. Capped snapshots report the real file count. */
export function shareStats(s: {
  files: number;
  stars: number;
  commits: number;
  capped: number | null;
}): [string, string][] {
  const out: [string, string][] = [
    [fmt(s.capped ?? s.files), 'files'],
    [fmt(s.stars), 'GitHub stars'],
  ];
  if (s.commits > 0) out.push([String(s.commits), 'recent commits traced']);
  return out;
}

export function shareFileName(fullName: string): string {
  return `gitsky-${fullName.replace(/[^a-z0-9._-]+/gi, '-')}.png`;
}

/**
 * Language → star colour. See learn/concepts/color-and-perception.md.
 *
 * Rules we follow:
 * - Related languages share a hue family and differ in lightness (TS / TSX,
 *   C / C++ / headers, CSS / SCSS), so the sky reads as "regions", not confetti.
 * - Every colour is light enough to glow against near-black with additive
 *   blending, but none is pure white except docs, which should feel like starlight.
 * - Assets (images, fonts, binaries) are dim slate: present, but not competing.
 * - Our UI accent (amber) is reserved for interaction, so no language uses it exactly.
 */

export type Family =
  | 'web-ts'
  | 'web-js'
  | 'web-markup'
  | 'web-style'
  | 'web-component'
  | 'systems-c'
  | 'systems-go'
  | 'systems-rust'
  | 'systems-other'
  | 'jvm'
  | 'scripting'
  | 'shell'
  | 'docs'
  | 'config'
  | 'assets'
  | 'other';

export interface Language {
  id: number;
  name: string;
  color: string;
  family: Family;
}

type Def = [name: string, color: string, family: Family, exts: string[], names?: string[]];

const DEFS: Def[] = [
  ['TypeScript', '#5b9dff', 'web-ts', ['ts', 'mts', 'cts']],
  ['TSX', '#8fbcff', 'web-ts', ['tsx']],
  ['Type definitions', '#3f74c9', 'web-ts', ['d.ts']],
  ['JavaScript', '#f4d46b', 'web-js', ['js', 'mjs', 'cjs']],
  ['JSX', '#f8e5a3', 'web-js', ['jsx']],
  ['HTML', '#ff8f73', 'web-markup', ['html', 'htm']],
  ['CSS', '#d38cff', 'web-style', ['css']],
  ['SCSS / Less', '#e6b3ff', 'web-style', ['scss', 'sass', 'less', 'styl']],
  ['Vue', '#56d6a3', 'web-component', ['vue']],
  ['Svelte', '#ff7a5a', 'web-component', ['svelte']],
  ['Astro', '#ff9ec7', 'web-component', ['astro']],
  ['C', '#9fa6ff', 'systems-c', ['c']],
  ['C/C++ header', '#7f86e0', 'systems-c', ['h', 'hpp', 'hh', 'hxx']],
  ['C++', '#bb94ff', 'systems-c', ['cpp', 'cc', 'cxx', 'c++']],
  ['Objective-C', '#a7b8ff', 'systems-c', ['m', 'mm']],
  ['Go', '#52dbe3', 'systems-go', ['go']],
  ['Assembly', '#6fa5ad', 'systems-go', ['s', 'asm']],
  ['Rust', '#ff9d5c', 'systems-rust', ['rs']],
  ['Zig', '#ffc163', 'systems-rust', ['zig']],
  ['Swift', '#ff8a4c', 'systems-other', ['swift']],
  ['C#', '#93d65e', 'systems-other', ['cs']],
  ['Java', '#e6a15f', 'jvm', ['java']],
  ['Kotlin', '#b98aff', 'jvm', ['kt', 'kts']],
  ['Scala', '#ff6f7d', 'jvm', ['scala']],
  ['Python', '#7fdb8f', 'scripting', ['py', 'pyi', 'ipynb']],
  ['Ruby', '#ff6b81', 'scripting', ['rb', 'erb']],
  ['PHP', '#94a0ff', 'scripting', ['php']],
  ['Lua', '#7a8cff', 'scripting', ['lua']],
  ['Shell', '#aee36f', 'shell', ['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd']],
  ['Docker', '#4fc2e8', 'shell', [], ['dockerfile']],
  ['Make', '#c2d97a', 'shell', ['mk'], ['makefile', 'gnumakefile']],
  ['Markdown', '#eef1fb', 'docs', ['md', 'mdx', 'markdown', 'rst']],
  [
    'Text',
    '#c6cce0',
    'docs',
    ['txt', 'adoc'],
    [
      'license',
      'authors',
      'contributors',
      'notice',
      'patents',
      'readme',
      'changelog',
      'codeowners',
    ],
  ],
  ['JSON', '#8ea4c8', 'config', ['json', 'jsonc', 'json5']],
  [
    'YAML / TOML',
    '#a7b4d3',
    'config',
    [
      'yml',
      'yaml',
      'toml',
      'ini',
      'cfg',
      'conf',
      'lock',
      'xml',
      'plist',
      'properties',
      'env',
      'editorconfig',
      'gitignore',
      'gitattributes',
      'npmignore',
      'prettierrc',
      'eslintrc',
      'babelrc',
      'nvmrc',
      'mod',
      'sum',
      'snap',
    ],
  ],
  [
    'Assets',
    '#5f6b8f',
    'assets',
    [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'avif',
      'ico',
      'svg',
      'bmp',
      'woff',
      'woff2',
      'ttf',
      'otf',
      'eot',
      'mp4',
      'webm',
      'mp3',
      'wav',
      'pdf',
      'zip',
      'gz',
      'tgz',
      'wasm',
      'bin',
      'dat',
      'pem',
    ],
  ],
];

export const OTHER: Language = {
  id: DEFS.length,
  name: 'Other',
  color: '#7d86a8',
  family: 'other',
};

export const LANGUAGES: Language[] = [
  ...DEFS.map(([name, color, family], id) => ({ id, name, color, family })),
  OTHER,
];

const byExt = new Map<string, Language>();
const byName = new Map<string, Language>();
DEFS.forEach(([, , , exts, names], id) => {
  for (const e of exts) byExt.set(e, LANGUAGES[id]);
  for (const n of names ?? []) byName.set(n, LANGUAGES[id]);
});

export function languageOf(path: string): Language {
  const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const named = byName.get(base);
  if (named) return named;
  if (base.endsWith('.d.ts')) return byExt.get('d.ts')!;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return OTHER;
  // ".gitignore" style: the "extension" is the whole name after the dot
  return byExt.get(base.slice(dot + 1)) ?? OTHER;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const rgbCache = LANGUAGES.map((l) => hexToRgb(l.color));

/** Per-file language ids and linear RGB colours for the GPU. */
export function colorsFor(files: { path: string }[]): {
  languageIds: Uint8Array;
  colors: Float32Array;
} {
  const languageIds = new Uint8Array(files.length);
  const colors = new Float32Array(files.length * 3);
  for (let i = 0; i < files.length; i++) {
    const id = languageOf(files[i].path).id;
    languageIds[i] = id;
    const c = rgbCache[id];
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  return { languageIds, colors };
}

export interface LegendItem {
  id: number;
  name: string;
  color: string;
  count: number;
}

/** Top languages by file count; the rest are grouped into "Other". */
export function legendFor(files: { path: string }[], max = 8): LegendItem[] {
  const counts = new Map<number, number>();
  for (const f of files) {
    const id = languageOf(f.path).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .map(([id, count]) => ({ id, name: LANGUAGES[id].name, color: LANGUAGES[id].color, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const top = sorted.filter((l) => l.id !== OTHER.id).slice(0, max);
  const rest = files.length - top.reduce((s, l) => s + l.count, 0);
  if (rest > 0) top.push({ id: OTHER.id, name: OTHER.name, color: OTHER.color, count: rest });
  return top;
}

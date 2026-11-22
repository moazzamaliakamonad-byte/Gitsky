/**
 * A file's outline: its top-level functions, classes, types, constants, Markdown
 * headings or config keys, each with the lines it spans. These become the planets that
 * orbit a selected file's star, and the clickable outline in the code panel.
 *
 * Deliberately simple: line-based patterns per language, top level only (no indentation),
 * so it's fast, never throws, and is easy to read. Unknown languages get no outline.
 */
export type SymbolKind = 'function' | 'class' | 'type' | 'const' | 'heading' | 'key';

export interface FileSymbol {
  name: string;
  kind: SymbolKind;
  /** 1-based first line. */
  line: number;
  /** 1-based last line: up to the line before the next symbol (or the end of the file). */
  endLine: number;
  /** Heading level (1–3) for Markdown; 0 otherwise. */
  level: number;
}

export const MAX_SYMBOLS = 120;

type Rule = [RegExp, SymbolKind];

const JS: Rule[] = [
  [/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, 'function'],
  [/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
  [/^(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/, 'type'],
  [
    /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
    'function',
  ],
  [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/, 'const'],
];
const PY: Rule[] = [
  [/^(?:async\s+)?def\s+([A-Za-z_]\w*)/, 'function'],
  [/^class\s+([A-Za-z_]\w*)/, 'class'],
  [/^([A-Z][A-Z0-9_]*)\s*=/, 'const'],
];
const GO: Rule[] = [
  [/^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, 'function'],
  [/^type\s+([A-Za-z_]\w*)/, 'type'],
  [/^(?:const|var)\s+([A-Za-z_]\w*)/, 'const'],
];
const RUST: Rule[] = [
  [/^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/, 'function'],
  [/^(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union)\s+([A-Za-z_]\w*)/, 'type'],
  [/^(impl(?:<[^>]*>)?\s+[A-Za-z_][\w:<>, ]*)/, 'type'],
  [/^(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+([A-Za-z_]\w*)/, 'const'],
];
const JVM: Rule[] = [
  [
    /^(?:public\s+|private\s+|protected\s+|internal\s+)?(?:abstract\s+|final\s+|sealed\s+|data\s+|open\s+)*(?:class|interface|enum|record|object)\s+([A-Za-z_]\w*)/,
    'class',
  ],
  [/^(?:public\s+|private\s+|internal\s+)?fun\s+(?:<[^>]*>\s*)?([A-Za-z_]\w*)/, 'function'],
];
const C: Rule[] = [
  [/^(?:typedef\s+)?(?:struct|enum|union|class|namespace)\s+([A-Za-z_]\w*)/, 'type'],
  [
    /^(?!if\b|for\b|while\b|switch\b|return\b)[A-Za-z_][\w\s*&:<>,]*?\b([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?\{?\s*$/,
    'function',
  ],
  [/^#define\s+([A-Za-z_]\w*)/, 'const'],
];
const RUBY: Rule[] = [
  [/^def\s+([A-Za-z_][\w?!]*)/, 'function'],
  [/^(?:class|module)\s+([A-Z][\w:]*)/, 'class'],
];
const SHELL: Rule[] = [[/^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{?/, 'function']];
const CSS: Rule[] = [[/^([^\s@/{}][^{]*?)\s*\{/, 'class']];

function extOf(path: string) {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  if (name.endsWith('.d.ts')) return 'ts';
  return name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
}

const RULES: Record<string, Rule[]> = {
  ts: JS,
  tsx: JS,
  mts: JS,
  cts: JS,
  js: JS,
  jsx: JS,
  mjs: JS,
  cjs: JS,
  vue: JS,
  svelte: JS,
  py: PY,
  pyi: PY,
  go: GO,
  rs: RUST,
  java: JVM,
  kt: JVM,
  kts: JVM,
  scala: JVM,
  cs: JVM,
  swift: JVM,
  c: C,
  h: C,
  cc: C,
  cpp: C,
  cxx: C,
  hpp: C,
  m: C,
  mm: C,
  rb: RUBY,
  sh: SHELL,
  bash: SHELL,
  zsh: SHELL,
  css: CSS,
  scss: CSS,
  less: CSS,
};

function finish(out: FileSymbol[], lineCount: number) {
  for (let i = 0; i < out.length; i++) {
    out[i].endLine = Math.max(out[i].line, (out[i + 1]?.line ?? lineCount + 1) - 1);
  }
  return out.slice(0, MAX_SYMBOLS);
}

function markdown(lines: string[]): FileSymbol[] {
  const out: FileSymbol[] = [];
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
    if (fenced) return;
    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) out.push({ name: m[2], kind: 'heading', line: i + 1, endLine: 0, level: m[1].length });
  });
  return out;
}

function jsonKeys(text: string): FileSymbol[] {
  // Top-level keys sit at the first indentation level inside the outer object.
  const out: FileSymbol[] = [];
  let depth = 0;
  let inString = false;
  let line = 1;
  let keyStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') line++;
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') {
        inString = false;
        if (depth === 1 && keyStart >= 0) {
          const rest = text.slice(i + 1).match(/^\s*:/);
          if (rest)
            out.push({ name: text.slice(keyStart, i), kind: 'key', line, endLine: 0, level: 0 });
        }
        keyStart = -1;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      keyStart = i + 1;
    } else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return out;
}

function yamlKeys(lines: string[], toml: boolean): FileSymbol[] {
  const out: FileSymbol[] = [];
  lines.forEach((l, i) => {
    const m = toml
      ? /^\[([^\]]+)\]/.exec(l) || /^([A-Za-z_][\w.-]*)\s*=/.exec(l)
      : /^([A-Za-z_"'][\w"' .-]*?):(\s|$)/.exec(l);
    if (m)
      out.push({ name: m[1].replace(/["']/g, ''), kind: 'key', line: i + 1, endLine: 0, level: 0 });
  });
  return out;
}

export function outlineOf(path: string, text: string): FileSymbol[] {
  const ext = extOf(path);
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop(); // trailing newline
  if (['md', 'mdx', 'markdown'].includes(ext)) return finish(markdown(lines), lines.length);
  if (['json', 'jsonc', 'json5'].includes(ext)) return finish(jsonKeys(text), lines.length);
  if (['yml', 'yaml'].includes(ext)) return finish(yamlKeys(lines, false), lines.length);
  if (ext === 'toml') return finish(yamlKeys(lines, true), lines.length);
  const rules = RULES[ext];
  if (!rules) return [];
  const out: FileSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l || /^\s/.test(l)) continue; // top level only
    for (const [re, kind] of rules) {
      const m = re.exec(l);
      if (m) {
        out.push({ name: m[1].trim(), kind, line: i + 1, endLine: 0, level: 0 });
        break;
      }
    }
  }
  return finish(out, lines.length);
}

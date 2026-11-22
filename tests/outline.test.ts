import { describe, expect, it } from 'vitest';
import { outlineOf } from '../src/layout/outline';

const names = (path: string, text: string) =>
  outlineOf(path, text).map((s) => `${s.kind}:${s.name}`);

describe('outlineOf', () => {
  it('finds top-level TypeScript declarations, not nested ones', () => {
    const ts = [
      "import x from 'y';",
      'export function parseRepo(input: string) {',
      '  function inner() {}',
      '  return 1;',
      '}',
      'export default async function main() {}',
      'export class Store {',
      '  method() {}',
      '}',
      'interface Props { a: number }',
      'export type Mode = "a" | "b";',
      'export enum Kind { A }',
      'export const LIMIT = 60;',
      'const helper = (a: number) => a * 2;',
    ].join('\n');
    expect(names('src/a.ts', ts)).toEqual([
      'function:parseRepo',
      'function:main',
      'class:Store',
      'type:Props',
      'type:Mode',
      'type:Kind',
      'const:LIMIT',
      'function:helper',
    ]);
  });

  it('gives each symbol its line span, up to the next symbol', () => {
    const ts = 'export function a() {\n  return 1;\n}\n\nexport function b() {}\n';
    const out = outlineOf('x.ts', ts);
    expect(out[0]).toMatchObject({ name: 'a', line: 1, endLine: 4 });
    expect(out[1]).toMatchObject({ name: 'b', line: 5, endLine: 5 });
  });

  it('reads Python, Go and Rust', () => {
    expect(
      names(
        'm.py',
        'import os\n\nclass Repo:\n    def load(self):\n        pass\n\ndef main():\n    pass\n',
      ),
    ).toEqual(['class:Repo', 'function:main']);
    expect(
      names(
        'm.go',
        'package x\n\ntype Tree struct{}\n\nfunc (t *Tree) Walk() {}\n\nfunc New() *Tree {}\n',
      ),
    ).toEqual(['type:Tree', 'function:Walk', 'function:New']);
    expect(
      names('lib.rs', 'pub struct Sky;\nimpl Sky {\n    pub fn new() {}\n}\npub fn render() {}\n'),
    ).toEqual(['type:Sky', 'type:impl Sky', 'function:render']);
  });

  it('turns Markdown headings into an outline', () => {
    expect(
      names('README.md', '# Gitsky\ntext\n## Features\n### Deep\n```\n# not a heading\n```\n'),
    ).toEqual(['heading:Gitsky', 'heading:Features', 'heading:Deep']);
  });

  it('lists top-level keys of JSON and YAML', () => {
    expect(
      names('package.json', '{\n  "name": "x",\n  "scripts": {\n    "dev": "vite"\n  }\n}\n'),
    ).toEqual(['key:name', 'key:scripts']);
    expect(names('ci.yml', 'name: CI\non:\n  push:\njobs:\n  build:\n')).toEqual([
      'key:name',
      'key:on',
      'key:jobs',
    ]);
  });

  it('returns nothing for languages it does not know, and caps huge outlines', () => {
    expect(outlineOf('photo.png', 'binary')).toEqual([]);
    const many = Array.from({ length: 500 }, (_, i) => `export const c${i} = ${i};`).join('\n');
    expect(outlineOf('x.ts', many).length).toBeLessThanOrEqual(120);
  });
});

describe('layoutFileOrbit', () => {
  it('gives each symbol an orbit: first innermost, bigger symbols bigger, Kepler speeds', async () => {
    const { layoutFileOrbit } = await import('../src/layout/fileOrbit');
    const out = outlineOf(
      'a.ts',
      'export function small() {}\nexport class Big {\n' +
        '  x = 1;\n'.repeat(200) +
        '}\nexport const z = 1;\n',
    );
    const orbits = layoutFileOrbit(out, 7);
    expect(orbits).toHaveLength(3);
    expect(orbits[1].orbit).toBeGreaterThan(orbits[0].orbit);
    expect(orbits[2].orbit).toBeGreaterThan(orbits[1].orbit);
    expect(orbits[1].radius).toBeGreaterThan(orbits[0].radius);
    expect(orbits[2].speed).toBeLessThan(orbits[0].speed);
    expect(layoutFileOrbit(out, 7)).toEqual(orbits);
  });
});

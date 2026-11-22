import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { precacheList } from './precache';

function walk(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p).split(sep).join('/')];
  });
}

/**
 * Writes dist/sw.js: the template with this build's precache list baked in. The version
 * is a hash of the list (asset names carry content hashes), so every deploy that changes
 * the app installs a fresh copy and clears the old one.
 */
export function serviceWorker(root: string): Plugin {
  return {
    name: 'gitsky-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const list = precacheList(Object.keys(bundle), walk(join(root, 'public')));
      const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(join(root, 'build', 'sw.template.js'), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(list));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

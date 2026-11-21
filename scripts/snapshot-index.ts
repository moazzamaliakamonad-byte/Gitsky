/**
 * Rebuild public/snapshots/index.json from the snapshot files already on disk.
 * Costs zero API calls: use it after changing what the index carries.
 *
 *   npm run snapshot:index
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSnapshot } from '../src/data/snapshot';
import type { BundledEntry } from '../src/data/types';
import { spectrumOf } from '../src/layout/color';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'snapshots');

async function main() {
  const indexPath = join(dir, 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as BundledEntry[];
  const next: BundledEntry[] = [];
  for (const e of index) {
    const data = decodeSnapshot(JSON.parse(await readFile(join(dir, e.file), 'utf8')));
    next.push({
      ...e,
      fileCount: data.files.length,
      commitCount: data.commits.length,
      spectrum: spectrumOf(data.files),
    });
    console.log(`${e.fullName}: ${data.files.length} files, ${data.commits.length} commits`);
  }
  await writeFile(indexPath, JSON.stringify(next, null, 2) + '\n');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

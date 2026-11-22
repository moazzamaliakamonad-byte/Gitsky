/**
 * Prebuild deep-time histories for featured skies, so visitors get them without spending
 * any GitHub requests. Writes public/snapshots/<repo>.deep.json and marks the index.
 *
 *   npm run snapshot:deep -- pmndrs/zustand vitejs/vite
 *
 * Each costs about 25 requests (a little more for capped skies). Set GITHUB_TOKEN to do
 * several at once.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestBudget } from '../src/data/budget';
import { fetchDeepHistory } from '../src/data/deepFetch';
import { deepFileOf, encodeHistory } from '../src/data/deepTime';
import { createGitHubClient } from '../src/data/github';
import { decodeSnapshot } from '../src/data/snapshot';
import type { BundledEntry } from '../src/data/types';
import { patientFetch } from './patientFetch';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'snapshots');
/** Featured skies get a few more moments than live ones: smoother, and paid once. */
const EPOCHS = 12;

async function main() {
  const repos = process.argv.slice(2);
  if (repos.length === 0) {
    console.error('usage: npm run snapshot:deep -- owner/repo ...');
    process.exit(1);
  }
  const indexPath = join(dir, 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as BundledEntry[];
  const budget = new RequestBudget({}, 1);
  const client = createGitHubClient({
    budget,
    token: process.env.GITHUB_TOKEN,
    fetchImpl: patientFetch,
  });

  for (const name of repos) {
    const entry = index.find((e) => e.fullName.toLowerCase() === name.toLowerCase());
    if (!entry) throw new Error(`${name} is not a featured sky (see snapshots/index.json)`);
    const rate = await client.rateLimit();
    console.log(`\n${entry.fullName}: ${rate.remaining}/${rate.limit} requests left`);
    const data = decodeSnapshot(JSON.parse(await readFile(join(dir, entry.file), 'utf8')));
    const h = await fetchDeepHistory(data, {
      client,
      budget,
      maxEpochs: EPOCHS,
      onProgress: (done, total) => process.stdout.write(`  ${done}/${total}\n`),
    });
    const json = JSON.stringify(encodeHistory(h));
    await writeFile(join(dir, deepFileOf(entry)), json);
    entry.deep = true;
    await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
    console.log(
      `  saved ${deepFileOf(entry)}: ${h.epochs.length} moments over ${h.totalCommits} commits, ` +
        `${h.ghosts.length} ghosts, ${(json.length / 1024).toFixed(0)} KB`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

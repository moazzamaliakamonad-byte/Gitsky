/**
 * Fetch repos through the same pipeline the browser uses and save compact JSON
 * snapshots into public/snapshots/.
 *
 *   npm run snapshot -- facebook/react golang/go
 *   npm run snapshot -- --max-files 12000 --samples 25 owner/repo
 *
 * Set GITHUB_TOKEN to sample more commits. Without it the script splits the
 * remaining hourly budget evenly across the repos you ask for.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestBudget } from '../src/data/budget';
import type { BundledEntry } from '../src/data/types';
import { createGitHubClient } from '../src/data/github';
import { parseRepoInput } from '../src/data/parseRepoInput';
import { loadRepoFromApi } from '../src/data/pipeline';
import { encodeSnapshot } from '../src/data/snapshot';

const BLURBS: Record<string, string> = {
  'facebook/react': 'a frontend framework',
  'react/react': 'a frontend framework',
  'golang/go': 'a compiler and runtime',
  'pmndrs/zustand': 'a tiny library',
  'vitejs/vite': 'a monorepo',
  'pytorch/pytorch': 'a deep learning framework',
  'huggingface/transformers': 'a library of AI models',
  'python/cpython': 'a programming language',
  'ollama/ollama': 'local AI models',
  'karpathy/nanogpt': 'a GPT in one file',
  'langchain-ai/langchain': 'an AI agent framework',
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'snapshots');

function args() {
  const argv = process.argv.slice(2);
  let maxFiles = 12000;
  let samples: number | null = null;
  const repos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-files') maxFiles = Number(argv[++i]);
    else if (argv[i] === '--samples') samples = Number(argv[++i]);
    else repos.push(argv[i]);
  }
  return { maxFiles, samples, repos };
}

/**
 * On a slow or flaky connection a request can drop mid-way. These are read-only GETs,
 * so retrying is safe: up to five tries, waiting a little longer each time.
 */
async function patientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(input, init);
      // Read the body now, so a connection that drops mid-download is retried too.
      const body = await res.arrayBuffer();
      return new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch (e) {
      if (attempt >= 5) throw e;
      console.log(`  connection dropped, retrying (${attempt}/4)`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function main() {
  const { maxFiles, samples, repos } = args();
  if (repos.length === 0) {
    console.error('usage: npm run snapshot -- [--max-files N] [--samples N] owner/repo ...');
    process.exit(1);
  }
  const token = process.env.GITHUB_TOKEN;
  const budget = new RequestBudget({}, 1);
  const client = createGitHubClient({ budget, token, fetchImpl: patientFetch });
  const rate = await client.rateLimit();
  console.log(
    `rate limit: ${rate.remaining}/${rate.limit}, resets ${new Date(rate.resetAt).toLocaleTimeString()}`,
  );

  await mkdir(outDir, { recursive: true });
  const indexPath = join(outDir, 'index.json');
  let index: BundledEntry[] = [];
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8')) as BundledEntry[];
  } catch {
    // first run
  }

  for (let i = 0; i < repos.length; i++) {
    const parsed = parseRepoInput(repos[i]);
    if (!parsed.ok) throw new Error(`${repos[i]}: ${parsed.error}`);
    const left = repos.length - i;
    // Split what's left: 3 base calls per repo, the rest on commit details.
    const fair = Math.floor((budget.available() - 3 * left) / left);
    const desired = Math.max(0, Math.min(samples ?? (token ? 300 : 25), fair));
    console.log(`\n${repos[i]}: sampling up to ${desired} commits`);

    const data = await loadRepoFromApi(parsed.ref, {
      client,
      budget,
      desiredSamples: desired,
      maxFiles,
      onProgress: (p) => {
        if (p.step === 'details' && p.done === p.total)
          process.stdout.write(`  details ${p.done}/${p.total}\n`);
        else if (p.step !== 'details') process.stdout.write(`  ${p.step}\n`);
      },
    });
    const file = `${data.meta.owner}__${data.meta.repo}.json`.toLowerCase();
    const json = JSON.stringify(encodeSnapshot(data));
    await writeFile(join(outDir, file), json);
    const entry: BundledEntry = {
      fullName: data.meta.fullName,
      file,
      blurb: BLURBS[data.meta.fullName.toLowerCase()] ?? data.meta.description ?? '',
      fileCount: data.files.length,
    };
    index = [
      ...index.filter((e) => e.fullName.toLowerCase() !== entry.fullName.toLowerCase()),
      entry,
    ];
    console.log(
      `  saved ${file}: ${data.files.length} files${data.capped ? ` (capped from ${data.capped.originalFileCount})` : ''}, ` +
        `${data.commits.length} commits, ${(json.length / 1024).toFixed(0)} KB, truncated=${data.truncated}`,
    );
  }

  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
  console.log(`\nbudget left: ${budget.state.remaining}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

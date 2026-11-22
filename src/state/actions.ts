import { findBundled, listBundled, loadBundled } from '../data/bundled';
import { GitHubError } from '../data/github';
import { loadRepo } from '../data/loadRepo';
import { parseRepoInput } from '../data/parseRepoInput';
import { getToken } from '../data/token';
import type { BundledEntry, RepoRef } from '../data/types';
import { syntheticRepo } from '../data/synthetic';
import { repoParam } from '../share/shareLayout';
import { buildModel } from './model';
import { useStore, type AppError } from './store';

let current: AbortController | null = null;

function begin(label: string): AbortSignal {
  current?.abort();
  current = new AbortController();
  useStore.getState().set({ status: 'loading', loadingRepo: label, error: null, progress: null });
  return current.signal;
}

/** Put ?repo=owner/name (and ?vs= in a collision) in the address bar: a shareable link. */
export function setRepoParam(fullName: string | null, vs?: string | null) {
  const url = new URL(window.location.href);
  url.search = fullName ? `?repo=${repoParam(fullName)}${vs ? `&vs=${repoParam(vs)}` : ''}` : '';
  window.history.replaceState(null, '', url);
}

/**
 * Load a repo into a model without putting it on screen (the second galaxy of a
 * collision). Bundled skies cost no API calls; live ones use the normal pipeline.
 */
export async function loadModel(ref: RepoRef, signal: AbortSignal) {
  const fullName = `${ref.owner}/${ref.repo}`;
  const snap = !ref.branch ? findBundled(useStore.getState().bundled, fullName) : undefined;
  if (snap) return buildModel(await loadBundled(snap), 'bundled');
  const result = await loadRepo(ref, {
    token: getToken(),
    signal,
    onProgress: (progress) => {
      if (!signal.aborted) useStore.getState().set({ progress });
    },
  });
  return buildModel(result.data, result.source);
}

/** Begin a cancellable load with the loading veil (shared with collisions). */
export function beginLoad(label: string): AbortSignal {
  return begin(label);
}

export { fail as failLoad };

export async function openBundled(entry: BundledEntry, opts: { updateUrl?: boolean } = {}) {
  const signal = begin(entry.fullName);
  try {
    const data = await loadBundled(entry);
    if (signal.aborted) return;
    useStore.getState().setModel(buildModel(data, 'bundled'));
    if (opts.updateUrl !== false) setRepoParam(entry.fullName);
  } catch {
    if (signal.aborted) return;
    fail({
      kind: 'snapshot',
      title: "Couldn't open the bundled sky",
      message: 'The snapshot file failed to load. Check your connection and reload the page.',
    });
  }
}

export async function openRepoInput(input: string): Promise<boolean> {
  const parsed = parseRepoInput(input);
  if (!parsed.ok) {
    useStore.getState().set({
      error: { kind: 'parse', title: 'That doesn’t look like a repo', message: parsed.error },
    });
    return false;
  }
  await openRepo(parsed.ref);
  return true;
}

export async function openRepo(ref: RepoRef, opts: { refresh?: boolean } = {}) {
  const fullName = `${ref.owner}/${ref.repo}`;
  const { bundled } = useStore.getState();
  const snap = !opts.refresh && !ref.branch ? findBundled(bundled, fullName) : undefined;
  if (snap) {
    await openBundled(snap);
    return;
  }

  const signal = begin(fullName);
  try {
    const result = await loadRepo(ref, {
      token: getToken(),
      signal,
      refresh: opts.refresh,
      onProgress: (progress) => {
        if (!signal.aborted) useStore.getState().set({ progress });
      },
    });
    if (signal.aborted) return;
    const model = buildModel(result.data, result.source);
    useStore.getState().setModel(model);
    setRepoParam(result.data.meta.fullName + (ref.branch ? `@${ref.branch}` : ''));
    if (result.source === 'stale-cache') {
      useStore
        .getState()
        .set({ notice: 'GitHub is unreachable right now, so this is a saved copy.' });
    } else if (result.data.truncated) {
      useStore.getState().set({
        notice:
          'This repo is so large that GitHub returned only part of its file tree. Some files are missing.',
      });
    }
  } catch (e) {
    if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
    fail(toAppError(e, fullName));
  }
}

export function toAppError(e: unknown, repo: string): AppError {
  if (e instanceof GitHubError) {
    switch (e.kind) {
      case 'not_found':
        return {
          kind: e.kind,
          repo,
          title: 'No public repo by that name',
          message: `GitHub has no public repository called ${repo}. Check the spelling. Private repos can't be charted.`,
        };
      case 'rate_limited':
        return {
          kind: e.kind,
          repo,
          resetAt: e.resetAt,
          title: 'Out of GitHub requests for now',
          message:
            'Without a token, GitHub allows 60 requests an hour from your network. Add a token to keep going, or wait for the reset.',
        };
      case 'bad_token':
        return {
          kind: e.kind,
          repo,
          title: 'GitHub rejected your token',
          message: 'The token may be expired or mistyped. Remove it or paste a new one.',
        };
      case 'empty':
        return {
          kind: e.kind,
          repo,
          title: 'This sky is empty',
          message: `${repo} has no commits yet, so there are no files to chart.`,
        };
      case 'network':
        return {
          kind: e.kind,
          repo,
          title: 'Can’t reach GitHub',
          message:
            'You seem to be offline, or GitHub is unreachable. The bundled skies still work.',
        };
      default:
        return { kind: e.kind, repo, title: 'GitHub returned an error', message: e.message };
    }
  }
  return {
    kind: 'http',
    repo,
    title: 'Something went wrong',
    message: e instanceof Error ? e.message : 'An unexpected error occurred.',
  };
}

function fail(error: AppError) {
  // Keep the previous sky on screen behind the error, so the page never goes blank.
  const { model } = useStore.getState();
  useStore
    .getState()
    .set({ status: model ? 'ready' : 'error', error, loadingRepo: null, progress: null });
}

/** First load: show a bundled sky immediately, then honour ?repo= if present. */
export async function boot() {
  let bundled: BundledEntry[] = [];
  try {
    bundled = await listBundled();
  } catch {
    // Without the index we can still load a live repo from ?repo=.
  }
  useStore.getState().set({ bundled, hasToken: Boolean(getToken()) });

  // Performance testing: ?stress=50000 draws a clearly labelled synthetic sky.
  const stress = Number(new URLSearchParams(window.location.search).get('stress'));
  if (Number.isFinite(stress) && stress > 0) {
    const n = Math.min(Math.round(stress), 200_000);
    useStore.getState().set({ heroOpen: false });
    useStore.getState().setModel(buildModel(syntheticRepo(n), 'synthetic'));
    useStore.getState().set({
      notice: `Synthetic stress test: ${n.toLocaleString()} generated files, not a real repo.`,
    });
    return;
  }

  const param = new URLSearchParams(window.location.search).get('repo');
  const [repoPart, branch] = (param ?? '').split('@');
  const parsed = param ? parseRepoInput(repoPart) : null;

  if (parsed?.ok) {
    useStore.getState().set({ heroOpen: false });
    const ref = branch ? { ...parsed.ref, branch } : parsed.ref;
    const snap = !branch ? findBundled(bundled, `${ref.owner}/${ref.repo}`) : undefined;
    if (snap) await openBundled(snap, { updateUrl: false });
    else {
      // Draw something beautiful right away while the real repo loads.
      if (bundled[0]) await openBundled(bundled[0], { updateUrl: false });
      await openRepo(ref);
    }
    // ?vs=owner/name: collide with a second repo.
    const vs = new URLSearchParams(window.location.search).get('vs');
    if (vs && useStore.getState().model) {
      const { startCollision } = await import('./collisionActions');
      await startCollision(vs);
    }
    return;
  }
  if (bundled[0]) return openBundled(bundled[0], { updateUrl: false });
  fail({
    kind: 'snapshot',
    title: 'Nothing to show yet',
    message: 'Paste a GitHub repo above to chart its sky.',
  });
}

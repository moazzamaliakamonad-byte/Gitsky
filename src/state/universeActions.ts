import { expandRepo, expandUser, type ExpandContext, type Expansion } from '../data/universeData';
import { getToken } from '../data/token';
import {
  emptyGraph,
  graphToUniverse,
  layoutGraph,
  mergeGraph,
  type GraphPatch,
  type GRepo,
  type UGraph,
} from '../layout/universeGraph';
import { controlsRef } from '../render/sceneRefs';
import { openRepoInput, toAppError } from './actions';
import { useStore, type UniverseState } from './store';

let current: AbortController | null = null;

function setU(patch: Partial<UniverseState>) {
  const u = useStore.getState().universe;
  if (u) useStore.getState().set({ universe: { ...u, ...patch } });
}

function context(ctrl: AbortController): ExpandContext {
  return {
    token: getToken(),
    signal: ctrl.signal,
    onProgress: (done, total) => {
      if (!ctrl.signal.aborted) setU({ done, total });
    },
  };
}

/** Say plainly when the request budget cut an expansion short. */
function reportMissing(x: Expansion) {
  // Kept on the universe panel (a toast would vanish) and announced once as a notice.
  setU({ missing: x.missing, resetAt: x.resetAt });
  if (x.missing <= 0) return;
  useStore.getState().set({
    notice: `GitHub's hourly request limit ran out, so ${x.missing} ${x.missing === 1 ? 'branch' : 'branches'} of this universe couldn't be loaded.`,
  });
}

/** Merge a patch, re-run the layout (warm-started), and publish the new view. */
function apply(g: UGraph, patch: GraphPatch) {
  const u = useStore.getState().universe;
  const graph = mergeGraph(g, patch);
  const layout = layoutGraph(graph, u?.layout, u?.layout ? 160 : 260);
  const data = graphToUniverse(graph, layout, Date.now());
  return { graph, layout, data };
}

function begin(label: string) {
  current?.abort();
  const ctrl = new AbortController();
  current = ctrl;
  useStore.getState().set({
    universe: {
      status: 'loading',
      done: 0,
      total: 0,
      label,
      focus: null,
      busy: true,
      languages: null,
    },
    selection: null,
    highlight: null,
    system: null,
    collision: null,
    panel: 'none',
    hovered: -1,
    heroOpen: false,
  });
  return ctrl;
}

/** The universe around the current repo: its contributors and their projects. */
export async function openUniverse() {
  const { model, universe } = useStore.getState();
  if (!model || universe) return;
  const meta = model.data.meta;
  const ctrl = begin(meta.fullName);
  const home: GRepo = {
    fullName: meta.fullName,
    stars: meta.stars,
    language: meta.language,
    description: meta.description,
    // The newest sampled commit (the sample's order isn't guaranteed).
    pushedAt: model.data.commits.length
      ? Math.max(...model.data.commits.map((c) => Date.parse(c.date)))
      : null,
  };
  try {
    const g = emptyGraph({ kind: 'repo', id: meta.fullName });
    const x = await expandRepo(g, home, context(ctrl));
    if (ctrl.signal.aborted) return;
    reportMissing(x);
    const next = apply(g, x.patch);
    setU({ status: 'ready', busy: false, ...next, focus: { kind: 'galaxy', index: 0 } });
    setUniverseParam(meta.fullName);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    useStore.getState().set({ universe: null, error: toAppError(e, meta.fullName) });
  }
}

/** A person's universe: their projects and the people who build them with them. */
export async function openUserUniverse(login: string) {
  const ctrl = begin(`@${login}`);
  try {
    const g = emptyGraph({ kind: 'user', id: login });
    const x = await expandUser(login, context(ctrl));
    if (ctrl.signal.aborted) return;
    reportMissing(x);
    const next = apply(g, x.patch);
    const me = next.data.people.findIndex((p) => p.login.toLowerCase() === login.toLowerCase());
    setU({
      status: 'ready',
      busy: false,
      ...next,
      focus: me >= 0 ? { kind: 'person', index: me } : null,
    });
    setUniverseParam(`@${login}`);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    useStore.getState().set({ universe: null, error: toAppError(e, `@${login}`) });
  }
}

/** Grow the map from whatever is focused: a project's builders, or a person's projects. */
export async function expandFocus() {
  const u = useStore.getState().universe;
  if (!u?.graph || !u.data || !u.focus || u.busy) return;
  const ctrl = new AbortController();
  current = ctrl;
  const graph = u.graph;
  const focusKey =
    u.focus.kind === 'galaxy'
      ? u.data.galaxies[u.focus.index].key
      : u.data.people[u.focus.index].key;
  setU({ busy: true, done: 0, total: 0 });
  try {
    const x =
      u.focus.kind === 'galaxy'
        ? await expandRepo(graph, u.data.galaxies[u.focus.index], context(ctrl))
        : await expandUser(u.data.people[u.focus.index].login, context(ctrl));
    if (ctrl.signal.aborted) return;
    reportMissing(x);
    const next = apply(graph, x.patch);
    // Keep the focus on the same node after the arrays are rebuilt.
    const gi = next.data.galaxies.findIndex((x) => x.key === focusKey);
    const pi = next.data.people.findIndex((x) => x.key === focusKey);
    setU({
      ...next,
      busy: false,
      focus:
        gi >= 0 ? { kind: 'galaxy', index: gi } : pi >= 0 ? { kind: 'person', index: pi } : null,
    });
  } catch (e) {
    if (ctrl.signal.aborted) return;
    setU({ busy: false });
    useStore.getState().set({ error: toAppError(e, u.label) });
  }
}

/** Light only these languages (toggle one in or out; empty means all). */
export function toggleLanguage(lang: string) {
  const u = useStore.getState().universe;
  if (!u) return;
  const set = new Set(u.languages ?? []);
  if (set.has(lang)) set.delete(lang);
  else set.add(lang);
  setU({ languages: set.size ? [...set] : null });
}

/** Back to the home galaxy. */
export function closeUniverse() {
  current?.abort();
  const { model } = useStore.getState();
  useStore.getState().set({ universe: null, hovered: -1 });
  setUniverseParam(null);
  if (!model) return;
  const controls = controlsRef.current;
  if (controls) {
    controls.maxDistance = model.layout.extent * 6 + 100;
    controls.autoRotate = false;
  }
  useStore.getState().fly([0, 0, 0], model.layout.extent * 1.85 + 14);
}

/** Leave the universe and chart one of its galaxies as the new sky. */
export async function chartGalaxy(fullName: string) {
  current?.abort();
  useStore.getState().set({ universe: null });
  setUniverseParam(null);
  await openRepoInput(fullName);
}

/** The address bar follows the universe: `?user=login`, or `?repo=…&universe=1`. */
function setUniverseParam(label: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('user');
  url.searchParams.delete('universe');
  if (label?.startsWith('@')) url.searchParams.set('user', label.slice(1));
  else if (label) url.searchParams.set('universe', '1');
  window.history.replaceState(null, '', url.toString().replace(/%2F/g, '/').replace(/%40/g, '@'));
}

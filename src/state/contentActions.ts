import { fetchText, planContent } from '../data/content';
import { LANGUAGES } from '../layout/color';
import { outlineOf } from '../layout/outline';
import { formatBytes } from '../layout/size';
import { useStore, type AppState } from './store';

let latest = 0;

/** Load the text and outline of one file (the selected star) into store.content. */
export async function loadContent(index: number) {
  const { model } = useStore.getState();
  if (!model) return;
  const file = model.data.files[index];
  const ticket = ++latest;
  const plan = planContent({
    owner: model.data.meta.owner,
    repo: model.data.meta.repo,
    ref: model.data.headSha || model.data.branch,
    path: file.path,
    size: file.size,
    binary: LANGUAGES[model.languageIds[index]]?.family === 'assets',
    synthetic: model.source === 'synthetic',
  });
  const set = (c: Partial<AppState>) => {
    if (ticket === latest) useStore.setState(c);
  };
  if (plan.kind === 'binary')
    return set({ content: { file: index, status: 'binary' }, symbol: -1 });
  if (plan.kind === 'too-big') {
    return set({
      content: {
        file: index,
        status: 'too-big',
        message: `At ${formatBytes(plan.size)} it's too large to open here.`,
      },
      symbol: -1,
    });
  }
  if (plan.kind === 'unavailable') {
    return set({
      content: { file: index, status: 'unavailable', message: plan.reason },
      symbol: -1,
    });
  }
  set({ content: { file: index, status: 'loading' }, symbol: -1 });
  try {
    const text = await fetchText(plan.url);
    set({
      content: { file: index, status: 'ready', text, outline: outlineOf(file.path, text) },
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : '';
    set({
      content: {
        file: index,
        status: why === 'binary' ? 'binary' : 'error',
        message:
          why === 'not-found'
            ? 'GitHub no longer has this version of the file.'
            : 'Couldn’t reach raw.githubusercontent.com. Check your connection.',
      },
    });
  }
}

/** Keep store.content in step with the selection: a file selected loads its content. */
export function watchSelection() {
  return useStore.subscribe((s, prev) => {
    if (s.selection === prev.selection && s.model === prev.model) return;
    const sel = s.selection;
    if (sel?.kind === 'file') {
      if (s.content?.file !== sel.index) void loadContent(sel.index);
    } else if (s.content) {
      latest++;
      useStore.setState({ content: null, symbol: -1 });
    }
  });
}

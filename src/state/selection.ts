import { folderStats } from '../layout/stats';
import { focusFile, focusFolder } from '../ui/focus';
import { useStore, type Highlight } from './store';

export function selectFile(index: number, opts: { fly?: boolean } = {}) {
  const { model } = useStore.getState();
  if (!model || index < 0 || index >= model.data.files.length) return;
  useStore.getState().set({ selection: { kind: 'file', index }, panel: 'none' });
  if (opts.fly) focusFile(index);
}

export function selectFolder(index: number, opts: { fly?: boolean } = { fly: true }) {
  const { model } = useStore.getState();
  if (!model) return;
  if (index === 0) {
    clearSelection();
    return;
  }
  const stats = folderStats(model, index);
  useStore.getState().set({
    selection: { kind: 'folder', index },
    highlight: {
      reason: 'folder',
      label: model.layout.tree.folders[index].path,
      indices: stats.members,
    },
    panel: 'none',
  });
  if (opts.fly) focusFolder(index);
}

export function setHighlight(h: Highlight | null) {
  useStore.getState().set({ highlight: h });
}

export function clearSelection() {
  const { selection, highlight } = useStore.getState();
  useStore.getState().set({
    selection: null,
    // A folder highlight belongs to the folder selection; search highlights survive.
    highlight: selection?.kind === 'folder' && highlight?.reason === 'folder' ? null : highlight,
  });
}

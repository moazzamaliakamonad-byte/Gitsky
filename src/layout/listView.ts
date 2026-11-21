import type { SkyModel } from '../state/model';
import { LANGUAGES } from './color';

export type SortKey = 'path' | 'language' | 'size' | 'churn';
export type SortDir = 'asc' | 'desc';

const byPath = (model: SkyModel) => (a: number, b: number) => {
  const pa = model.data.files[a].path;
  const pb = model.data.files[b].path;
  return pa < pb ? -1 : pa > pb ? 1 : 0;
};

/** File indices sorted for the list view. Ties always fall back to path order. */
export function sortFiles(model: SkyModel, key: SortKey, dir: SortDir): number[] {
  const idx = Array.from({ length: model.data.files.length }, (_, i) => i);
  const files = model.data.files;
  const path = byPath(model);
  const sign = dir === 'asc' ? 1 : -1;
  let cmp: (a: number, b: number) => number;
  switch (key) {
    case 'path':
      cmp = (a, b) => sign * path(a, b);
      break;
    case 'size':
      cmp = (a, b) => sign * (files[a].size - files[b].size) || path(a, b);
      break;
    case 'churn':
      cmp = (a, b) => sign * (model.churn.counts[a] - model.churn.counts[b]) || path(a, b);
      break;
    case 'language':
      cmp = (a, b) =>
        sign *
          LANGUAGES[model.languageIds[a]].name.localeCompare(
            LANGUAGES[model.languageIds[b]].name,
          ) || path(a, b);
      break;
  }
  return idx.sort(cmp);
}

export function filterFiles(model: SkyModel, indices: number[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return indices;
  return indices.filter((i) => model.searchPaths[i].includes(q));
}

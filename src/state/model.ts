import type { RepoData } from '../data/types';
import { computeChurn, type Churn } from '../layout/churn';
import { colorsFor, legendFor, type LegendItem } from '../layout/color';
import { computeLayout, type Layout } from '../layout/galaxy';
import { computeNebulae, type Nebulae } from '../layout/nebulae';
import { sizesFor } from '../layout/size';

export type DataSource = 'bundled' | 'network' | 'cache' | 'stale-cache';

/** Everything the renderer and UI need for one repo, computed once per load. */
export interface SkyModel {
  data: RepoData;
  source: DataSource;
  layout: Layout;
  colors: Float32Array;
  languageIds: Uint8Array;
  sizes: Float32Array;
  churn: Churn;
  nebulae: Nebulae;
  legend: LegendItem[];
  totalBytes: number;
  /** Lowercased paths, for fast search. */
  searchPaths: string[];
}

export function buildModel(data: RepoData, source: DataSource): SkyModel {
  const layout = computeLayout(data.files);
  const { colors, languageIds } = colorsFor(data.files);
  const churn = computeChurn(data.files.length, data.commits);
  return {
    data,
    source,
    layout,
    colors,
    languageIds,
    sizes: sizesFor(data.files),
    churn,
    nebulae: computeNebulae(data.files, layout, churn.counts),
    legend: legendFor(data.files, 7),
    totalBytes: layout.tree.folders[0]?.totalBytes ?? 0,
    searchPaths: data.files.map((f) => f.path.toLowerCase()),
  };
}

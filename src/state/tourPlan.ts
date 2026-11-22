import { computeInsights } from '../layout/insights';
import { splitPath } from '../ui/format';
import type { SkyModel } from './model';

/**
 * The guided tour: a short cinematic flight through a repo, with captions written from
 * its real data. Pure: the plan depends only on the model, so it's testable and the same
 * repo always gets the same tour.
 */
export type TourAction =
  | { kind: 'overview' }
  | { kind: 'folder'; folder: number }
  | { kind: 'file'; file: number }
  | { kind: 'system'; folder: number }
  | { kind: 'leave-system' }
  | { kind: 'replay' };

export interface TourStep {
  action: TourAction;
  caption: string;
  /** Seconds to stay on this step. */
  seconds: number;
}

export function planTour(model: SkyModel): TourStep[] {
  const { files, commits, meta } = model.data;
  const { folders, fileFolder } = model.layout.tree;
  const steps: TourStep[] = [
    {
      action: { kind: 'overview' },
      caption: `${meta.fullName}: ${files.length.toLocaleString()} files in ${(folders.length - 1).toLocaleString()} folders, charted as a galaxy. Every star is a file, sized by its bytes and coloured by its language.`,
      seconds: 6,
    },
  ];

  // The largest top-level region.
  const top = folders
    .filter((f) => f.depth === 1)
    .sort((a, b) => b.totalFiles - a.totalFiles || a.index - b.index)[0];
  if (top) {
    const share = Math.round((top.totalFiles / Math.max(1, files.length)) * 100);
    steps.push({
      action: { kind: 'folder', folder: top.index },
      caption: `${top.path}/ is the largest region of the sky: ${top.totalFiles.toLocaleString()} files, ${share}% of the repo.`,
      seconds: 6,
    });
  }

  // The busiest file in the sample (or the largest if nothing was sampled).
  const ins = computeInsights(model);
  const hot = ins.hottest[0];
  const fileIndex = hot ? hot.index : ins.largest[0]?.index;
  if (fileIndex !== undefined) {
    const { name } = splitPath(files[fileIndex].path);
    steps.push({
      action: { kind: 'file', file: fileIndex },
      caption: hot
        ? `${name} changed in ${hot.count} of the last ${commits.length} commits: the busiest star. Open it and its functions, classes and types orbit it as planets.`
        : `${name} is the heaviest file here. Open it and its functions, classes and types orbit it as planets.`,
      seconds: 8,
    });
    const folder = fileFolder[fileIndex];
    if (folder > 0) {
      steps.push({
        action: { kind: 'system', folder },
        caption: `Warp in, and its folder, ${folders[folder].path}/, becomes a solar system: files orbit as planets, sub-folders as ringed gas giants.`,
        seconds: 7,
      });
      steps.push({
        action: { kind: 'leave-system' },
        caption: 'And back out to the galaxy.',
        seconds: 3.5,
      });
    }
  }

  if (commits.length > 0) {
    steps.push({
      action: { kind: 'replay' },
      caption: `Comets replay the last ${commits.length} commits in order: one comet per changed file, coloured by its author.`,
      seconds: 7,
    });
  }
  steps.push({
    action: { kind: 'overview' },
    caption:
      'Your turn: search for a file, open Insights, or zoom out to the Universe of related projects.',
    seconds: 5,
  });
  return steps;
}

import type { FileEntry } from '../data/types';

export interface Folder {
  index: number;
  /** '' for the repo root. */
  path: string;
  name: string;
  depth: number;
  /** -1 for the root. */
  parent: number;
  children: number[];
  /** Files directly in this folder (indices into the file list). */
  files: number[];
  /** Recursive counts. */
  totalFiles: number;
  totalBytes: number;
}

export interface FolderTree {
  /** folders[0] is always the root. Parents come before children. */
  folders: Folder[];
  byPath: Map<string, number>;
  /** For each file, the folder that directly contains it. */
  fileFolder: Int32Array;
}

/**
 * Paths → folder tree in one pass. Each file walks up its directory chain only until
 * it reaches a folder that already exists, so the total work is O(total path length).
 */
export function buildFolderTree(files: FileEntry[]): FolderTree {
  const folders: Folder[] = [
    {
      index: 0,
      path: '',
      name: '',
      depth: 0,
      parent: -1,
      children: [],
      files: [],
      totalFiles: 0,
      totalBytes: 0,
    },
  ];
  const byPath = new Map<string, number>([['', 0]]);
  const fileFolder = new Int32Array(files.length);

  const ensure = (dir: string): number => {
    const found = byPath.get(dir);
    if (found !== undefined) return found;
    const slash = dir.lastIndexOf('/');
    const parent = ensure(slash < 0 ? '' : dir.slice(0, slash));
    const index = folders.length;
    folders.push({
      index,
      path: dir,
      name: dir.slice(slash + 1),
      depth: folders[parent].depth + 1,
      parent,
      children: [],
      files: [],
      totalFiles: 0,
      totalBytes: 0,
    });
    folders[parent].children.push(index);
    byPath.set(dir, index);
    return index;
  };

  for (let i = 0; i < files.length; i++) {
    const p = files[i].path;
    const slash = p.lastIndexOf('/');
    const f = ensure(slash < 0 ? '' : p.slice(0, slash));
    folders[f].files.push(i);
    fileFolder[i] = f;
  }

  // Recursive totals: children always have larger indices than parents, so a reverse
  // sweep sees every child before its parent.
  for (let i = 0; i < files.length; i++) {
    const f = folders[fileFolder[i]];
    f.totalFiles += 1;
    f.totalBytes += files[i].size;
  }
  for (let i = folders.length - 1; i > 0; i--) {
    const f = folders[i];
    const p = folders[f.parent];
    p.totalFiles += f.totalFiles;
    p.totalBytes += f.totalBytes;
  }

  return { folders, byPath, fileFolder };
}

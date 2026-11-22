/** Which repo the user asked for. `branch` is only set when the URL named one. */
export interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

export interface RepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
  defaultBranch: string;
  htmlUrl: string;
}

/** A file (git "blob") in the tree. `size` is bytes, not lines of code. */
export interface FileEntry {
  path: string;
  size: number;
}

/** One sampled commit, with the files it touched resolved to indices into `RepoData.files`. */
export interface Commit {
  sha: string;
  /** First line of the message, trimmed. */
  message: string;
  author: string;
  /** ISO 8601 timestamp. */
  date: string;
  /** Indices into `RepoData.files` for touched files that still exist in the tree. */
  files: number[];
  /** Total files the commit changed, including ones since deleted or renamed. */
  changedCount: number;
}

/** How the commit history was sampled, so the UI can label numbers honestly. */
export interface Sampling {
  /** Commits in the fetched commit list (e.g. 100). */
  listed: number;
  /** Commits whose file lists we fetched (the ones that drive churn and comets). */
  detailed: number;
  withToken: boolean;
}

export interface RepoData {
  meta: RepoMeta;
  branch: string;
  /** SHA of the commit the tree was read at. */
  headSha: string;
  /** GitHub stopped listing the tree early; some files are missing. */
  truncated: boolean;
  /** Sorted by path. */
  files: FileEntry[];
  /** Chronological: oldest first. */
  commits: Commit[];
  sampling: Sampling;
  fetchedAt: string;
  /** Set when we kept only a subset of files (bundled snapshots stay small). */
  capped: { originalFileCount: number } | null;
}

export interface Progress {
  step: 'rate' | 'meta' | 'commits' | 'tree' | 'details' | 'cache' | 'done';
  /** For the details step: how many fetched so far, of how many. */
  done?: number;
  total?: number;
}

/** One row of public/snapshots/index.json, written by scripts/snapshot.ts. */
export interface BundledEntry {
  fullName: string;
  file: string;
  /** Short human label for the chip, e.g. "a frontend framework". */
  blurb: string;
  fileCount: number;
  commitCount?: number;
  /** Language mix by bytes: [colour, fraction] pairs, biggest first. Drawn on the chip. */
  spectrum?: [string, number][];
  /** A prebuilt deep-time history sits beside the snapshot (`*.deep.json`). */
  deep?: boolean;
}

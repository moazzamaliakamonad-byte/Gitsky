import { decodeSnapshot } from './snapshot';
import type { BundledEntry, RepoData } from './types';

export type { BundledEntry };

const base = import.meta.env.BASE_URL;

export async function listBundled(): Promise<BundledEntry[]> {
  const res = await fetch(`${base}snapshots/index.json`);
  if (!res.ok) throw new Error(`snapshots/index.json: ${res.status}`);
  return (await res.json()) as BundledEntry[];
}

export async function loadBundled(entry: BundledEntry): Promise<RepoData> {
  const res = await fetch(`${base}snapshots/${entry.file}`);
  if (!res.ok) throw new Error(`${entry.file}: ${res.status}`);
  return decodeSnapshot(await res.json());
}

export function findBundled(entries: BundledEntry[], fullName: string): BundledEntry | undefined {
  const k = fullName.toLowerCase();
  return entries.find((e) => e.fullName.toLowerCase() === k);
}

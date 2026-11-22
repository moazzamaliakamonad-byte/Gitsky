import type { BundledEntry } from '../data/types';

/** The featured sky drift mode moves to next: the one after the current, wrapping around. */
export function nextSky(bundled: BundledEntry[], current: string | undefined): BundledEntry | null {
  if (bundled.length === 0) return null;
  const i = bundled.findIndex((b) => b.fullName === current);
  return bundled[(i + 1) % bundled.length];
}

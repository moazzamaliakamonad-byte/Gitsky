import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import { deepClock, OFF } from './deepClock';

/** Seconds per moment of history while playing: about 15 s for a whole life. */
export const SECONDS_PER_EPOCH = 1.5;

/** Advances deep time's playhead and keeps `alive` (how grown the galaxy is) current. */
export function DeepDriver() {
  useFrame((_, dt) => {
    const s = useStore.getState();
    const d = s.deep;
    const h = d?.history;
    if (!d || !h || !s.model) {
      deepClock.epoch = OFF;
      deepClock.alive = 1;
      return;
    }
    const last = h.epochs.length;
    if (d.playing) {
      deepClock.epoch = Math.min(last, deepClock.epoch + Math.min(dt, 0.05) / SECONDS_PER_EPOCH);
      const whole = Math.floor(deepClock.epoch);
      if (deepClock.epoch >= last) s.set({ deep: { ...d, playing: false, epoch: last } });
      else if (whole !== d.epoch) s.set({ deep: { ...d, epoch: whole } });
    }
    // Files alive at the playhead, as a share of today's.
    const today = s.model.data.capped?.originalFileCount ?? s.model.data.files.length;
    const count = (k: number) => (k >= last ? today : h.epochs[k].count);
    const k = Math.floor(deepClock.epoch);
    const f = deepClock.epoch - k;
    const n = k >= last ? today : count(k) + (count(k + 1) - count(k)) * f;
    deepClock.alive = Math.max(0, Math.min(1, n / Math.max(1, today)));
  });
  return null;
}

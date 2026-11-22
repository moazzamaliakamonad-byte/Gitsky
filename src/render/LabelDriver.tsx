import { deepClock, momentOf } from './deepClock';
import { folderBirths, type DeepHistory } from '../data/deepTime';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { formClock } from './formClock';
import { labelEls } from './labels';
import { anchors } from './anchors';

const v = new THREE.Vector3();
const LABEL_H = 34;

let births: { h: DeepHistory; fb: Uint8Array } | null = null;
function birthsOf(h: DeepHistory, tree: Parameters<typeof folderBirths>[0]) {
  if (births?.h !== h) births = { h, fb: folderBirths(tree, h.born) };
  return births.fb;
}

/**
 * Every frame, project each labelled folder's centre to the screen and move its DOM
 * label there with a transform (no React re-render). Labels are placed in priority
 * order; one that would overlap an already-placed label is hidden for this frame.
 */
export function LabelDriver() {
  useFrame(({ camera, size }) => {
    const { model, heroOpen, warping, collision } = useStore.getState();
    const system = collision || useStore.getState().universe ? -1 : useStore.getState().system;
    const els = labelEls.current;
    if (!model) return;

    for (const a of anchors.values()) {
      const p = a.pos();
      if (p) v.set(p[0], p[1], p[2]).project(camera);
      const on = p !== null && v.z < 1 && formClock.value > 0.98 && system === null;
      if (on) {
        const x = (v.x * 0.5 + 0.5) * size.width;
        const y = (-v.y * 0.5 + 0.5) * size.height;
        a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      a.el.style.visibility = on ? 'visible' : 'hidden';
    }

    const show = !heroOpen && formClock.value > 0.92 && system === null && !warping;
    // With a folder selected, labels outside it fade back like their stars.
    const sel = useStore.getState().selection;
    const selPath = sel?.kind === 'folder' ? model.layout.tree.folders[sel.index].path : null;
    const placed: [number, number, number, number][] = [];
    const centers = model.layout.folderCenters;
    const h = useStore.getState().deep?.history;
    const fb =
      h && h.born.length === model.data.files.length ? birthsOf(h, model.layout.tree) : null;

    for (const item of els) {
      const f = item.folder;
      v.set(centers[f * 3], centers[f * 3 + 1], centers[f * 3 + 2]).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      let visible = show && v.z < 1 && x > 8 && x < size.width - 8 && y > 70 && y < size.height - 8;
      if (visible && fb && momentOf(fb[f]) > deepClock.epoch) visible = false;
      if (visible) {
        // Label box: anchored at the dot, text up and to the right.
        const box: [number, number, number, number] = [x - 6, y - LABEL_H, x + item.w, y + 6];
        for (const p of placed) {
          if (box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]) {
            visible = false;
            break;
          }
        }
        if (visible) placed.push(box);
      }
      item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const path = model.layout.tree.folders[f].path;
      const inside =
        selPath === null ||
        path === selPath ||
        path.startsWith(`${selPath}/`) ||
        selPath.startsWith(`${path}/`);
      const want = visible ? (inside ? '1' : '0.3') : '0';
      if (item.el.dataset.on !== want) {
        item.el.dataset.on = want;
        item.el.style.opacity = want;
        item.el.style.pointerEvents = visible ? 'auto' : 'none';
        item.el.tabIndex = visible ? 0 : -1;
      }
    }
  });
  return null;
}

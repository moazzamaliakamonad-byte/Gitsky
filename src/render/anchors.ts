/**
 * DOM elements pinned to 3D points (reticles on the hovered and selected stars).
 * LabelDriver projects each anchor's world position every frame and moves the element.
 * `pos` returns null to hide the element.
 */
export interface Anchor {
  el: HTMLElement;
  pos: () => [number, number, number] | null;
}

export const anchors = new Map<string, Anchor>();

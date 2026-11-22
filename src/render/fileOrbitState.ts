/**
 * Live state of the selected file's planet system, shared between the scene
 * (FileOrbit, every frame), the picker (a click on a planet must not select a star)
 * and its two DOM labels (hovered planet, focused planet).
 */
export const fileOrbitState = {
  active: false,
  /** Index of the planet under the pointer, or -1. */
  hover: -1,
  labels: [] as HTMLElement[],
};

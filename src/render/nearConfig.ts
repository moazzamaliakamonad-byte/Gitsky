/** Within this distance of the camera a star is drawn as a body (NearStars + star shaders). */
export const NEAR = 18;

/** Name labels for the nearest stars, positioned by NearStars each frame. */
export const nearLabels: { els: HTMLElement[]; files: number[] } = { els: [], files: [] };

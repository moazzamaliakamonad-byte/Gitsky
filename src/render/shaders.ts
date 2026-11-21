/**
 * All GLSL in one place. Explained line by line in learn/concepts/shaders-101.md.
 *
 * Per-object data arrives as attributes; per-frame values (time, animation progress)
 * as uniforms. All animation (forming, twinkle, pulse, the comet flash) happens on
 * the GPU, so the CPU does no per-star work per frame.
 */

/**
 * Forming animation, shared by stars and nebulae so clouds travel with their stars:
 * everything starts collapsed in the core, swirled 2.6 rad back, and unwinds outward,
 * inner regions first. Returns the animated position; progress (0..1) goes to `p`.
 */
const formChunk = /* glsl */ `
vec3 formPosition(vec3 position, float uForm, float uRadius, out float p) {
  float rNorm = clamp(length(position.xz) / uRadius, 0.0, 1.0);
  p = clamp((uForm - rNorm * 0.55) / 0.45, 0.0, 1.0);
  p = 1.0 - pow(1.0 - p, 3.0);                 // ease-out cubic
  float swirl = (1.0 - p) * 2.6;               // radians still to unwind
  float c = cos(swirl), s = sin(swirl);
  vec3 pos = position * mix(0.04, 1.0, p);
  pos.xz = mat2(c, -s, s, c) * pos.xz;
  return pos;
}
`;

export const starVertex = /* glsl */ `
uniform float uTime;
uniform float uForm;        // 0 → 1: galaxy-forming animation
uniform float uRadius;      // galaxy radius, for the core-outward delay
uniform float uScale;       // pixels per world unit at distance 1
uniform float uPixelRatio;
uniform float uTwinkle;     // 0 with reduced motion
uniform float uPlayhead;    // fractional commit index
uniform float uArrive;      // when, within a commit's slot, comets reach their stars
uniform float uExposure;    // < 1 for dense repos, so additive light doesn't burn to white

attribute vec3 aColor;
attribute float aSize;
attribute float aBright;    // churn: 0.38 quiet … 1.0 hottest
attribute float aSeed;      // 0..1, per-star phase
attribute float aHighlight; // 0 dimmed, 1 normal, 2 emphasised (pulses)
attribute float aTouch;     // index of the latest sampled commit ≤ playhead that touched it

varying vec3 vColor;
varying float vAlpha;
varying float vCore;
varying float vSpike;       // 0..1 strength of diffraction spikes
varying float vSpriteScale; // how much bigger the sprite is than the star's glow

${formChunk}

void main() {
  float p;
  vec3 pos = formPosition(position, uForm, uRadius, p);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // --- brightness ------------------------------------------------------------------
  float hot = smoothstep(0.55, 1.0, aBright);
  float tw = 1.0 + uTwinkle * (0.10 + 0.38 * hot) *
             sin(uTime * (0.9 + aSeed * 2.2) + aSeed * 6.2831);

  float hl = aHighlight < 0.5 ? 0.1 : (aHighlight < 1.5 ? 1.0 : 1.8 + 0.6 * sin(uTime * 5.0));

  // Comet flash: bright right after its comet lands, fading over ~1.5 commit slots.
  float age = uPlayhead - (aTouch + uArrive);
  float flash = (aTouch >= 0.0 && age >= 0.0) ? exp(-age * 1.8) : 0.0;

  float exposure = mix(uExposure, 1.0, max(hot, step(1.5, aHighlight)));
  vAlpha = (aBright * tw * hl * exposure + flash * 1.5) * smoothstep(0.0, 0.35, p);
  vColor = mix(aColor, vec3(1.0, 0.86, 0.66), flash * 0.65);  // flashes warm
  vCore = hot + flash;

  // Diffraction spikes, like a telescope photo: the hottest and the very largest files.
  vSpike = max(smoothstep(0.86, 1.0, aBright), smoothstep(3.8, 4.5, aSize) * 0.55);
  vSpike = max(vSpike, flash * 0.8) * step(0.5, aHighlight) * p;
  vSpriteScale = 1.0 + 2.2 * vSpike;

  // --- size --------------------------------------------------------------------------
  float sizeBoost = 1.0 + 0.35 * hot + flash * 1.2 + (aHighlight > 1.5 ? 0.8 : 0.0);
  float px = aSize * 0.5 * sizeBoost * uScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(px * uPixelRatio * 2.6, 1.6 * uPixelRatio, 72.0 * uPixelRatio) * vSpriteScale;
}
`;

export const starFragment = /* glsl */ `
uniform float uHalo;        // stronger soft halo when bloom is off
varying vec3 vColor;
varying float vAlpha;
varying float vCore;
varying float vSpike;
varying float vSpriteScale;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  // Measure the glow in "star units": a spiked star's sprite is larger than its glow.
  float d2 = dot(q, q) * 4.0 * vSpriteScale * vSpriteScale;
  float spike = 0.0;
  if (vSpike > 0.01) {
    vec2 a = abs(q) * 2.0;                     // 0 at centre, 1 at the sprite edge
    spike = (exp(-a.y * 70.0) * (1.0 - a.x) + exp(-a.x * 70.0) * (1.0 - a.y)) * vSpike;
  }
  if (d2 > 1.0 && spike < 0.004) discard;
  float core = exp(-d2 * 22.0);
  float halo = d2 < 1.0 ? exp(-d2 * 5.0) * (0.22 + 0.25 * uHalo) : 0.0;
  float a = (core + halo + spike * 0.9) * vAlpha;
  // A hot star's core burns whiter, like a real hot star.
  vec3 col = mix(vColor, vec3(1.0), (core + spike * 0.5) * (0.25 + 0.4 * clamp(vCore, 0.0, 1.0)));
  gl_FragColor = vec4(col * a, 1.0);
}
`;

/** Soft clouds of gas, one per sizeable folder. Camera-facing quads (billboards). */
export const nebulaVertex = /* glsl */ `
uniform float uForm;
uniform float uRadius;
attribute vec3 aCenter;
attribute float aSize;
attribute vec3 aColor;
attribute float aIntensity;
attribute float aSeed;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

${formChunk}

void main() {
  float p;
  vec3 c = formPosition(aCenter, uForm, uRadius, p);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  // Billboard: offset the corners in view space, so the quad always faces the camera.
  mv.xy += position.xy * aSize * 2.0;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  vColor = aColor;
  vSeed = aSeed;
  // Fade in after the stars, and fade out as the camera flies into the cloud.
  vAlpha = aIntensity * smoothstep(0.3, 1.0, p) * smoothstep(aSize * 0.2, aSize * 1.6, -mv.z);
}
`;

export const nebulaFragment = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  float d2 = dot(vUv, vUv);
  if (d2 > 1.0) discard;
  vec2 o = vec2(vSeed * 37.0, vSeed * 91.0);
  float n = noise(vUv * 2.3 + o + uTime * 0.015) * 0.65 + noise(vUv * 5.1 - o) * 0.35;
  float wisps = smoothstep(0.25, 0.95, n);
  float a = exp(-d2 * 3.4) * (0.35 + 0.9 * wisps) * vAlpha * uStrength;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

/**
 * The galaxy's disk: a faint glow traced along the same logarithmic spiral the layout
 * used (r = a·e^(bθ)), so the haze follows the real arms, plus a warm core bulge.
 */
export const hazeVertex = /* glsl */ `
varying vec2 vXZ;
void main() {
  vXZ = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const hazeFragment = /* glsl */ `
uniform float uA;
uniform float uB;
uniform float uArms;
uniform float uSweep;
uniform float uR;
uniform float uForm;
uniform float uStrength;
varying vec2 vXZ;

void main() {
  float r = length(vXZ);
  float ang = atan(vXZ.y, vXZ.x);
  // Invert the spiral: at radius r an arm is at θ = ln(r/a)/b; arm k sits at φ = θ + 2πk/K.
  float theta = log(max(r, 0.001) / uA) / uB;
  float dens = 0.0;
  for (int k = 0; k < 4; k++) {
    if (float(k) >= uArms) break;
    float phi = theta + float(k) * 6.2831853 / uArms;
    float d = mod(ang - phi + 3.1415927, 6.2831853) - 3.1415927;
    dens += exp(-d * d * 7.0);
  }
  float along = smoothstep(-0.6, 0.3, theta) * (1.0 - smoothstep(uSweep * 0.8, uSweep * 1.2, theta));
  float disk = exp(-(r * r) / (uR * uR * 0.32));
  float bulge = exp(-(r * r) / (uA * uA * 0.5));
  vec3 armCol = vec3(0.38, 0.47, 0.95);
  vec3 coreCol = vec3(1.0, 0.82, 0.6);
  vec3 col = armCol * (dens * along * 0.6 + 0.18) * disk * 0.07 + coreCol * bulge * 0.28;
  gl_FragColor = vec4(col * smoothstep(0.2, 1.0, uForm) * uStrength, 1.0);
}
`;

/** Star-chart overlay lines (rings, spokes, ticks). */
export const chartVertex = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const chartFragment = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vec3(0.54, 0.6, 0.78) * vAlpha * uOpacity, 1.0);
}
`;

/** A full-screen triangle: deep-space gradient with faint nebula noise. No camera. */
export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const backgroundFragment = /* glsl */ `
uniform vec2 uAspect;
uniform vec3 uVoid;
uniform vec3 uAbyss;
uniform vec3 uNebula;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  float r = length(p);
  vec3 col = mix(uAbyss, uVoid, smoothstep(0.0, 0.95, r));
  float n = noise(p * 2.2) * 0.6 + noise(p * 5.3) * 0.4;
  col += uNebula * smoothstep(0.45, 0.9, n) * 0.22 * (1.0 - smoothstep(0.2, 1.1, r));
  // Dither to avoid banding in the dark gradient (8-bit displays), using interleaved
  // gradient noise. (See learn/stories/the-striped-sky-that-wasnt.md for a stripe hunt.)
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (ign - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const dustVertex = /* glsl */ `
uniform float uPixelRatio;
attribute float aSize;
attribute float aBright;
varying float vBright;
void main() {
  vBright = aBright;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`;

export const dustFragment = /* glsl */ `
varying float vBright;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  if (d2 > 1.0) discard;
  float a = exp(-d2 * 6.0) * vBright;
  gl_FragColor = vec4(vec3(0.78, 0.84, 1.0) * a, 1.0);
}
`;

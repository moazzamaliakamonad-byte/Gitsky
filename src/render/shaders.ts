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
attribute float aSpike;     // 0..1: diffraction spikes (hottest and largest files only)

varying vec3 vColor;
varying float vAlpha;
varying float vCore;
varying float vSpike;       // 0..1 strength of diffraction spikes
varying float vSpriteScale; // how much bigger the sprite is than the star's glow
varying float vSharp;       // 0 for big close stars … 1 for pinpoints

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
  vSpike = max(aSpike, flash * 0.8) * step(0.5, aHighlight) * p;
  vSpriteScale = 1.0 + 2.2 * vSpike;

  // --- size --------------------------------------------------------------------------
  float sizeBoost = 1.0 + 0.35 * hot + flash * 1.2 + (aHighlight > 1.5 ? 0.8 : 0.0);
  float want = aSize * 1.3 * sizeBoost * uScale / max(-mv.z, 0.001) * uPixelRatio;
  // Energy-conserving sprites: a star too small to draw a smooth profile is drawn at the
  // smallest smooth footprint but dimmer by the area it lost. Distance reads as faintness,
  // the way a telescope sees it, instead of every far star becoming the same blocky dot.
  float minPx = 3.2 * uPixelRatio;
  float fit = clamp(want, minPx, 84.0 * uPixelRatio);
  vAlpha *= pow(want / fit, 1.4);
  vSharp = 1.0 - smoothstep(6.0, 40.0, fit / uPixelRatio);
  gl_PointSize = fit * vSpriteScale;
}
`;

export const starFragment = /* glsl */ `
uniform float uHalo;        // stronger soft halo when bloom is off
varying vec3 vColor;
varying float vAlpha;
varying float vCore;
varying float vSpike;
varying float vSpriteScale;
varying float vSharp;

// One diffraction spike along x: a hair-thin line that widens and fades with length.
float spikeLine(vec2 a) {
  float w = 0.010 + 0.022 * a.x;
  return exp(-(a.y * a.y) / (w * w)) * pow(1.0 - a.x, 2.2);
}

void main() {
  vec2 q = gl_PointCoord - 0.5;
  // Measure the glow in "star units": a spiked star's sprite is larger than its glow.
  float d2 = dot(q, q) * 4.0 * vSpriteScale * vSpriteScale;
  float spike = 0.0;
  if (vSpike > 0.01) {
    vec2 a = abs(q) * 2.0;                     // 0 at centre, 1 at the sprite edge
    spike = (spikeLine(a) + spikeLine(a.yx)) * vSpike;
  }
  if (d2 > 1.0 && spike < 0.003) discard;

  // A telescope's point-spread function, not a flat disc: a tight nucleus, a Moffat
  // wing (light falling off as a power law, which is what makes stars look "real"), and
  // a smooth roll-off to the sprite's edge so no hard circle is ever visible.
  float edge = 1.0 - smoothstep(0.45, 1.0, d2);
  float nucleus = exp(-d2 * mix(34.0, 18.0, vSharp));
  float m = 1.0 / (1.0 + d2 * 26.0);
  float wing = m * m * edge;
  float halo = exp(-d2 * 4.0) * edge * 0.16 * uHalo;
  float a = (nucleus * 1.15 + wing * 0.62 + halo + spike * 0.85) * vAlpha;

  // Colour lives in the wing; the nucleus burns toward white, hotter for busier files.
  // Deepening the wing's chroma keeps hues rich instead of pastel once light piles up.
  vec3 deep = pow(vColor, vec3(1.35)) * 1.12;
  float white = (nucleus + spike * 0.6) * (0.2 + 0.55 * clamp(vCore, 0.0, 1.0));
  vec3 col = mix(deep, vec3(1.0, 0.97, 0.93), clamp(white, 0.0, 1.0));
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
varying float vFacing;      // 1 seen face-on … 0 seen exactly edge-on
void main() {
  vXZ = position.xz;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vFacing = abs(normalize(cameraPosition - world.xyz).y);
  gl_Position = projectionMatrix * viewMatrix * world;
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
uniform float uOctaves;     // 4 on High, 2 on Low
varying vec2 vXZ;
varying float vFacing;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Fractal noise: the mottled, cloudy texture of a real galaxy's disk.
float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uOctaves) break;
    v += amp * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
    amp *= 0.5;
  }
  return v / (1.0 - pow(0.5, uOctaves));
}

void main() {
  float r = length(vXZ);
  float rn = r / uR;
  float ang = atan(vXZ.y, vXZ.x);
  // Invert the spiral: at radius r an arm is at θ = ln(r/a)/b; arm k sits at φ = θ + 2πk/K.
  float theta = log(max(r, 0.001) / uA) / uB;
  float arm = 0.0;    // light along the arm crests
  float lane = 0.0;   // dust lanes hugging each arm's inner edge
  float width = mix(0.55, 0.85, clamp(rn, 0.0, 1.0)); // arms loosen outward
  for (int k = 0; k < 4; k++) {
    if (float(k) >= uArms) break;
    float phi = theta + float(k) * 6.2831853 / uArms;
    float d = mod(ang - phi + 3.1415927, 6.2831853) - 3.1415927;
    arm += exp(-(d * d) / (width * width * 0.28));
    float dl = (d + width * 0.42) / (width * 0.16);
    lane += exp(-dl * dl);
  }
  float along = smoothstep(-0.6, 0.3, theta) * (1.0 - smoothstep(uSweep * 0.8, uSweep * 1.25, theta));
  // Near the core the log spiral winds into tight rings; let the bulge own that region.
  float armsIn = smoothstep(0.07, 0.24, rn);
  arm *= along * armsIn;
  lane *= along * armsIn;

  vec2 p = vXZ / uR * 6.0;
  float cloud = fbm(p);
  float grain = noise(p * 5.3 + 3.1);

  // Disk light: an exponential disk, brighter along the arms, mottled by clouds,
  // and cut by dark lanes of dust (which are themselves ragged, never clean lines).
  float disk = exp(-rn * 3.1);
  float light = disk * (0.10 + 0.9 * arm) * (0.35 + 0.95 * cloud);
  light *= 1.0 - clamp(lane * smoothstep(0.3, 0.75, cloud + grain * 0.35), 0.0, 1.0) * 0.85;

  // Bulge: old, warm starlight. A tight bright nucleus inside a broad soft glow.
  float bulge = exp(-pow(r / (uA * 0.55), 1.2)) * 0.55 + exp(-(r * r) / (uA * uA * 3.0)) * 0.22;

  // Star-forming knots: pink clumps that live only on the arm crests.
  float knots = smoothstep(0.66, 0.9, noise(p * 3.7 + 11.0) * 0.7 + grain * 0.3)
              * smoothstep(0.55, 0.95, arm) * smoothstep(0.08, 0.3, rn);

  // Colour: warm toward the centre, cool blue in the outer arms (young stars).
  vec3 inner = vec3(1.0, 0.80, 0.58);
  vec3 outer = vec3(0.42, 0.56, 1.0);
  vec3 diskCol = mix(inner, outer, smoothstep(0.05, 0.55, rn));
  vec3 col = diskCol * light * 0.6
           + vec3(1.0, 0.84, 0.64) * bulge * 0.42
           + vec3(1.0, 0.42, 0.62) * knots * disk * 0.22;

  // A flat sheet has no thickness: fade it as the camera turns edge-on.
  float facing = smoothstep(0.04, 0.4, vFacing);
  gl_FragColor = vec4(col * smoothstep(0.2, 1.0, uForm) * uStrength * facing, 1.0);
}
`;

/** Comet heads, trails (kind 0, soft glow) and impact rings (kind 1). Sizes are in world units. */
export const cometVertex = /* glsl */ `
uniform float uScale;
uniform float uPixelRatio;
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aKind;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = aAlpha;
  vKind = aKind;
  float px = aSize * uScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(px * uPixelRatio, 1.5 * uPixelRatio, 160.0 * uPixelRatio);
}
`;

export const cometFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float a;
  if (vKind < 0.5) {
    a = exp(-d * d * 9.0) + exp(-d * d * 40.0) * 0.8;   // glow + hot centre
  } else {
    a = exp(-pow((d - 0.72) * 9.0, 2.0)) * 0.9;           // thin ring
  }
  vec3 col = mix(vColor, vec3(1.0), (vKind < 0.5 ? 0.45 : 0.15) * exp(-d * d * 30.0));
  gl_FragColor = vec4(col * a * vAlpha, 1.0);
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

/**
 * Unresolved starlight: tiny, faint points scattered around the real files of each
 * folder, so a dense folder glows the way a real star cluster does. Decorative and
 * never pickable; their density follows the data, so the glow can't invent structure.
 */
export const glowVertex = /* glsl */ `
uniform float uForm;
uniform float uRadius;
uniform float uScale;
uniform float uPixelRatio;
uniform float uGain;
attribute vec3 aColor;
attribute float aSize;
attribute float aBright;
varying vec3 vColor;
varying float vAlpha;

${formChunk}

void main() {
  float p;
  vec3 pos = formPosition(position, uForm, uRadius, p);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float want = aSize * uScale / max(-mv.z, 0.001) * uPixelRatio;
  float fit = clamp(want, 2.4 * uPixelRatio, 48.0 * uPixelRatio);
  vAlpha = aBright * uGain * pow(want / fit, 1.2) * smoothstep(0.2, 0.7, p);
  vColor = aColor;
  gl_PointSize = fit;
}
`;

export const glowFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  if (d2 > 1.0) discard;
  gl_FragColor = vec4(vColor * exp(-d2 * 7.0) * (1.0 - d2) * vAlpha, 1.0);
}
`;

/**
 * The "film" finish, applied after bloom: a hue-preserving highlight shoulder (bright
 * cores roll off to white instead of clipping to flat blotches), then fine grain.
 * Runs as a postprocessing Effect, so it adds no extra pass.
 */
export const filmFragment = /* glsl */ `
uniform float uKnee;
uniform float uGrain;
uniform float uSeed;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float l = luma(c);
  // Below the knee: untouched. Above: an exponential shoulder that approaches 1.
  float k = uKnee;
  float lm = l < k ? l : k + (1.0 - k) * (1.0 - exp(-(l - k) / (1.0 - k)));
  c *= l > 1e-5 ? lm / l : 1.0;
  // Any channel still over 1 desaturates toward white at the same brightness,
  // which is how an over-exposed star looks on film.
  float mx = max(c.r, max(c.g, c.b));
  if (mx > 1.0) c = mix(vec3(lm), c, (1.0 - lm) / max(mx - lm, 1e-5));
  // Grain: strongest in the mid-darks, invisible in black and in highlights.
  float n = fract(sin(dot(uv * 1024.0 + uSeed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += n * uGrain * smoothstep(0.0, 0.08, l) * (1.0 - smoothstep(0.4, 0.9, l));
  outputColor = vec4(c, inputColor.a);
}
`;

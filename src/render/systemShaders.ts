/**
 * GLSL for the solar-system view (a folder seen up close) and the warp between views.
 */

const noise3 = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
                 mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                 mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v / 0.9375;
}
`;

/** The sun: boiling granulation, limb darkening, hotter than white at the centre. */
export const sunVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorld;
void main() {
  vP = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const sunFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntro;
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorld;
${noise3}
void main() {
  vec3 p = normalize(vP);
  float cells = fbm3(p * 5.0 + vec3(0.0, uTime * 0.05, 0.0));
  float fine = noise3(p * 22.0 - uTime * 0.2);
  float spots = smoothstep(0.72, 0.8, fbm3(p * 2.2 + 31.0)) * 0.5;
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vWorld)), 0.0);
  float limb = pow(mu, 0.45);
  vec3 hot = mix(vec3(1.0, 0.92, 0.78), uColor, 0.28);
  vec3 col = hot * (0.75 + 0.55 * cells + 0.18 * fine - spots) * (0.35 + 0.95 * limb);
  col += vec3(1.0, 0.55, 0.2) * (1.0 - limb) * 0.35;
  gl_FragColor = vec4(col * 1.9 * uIntro, 1.0);
}
`;

/** Corona: a camera-facing glow with slow streamers. Additive. */
export const coronaVertex = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize * 2.0;
  vUv = position.xy * 2.0;
  gl_Position = projectionMatrix * mv;
}
`;

export const coronaFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uInner;       // sun radius as a fraction of the quad
uniform float uIntro;
varying vec2 vUv;
${noise3}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec2 dir = vUv / max(r, 1e-4);
  float streak = noise3(vec3(dir * 4.0, uTime * 0.08)) * 0.6 + noise3(vec3(dir * 11.0, 3.0)) * 0.4;
  float x = max(r - uInner, 0.0) / (1.0 - uInner);
  float glow = exp(-x * 3.6) * (0.5 + 0.7 * streak) * 0.9 + exp(-x * 1.3) * 0.16;
  vec3 col = mix(vec3(1.0, 0.78, 0.5), uColor, 0.35) * glow * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(col * uIntro, 1.0);
}
`;

/**
 * Planets, gas giants and moons: one instanced sphere. Lit by the sun at the origin
 * with a soft terminator; rocky worlds get continents, giants get turbulent bands, and
 * busy files (heat) glow with "city lights" on their night side.
 */
export const planetVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSeed;
attribute float aKind;      // 0 rocky planet, 1 gas giant, 2 moon
attribute float aHeat;
uniform float uTime;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vColor;
varying float vSeed;
varying float vKind;
varying float vHeat;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  // Spin the surface pattern (not the lighting) around the planet's own axis.
  float a = uTime * (0.12 + aSeed * 0.25);
  float c = cos(a), s = sin(a);
  vLocal = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  vColor = aColor;
  vSeed = aSeed;
  vKind = aKind;
  vHeat = aHeat;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const planetFragment = /* glsl */ `
uniform float uIntro;
uniform vec3 uSun;         // where the light comes from (the system's sun)
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vColor;
varying float vSeed;
varying float vKind;
varying float vHeat;
${noise3}
void main() {
  vec3 n = normalize(vN);
  vec3 L = normalize(uSun - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(n, L);
  float day = smoothstep(-0.12, 0.3, ndl);
  vec3 p = normalize(vLocal);
  vec3 o = vec3(vSeed * 41.0, vSeed * 17.0, vSeed * 29.0);
  vec3 surface;
  if (vKind > 0.5 && vKind < 1.5) {
    // Gas giant: latitude bands, warped by turbulence.
    float warp = fbm3(p * 3.0 + o) * 2.2;
    float bands = sin(p.y * 15.0 + warp) * 0.5 + 0.5;
    float fine = noise3(p * 18.0 + o);
    surface = mix(vColor * 0.55, vColor * 1.15 + 0.08, bands) * (0.85 + 0.3 * fine);
  } else {
    // Rocky world or moon: continents and seas from fractal noise.
    float h = fbm3(p * (vKind > 1.5 ? 4.0 : 2.6) + o);
    float land = smoothstep(0.48, 0.56, h);
    vec3 sea = vColor * 0.32;
    vec3 ground = mix(vColor * 0.85, vec3(0.82, 0.8, 0.76), smoothstep(0.7, 0.85, h) * 0.6);
    surface = mix(sea, ground, land);
    surface = mix(surface, vec3(0.92, 0.95, 1.0), smoothstep(0.82, 0.92, abs(p.y)) * 0.8);
  }
  // A little ambient starlight, so night sides read as worlds, not holes.
  vec3 col = surface * (0.14 + 1.05 * max(ndl, 0.0) * day);
  // Night side: busy files glow, like a planet's cities seen from orbit.
  float lights = smoothstep(0.62, 0.8, noise3(p * 26.0 + o)) * (1.0 - day) * vHeat;
  col += vec3(1.0, 0.72, 0.38) * lights * 1.4;
  // Atmosphere: a rim of the planet's colour, brightest on the lit limb.
  float rim = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  col += mix(vColor, vec3(0.6, 0.8, 1.0), 0.3) * rim * (0.25 + 0.55 * vHeat) * (0.2 + 0.8 * smoothstep(-0.35, 0.4, ndl));
  gl_FragColor = vec4(col * uIntro, 1.0);
}
`;

/** Gas-giant rings: banded dust, lit from the sun's side. */
export const ringVertex = /* glsl */ `
varying vec2 vP;
varying vec3 vWorld;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uSeed;
uniform float uIntro;
varying vec2 vP;
varying vec3 vWorld;
${noise3}
void main() {
  float r = length(vP) / 2.4;   // RingGeometry runs 1.35 … 2.4 planet radii
  float x = (r - uInner) / (1.0 - uInner);
  if (x < 0.0 || x > 1.0) discard;
  float bands = noise3(vec3(r * 38.0, uSeed * 9.0, 0.0)) * 0.7 + noise3(vec3(r * 120.0, uSeed, 2.0)) * 0.3;
  float gap = smoothstep(0.42, 0.45, x) * (1.0 - smoothstep(0.5, 0.53, x));
  float a = bands * smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.85, 1.0, x)) * (1.0 - gap * 0.9);
  vec3 col = mix(uColor, vec3(0.92, 0.86, 0.76), 0.55) * a * 0.55;
  gl_FragColor = vec4(col * uIntro, 1.0);
}
`;

/** Orbit paths: faint ellipses in the star-chart ink. */
export const orbitVertex = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const orbitFragment = /* glsl */ `
uniform float uIntro;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vec3(0.54, 0.6, 0.82) * vAlpha * uIntro, 1.0);
}
`;

/** Asteroid belt: rocks on Keplerian orbits, rotated on the GPU. */
export const beltVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
attribute float aRadius;
attribute float aAngle;
attribute float aSize;
varying float vShade;
void main() {
  float a = aAngle + uTime * 6.0 * pow(aRadius, -1.5);
  vec3 pos = vec3(cos(a) * aRadius, position.y, sin(a) * aRadius);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vShade = 0.35 + 0.65 * fract(aAngle * 13.7);
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.001) * uPixelRatio, 1.5 * uPixelRatio, 10.0 * uPixelRatio);
}
`;

export const beltFragment = /* glsl */ `
uniform float uIntro;
varying float vShade;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  if (d2 > 1.0) discard;
  gl_FragColor = vec4(vec3(0.62, 0.56, 0.5) * vShade * (1.0 - d2) * 0.8 * uIntro, 1.0);
}
`;

/**
 * Warp streaks: lines in camera space, parallel to the view axis, that rush past.
 * Each line's length and brightness scale with the warp speed (uWarp, 0 … 1).
 */
export const warpVertex = /* glsl */ `
uniform float uWarp;
uniform float uTime;       // distance travelled (integrated on the CPU, so speed changes are smooth)
attribute float aEnd;       // 0 = tail, 1 = head
attribute float aSeed;
varying float vA;
varying float vEnd;
void main() {
  // Each streak cycles from far ahead to behind the camera, faster at higher warp.
  float z = -mod(aSeed * 400.0 - uTime, 400.0) - 2.0;
  float len = 2.0 + 140.0 * uWarp * uWarp;
  vec3 pos = vec3(position.xy, z - aEnd * len);
  vA = pow(uWarp, 0.6) * 1.6 * smoothstep(-400.0, -260.0, z) * (1.0 - smoothstep(-6.0, -2.0, z));
  vEnd = aEnd;
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
`;

export const warpFragment = /* glsl */ `
uniform vec3 uTint;
varying float vA;
varying float vEnd;
void main() {
  // Bright at the head, fading along the tail; slight blue shift at the head.
  vec3 col = mix(uTint, vec3(0.75, 0.85, 1.0), vEnd);
  gl_FragColor = vec4(col * vA * (0.25 + 0.75 * vEnd), 1.0);
}
`;

/**
 * Collision stars: positions come straight from the CPU simulation every frame. Writes
 * the same varyings as starVertex, so the collision reuses the star's point-spread
 * fragment shader. Files whose path exists in both repos pulse while the galaxies touch.
 */
export const collisionVertex = /* glsl */ `
uniform float uScale;
uniform float uPixelRatio;
uniform float uTime;
uniform float uExposure;
uniform float uTouch;       // 0 … 1: how strongly the two galaxies interact right now
uniform float uIntro;
uniform float uReach;       // beyond this distance from the centre, strays fade a little
attribute vec3 aColor;
attribute float aSize;
attribute float aBright;
attribute float aShared;
varying vec3 vColor;
varying float vAlpha;
varying float vCore;
varying float vSpike;
varying float vSpriteScale;
varying float vSharp;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = aShared * uTouch * (0.6 + 0.4 * sin(uTime * 4.0 + position.x * 0.05));
  float stray = mix(1.0, 0.45, smoothstep(uReach * 0.6, uReach * 1.4, length(position)));
  vAlpha = (aBright * uExposure * stray + pulse * 1.4) * uIntro;
  vColor = mix(aColor, vec3(0.55, 1.0, 0.92), pulse * 0.7);
  vCore = smoothstep(0.55, 1.0, aBright) + pulse;
  vSpike = pulse * 0.7;
  vSpriteScale = 1.0 + 2.2 * vSpike;
  float want = aSize * 1.55 * (1.0 + pulse * 0.8) * uScale / max(-mv.z, 0.001) * uPixelRatio;
  float fit = clamp(want, 3.2 * uPixelRatio, 72.0 * uPixelRatio);
  vAlpha *= pow(want / fit, 1.4);
  vSharp = 1.0 - smoothstep(6.0, 40.0, fit / uPixelRatio);
  gl_PointSize = fit * vSpriteScale;
}
`;

/** Threads of light between files that share a path, fading with length. */
export const threadVertex = /* glsl */ `
attribute float aEnd;
varying float vEnd;
void main() {
  vEnd = aEnd;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const threadFragment = /* glsl */ `
uniform float uOpacity;
varying float vEnd;
void main() {
  // Brightest at both ends (the files), dimmer in the middle of the span.
  float ends = 0.35 + 0.65 * pow(abs(vEnd * 2.0 - 1.0), 2.0);
  gl_FragColor = vec4(vec3(0.45, 0.95, 0.88) * ends * uOpacity, 1.0);
}
`;

/**
 * Nearby stars resolved into little suns (instanced spheres): boiling granulation, limb
 * darkening, a white-hot centre and a glowing rim in the language colour. The star's
 * glow sprite fades out over the same distance, so up close you see a body, not a blur.
 */
export const starBodyVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSeed;
attribute float aFade;
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorld;
varying vec3 vColor;
varying float vSeed;
varying float vFade;
void main() {
  vP = position;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vColor = aColor;
  vSeed = aSeed;
  vFade = aFade;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const starBodyFragment = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorld;
varying vec3 vColor;
varying float vSeed;
varying float vFade;
${noise3}
void main() {
  vec3 p = normalize(vP);
  vec3 o = vec3(vSeed * 37.0, vSeed * 11.0, vSeed * 23.0);
  float cells = fbm3(p * 4.5 + o + vec3(0.0, uTime * 0.06, 0.0));
  float mu = max(dot(normalize(vN), normalize(cameraPosition - vWorld)), 0.0);
  float limb = pow(mu, 0.5);
  vec3 hot = mix(vColor, vec3(1.0, 0.97, 0.92), 0.45);
  vec3 col = mix(vColor * 0.9, hot, limb) * (0.7 + 0.6 * cells);
  col += vColor * pow(1.0 - mu, 2.5) * 0.9;   // glowing rim in the language colour
  gl_FragColor = vec4(col * 1.5 * vFade, 1.0);
}
`;

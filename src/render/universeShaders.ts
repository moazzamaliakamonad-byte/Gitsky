/**
 * GLSL for the universe view: every related project as a small spiral galaxy, people as
 * bright stars, and the filaments between them.
 */

/** A galaxy disk: one instanced quad lying in the galaxy's own (tilted) plane. */
export const uGalaxyVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSeed;
attribute float aGlow;      // 1 when hovered or selected
attribute float aActivity;  // 1 pushed this week … ~0.1 dormant for years
attribute float aDim;       // 1 when filtered out
varying vec2 vP;
varying vec3 vColor;
varying float vSeed;
varying float vGlow;
varying float vActivity;
varying float vDim;
void main() {
  vP = position.xz;
  vColor = aColor;
  vSeed = aSeed;
  vGlow = aGlow;
  vActivity = aActivity;
  vDim = aDim;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const uGalaxyFragment = /* glsl */ `
uniform float uTime;
uniform float uIntro;
varying vec2 vP;
varying vec3 vColor;
varying float vSeed;
varying float vGlow;
varying float vActivity;
varying float vDim;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  float theta = atan(vP.y, vP.x);
  float arms = 2.0 + floor(vSeed * 2.99);
  float twist = 3.5 + vSeed * 3.0;
  float spin = uTime * (0.05 + vSeed * 0.05);
  float spiral = 0.5 + 0.5 * cos(arms * (theta - spin) - log(r + 0.04) * twist * arms * 0.5);
  float armMask = pow(spiral, 2.5) * smoothstep(1.0, 0.18, r) * smoothstep(0.02, 0.2, r);
  // Resolved stars: a fine sparkle that follows the arms.
  vec2 cell = floor(vP * 46.0 + vSeed * 91.0);
  float star = step(0.93, h(cell)) * armMask;
  float disk = exp(-r * 3.4);
  float core = exp(-r * r * 60.0);
  vec3 warm = vec3(1.0, 0.86, 0.66);
  vec3 col = warm * core * 1.6
           + mix(warm, vColor, 0.65) * disk * 0.45
           + vColor * armMask * 0.9
           + vec3(0.95, 0.97, 1.0) * star * 0.9;
  // Activity: live projects burn bright and their cores pulse; dormant ones cool,
  // dimming and reddening like old stars.
  float pulse = step(0.9, vActivity) * 0.18 * (0.5 + 0.5 * sin(uTime * 2.4 + vSeed * 40.0));
  vec3 cooled = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(1.0, 0.62, 0.45), (1.0 - vActivity) * 0.6);
  col = cooled * (0.32 + 0.68 * vActivity) + warm * core * pulse * 3.0;
  col *= 1.0 + vGlow * 0.6;
  col *= mix(1.0, 0.1, vDim);
  col *= smoothstep(1.0, 0.75, r) * uIntro;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** People: bright blue-white stars with four spikes. */
export const uPersonVertex = /* glsl */ `
uniform float uPixelRatio;
attribute float aSize;
attribute float aGlow;
attribute float aBridge;
varying float vGlow;
varying float vBridge;
void main() {
  vGlow = aGlow;
  vBridge = aBridge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (1.0 + aGlow * 0.6) * uPixelRatio;
}
`;

export const uPersonFragment = /* glsl */ `
uniform float uIntro;
varying float vGlow;
varying float vBridge;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  vec2 a = abs(q) * 2.0;
  float d2 = dot(q, q) * 4.0;
  float core = exp(-d2 * 30.0) + exp(-d2 * 6.0) * 0.35;
  float spikes = (exp(-a.y * 40.0) * (1.0 - a.x) + exp(-a.x * 40.0) * (1.0 - a.y)) * 0.7;
  // Bridges (people who build several of these projects) shine gold.
  vec3 tint = mix(vec3(0.62, 0.78, 1.0), vec3(1.0, 0.8, 0.45), vBridge);
  vec3 col = mix(tint, vec3(1.0), core) * (core + spikes) * (1.0 + vGlow + vBridge * 0.4);
  gl_FragColor = vec4(col * uIntro, 1.0);
}
`;

/** Filaments: line segments with a pulse of light travelling from home outward. */
export const uLinkVertex = /* glsl */ `
attribute float aT;         // 0 at the near end, 1 at the far end
attribute float aStrength;
attribute float aSeed;
varying float vT;
varying float vStrength;
varying float vSeed;
void main() {
  vT = aT;
  vStrength = aStrength;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const uLinkFragment = /* glsl */ `
uniform float uTime;
uniform float uIntro;
varying float vT;
varying float vStrength;
varying float vSeed;
void main() {
  float head = fract(uTime * 0.18 + vSeed);
  float pulse = exp(-pow((vT - head) * 9.0, 2.0));
  vec3 col = vec3(0.35, 0.85, 0.95) * (0.18 + pulse * 1.2) * vStrength;
  gl_FragColor = vec4(col * uIntro, 1.0);
}
`;

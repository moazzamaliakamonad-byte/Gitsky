import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { NOW, placeGhosts, type DeepHistory } from '../data/deepTime';
import { colorsFor } from '../layout/color';
import type { SkyModel } from '../state/model';
import { useStore } from '../state/store';
import { deepClock } from './deepClock';

const vertex = /* glsl */ `
uniform float uEpoch;
uniform float uScale;
uniform float uPixelRatio;
attribute vec3 aColor;
attribute float aBorn;
attribute float aDied;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float since = uEpoch - aBorn;
  float after = uEpoch - aDied;
  float alive = smoothstep(-0.02, 0.2, since) * (1.0 - smoothstep(0.0, 0.7, after));
  // A file that is deleted burns out: a last warm flare that cools to red and fades.
  float flare = after >= 0.0 ? exp(-after * 3.5) : 0.0;
  vColor = mix(aColor, vec3(1.0, 0.42, 0.28), smoothstep(-0.05, 0.25, after));
  vAlpha = alive * (0.75 + flare * 1.6);
  float px = 1.6 * uScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(px, 2.6, 7.0 + flare * 10.0) * uPixelRatio;
}
`;
const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q) * 4.0;
  if (d2 > 1.0) discard;
  float core = exp(-d2 * 26.0);
  float wing = 1.0 / (1.0 + d2 * 30.0);
  gl_FragColor = vec4(vColor * (core * 1.1 + wing * wing * 0.5) * vAlpha, 1.0);
}
`;

/**
 * Files that lived and died before today: placed in the folder they lived in (or the
 * nearest one that still exists), alive between their birth and deletion, then burning
 * out. Only drawn in deep time.
 */
export function DeepGhosts({ model, history }: { model: SkyModel; history: DeepHistory }) {
  const { size, camera } = useThree();
  const dpr = useStore((s) => s.dpr);

  const geometry = useMemo(() => {
    const { tree, folderCenters, folderRadii } = model.layout;
    const n = history.ghosts.length;
    const last = history.epochs.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(placeGhosts(history.ghosts, tree, folderCenters, folderRadii), 3),
    );
    g.setAttribute('aColor', new THREE.BufferAttribute(colorsFor(history.ghosts).colors, 3));
    const born = new Float32Array(n);
    const died = new Float32Array(n);
    history.ghosts.forEach((gh, i) => {
      born[i] = gh.born === NOW ? last : gh.born;
      died[i] = gh.died === NOW ? last : gh.died;
    });
    g.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
    g.setAttribute('aDied', new THREE.BufferAttribute(died, 1));
    return g;
  }, [model, history]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uEpoch: { value: 0 }, uScale: { value: 1 }, uPixelRatio: { value: 1 } },
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    material.uniforms.uScale.value = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    material.uniforms.uPixelRatio.value = dpr;
  }, [size.height, camera, dpr, material]);

  useFrame(() => {
    material.uniforms.uEpoch.value = deepClock.epoch;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

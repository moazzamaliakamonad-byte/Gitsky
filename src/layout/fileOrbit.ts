import type { FileSymbol, SymbolKind } from './outline';
import { rand } from './random';

/**
 * The selected file as a planet system: each top-level symbol of its outline orbits the
 * file's star. Order in the file sets the orbit (first symbol innermost), the lines a
 * symbol spans set its size, and its kind sets its colour. Speeds follow Kepler.
 */
export interface SymbolOrbit {
  symbol: number;
  orbit: number;
  speed: number;
  phase: number;
  incline: number;
  node: number;
  radius: number;
}

export const KIND_COLOR: Record<SymbolKind, string> = {
  function: '#5ee0c8',
  class: '#b48cff',
  type: '#6aa8ff',
  const: '#c7e07a',
  heading: '#e9edff',
  key: '#9fb0d6',
};

export const KIND_LABEL: Record<SymbolKind, string> = {
  function: 'function',
  class: 'class',
  type: 'type',
  const: 'constant',
  heading: 'section',
  key: 'key',
};

/** Planet radius from the number of lines a symbol spans (log scale). */
export const symbolRadius = (lines: number) => Math.min(0.48, 0.09 + 0.055 * Math.log2(lines + 1));

export function layoutFileOrbit(outline: FileSymbol[], seed: number): SymbolOrbit[] {
  return outline.map((s, i) => {
    // Orbits widen with the square root of the index, so long outlines stay compact.
    const orbit = 1.5 + 0.95 * Math.sqrt(i + 1) + i * 0.08;
    return {
      symbol: i,
      orbit,
      speed: 1.1 * Math.pow(orbit, -1.5),
      phase: rand(seed + i, 1) * Math.PI * 2,
      incline: (rand(seed + i, 2) - 0.5) * 0.25,
      node: rand(seed + i, 3) * Math.PI * 2,
      radius: symbolRadius(s.endLine - s.line + 1),
    };
  });
}

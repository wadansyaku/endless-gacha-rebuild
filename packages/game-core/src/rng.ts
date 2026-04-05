import type { RngState } from "./types";

const UINT32_MAX = 0xffff_ffff;

export const createSeed = (input: number | string): number => {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input >>> 0;
  }

  const source = String(input);
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const nextRng = (state: RngState): [number, RngState] => {
  const nextSeed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return [nextSeed / UINT32_MAX, { seed: nextSeed }];
};

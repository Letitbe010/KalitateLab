/**
 * Exercise generator (spec §10): template + seed → verified exercise. Attempts are derived
 * from the seed, so the same seed always gives the same exercise; the seed of the attempt that
 * passed is stored in the exercise and shown on screen.
 */
import type { Exercise } from '../model';
import { rng } from './rng';
import { BUILDERS, LEVELS, TEMPLATES, type TemplateId } from './templates';
import { verifyExercise } from './verify';

export { TEMPLATES, LEVELS, type TemplateId } from './templates';
export { verifyExercise } from './verify';

const MAX_ATTEMPTS = 400;

/** Deterministic seed of attempt i (splitmix-like). */
function attemptSeed(seed: number, i: number): number {
  let z = (seed + Math.imul(i, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export interface Generated {
  exercise: Exercise;
  attempts: number;
}

export function generate(template: TemplateId, seed: number, level?: 1 | 2 | 3): Generated {
  const levels = LEVELS[template];
  const lv = level ?? levels[0]!;
  if (!levels.includes(lv)) throw new RangeError(`Template ${template} has levels ${levels.join(', ')}`);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const s = i === 0 ? seed >>> 0 : attemptSeed(seed, i);
    const draft = BUILDERS[template](rng(s), lv);
    const exercise: Exercise = { id: `${template}-${lv}-${s}`, origin: 'generated', seed: s, ...draft };
    if (verifyExercise(exercise).ok) return { exercise, attempts: i + 1 };
  }
  throw new Error(`No valid ${template} exercise after ${MAX_ATTEMPTS} attempts (seed ${seed})`);
}

/** Rebuilds exactly the exercise stored with `seed` (no retries). */
export function rebuild(template: TemplateId, seed: number, level: 1 | 2 | 3): Exercise {
  const draft = BUILDERS[template](rng(seed >>> 0), level);
  return { id: `${template}-${level}-${seed >>> 0}`, origin: 'generated', seed: seed >>> 0, ...draft };
}

export function randomTemplate(seed: number): TemplateId {
  return TEMPLATES[seed % TEMPLATES.length]!;
}

/** The verified pool (src/data/pool.json, checked by tests/pool.test.ts and the oracle). */
import type { Exercise } from '../core/model';
import { exerciseFromJSON } from '../core/serialize';
import raw from './pool.json';

export const POOL: Exercise[] = (raw as unknown[]).map(exerciseFromJSON);
export const poolById = (id: string): Exercise | undefined => POOL.find((e) => e.id === id);

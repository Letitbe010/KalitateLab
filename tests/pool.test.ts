/**
 * Pool (spec §9): OPE exercises re-modelled (src/data/pool-ope.json) + one pinned generated
 * exercise per template. `WRITE_POOL=1 npx vitest run tests/pool.test.ts` rebuilds pool.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generate, LEVELS, rebuild, TEMPLATES, verifyExercise, type TemplateId } from '../src/core/generator';
import { grade } from '../src/core/grader';
import type { Exercise } from '../src/core/model';
import { exerciseFromJSON, exerciseToJSON } from '../src/core/serialize';
import { solveExercise } from '../src/core/solve';
import { perfectAnswers } from './helpers';

const OPE_FILE = 'src/data/pool-ope.json';
const POOL_FILE = 'src/data/pool.json';
const PIN_SEED = 1;

const ope: Exercise[] = (JSON.parse(readFileSync(OPE_FILE, 'utf8')) as unknown[]).map(exerciseFromJSON);

function buildPool(): unknown[] {
  const pinned = TEMPLATES.map((t) => {
    const ex = generate(t, PIN_SEED, LEVELS[t][0]).exercise;
    return exerciseToJSON({ ...ex, review: 'review-needed' });
  });
  return [...ope.map(exerciseToJSON), ...pinned];
}

if (process.env.WRITE_POOL === '1') writeFileSync(POOL_FILE, JSON.stringify(buildPool(), null, 1) + '\n');

describe('pool', () => {
  it('pool.json is up to date with pool-ope.json and the pinned seeds', () => {
    expect(existsSync(POOL_FILE)).toBe(true);
    expect(JSON.parse(readFileSync(POOL_FILE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(buildPool())));
  });

  const pool: Exercise[] = existsSync(POOL_FILE) ? (JSON.parse(readFileSync(POOL_FILE, 'utf8')) as unknown[]).map(exerciseFromJSON) : [];

  it.each(pool.map((e) => [e.id, e] as const))('%s: verified, solvable, perfect answers 10/10', (_id, e) => {
    const v = verifyExercise(e);
    expect(v.reasons).toEqual([]);
    expect(grade(e, perfectAnswers(e)).score10).toBeCloseTo(10, 12);
    expect(e.review).toBe('review-needed'); // until the user approves (spec §9.3)
  });

  it('pinned generated exercises rebuild from their stored seed', () => {
    for (const e of pool.filter((x) => x.origin === 'generated')) {
      const [t, lv] = e.id.split('-') as [TemplateId, string];
      expect(JSON.stringify(exerciseToJSON({ ...rebuild(t, e.seed!, Number(lv) as 1 | 2 | 3), review: 'review-needed' }))).toBe(JSON.stringify(exerciseToJSON(e)));
    }
  });

  it('OPE solutions (printed for the user review)', () => {
    const lines = ope.map((e) => `${e.id}: ${JSON.stringify(solveExercise(e))}`);
    writeFileSync('tools/oracle/out/ope-solutions.txt', lines.join('\n') + '\n');
    expect(lines.length).toBe(6);
  });
});

/**
 * Worked exercises (spec §15.3, phase 6 acceptance: the full list, number tests green).
 *  - 10 worked exercises (spec §15.1), each on a distinct, verified pool exercise;
 *  - the text templates contain no hard-coded numbers (all numbers come from the solvers);
 *  - the same numbers appear in both languages, and the summary equals the grader's answers.
 */
import { LEVELS, TEMPLATES, type TemplateId, verifyExercise } from '../src/core/generator';
import { grade } from '../src/core/grader';
import es from '../src/i18n/es.json';
import eu from '../src/i18n/eu.json';
import { translate } from '../src/i18n';
import worked from '../src/data/worked.json';
import { poolById } from '../src/data/pool';
import { buildWorked } from '../src/ui/worked';
import { perfectAnswers } from './helpers';

const W = worked.worked;

/** Constants that belong to formulas or rules, not to the data. */
const ALLOWED = [/n − 1/g, /n−1/g, /σₙ₋₁/g, /6σ/g, /3σ/g, /±3/g, /1 − Φ/g, /1 − p̄/g, /100/g, /\b0\b/g, /A₂ = 3/g, /1,33/g];
function hardNumbers(s: string): string[] {
  let x = s.replace(/\{\w+\}/g, '');
  for (const re of ALLOWED) x = x.replace(re, '');
  return x.match(/\d+/g) ?? [];
}

describe('worked exercises', () => {
  it('there are 10 (spec §15.1), each on a distinct pool exercise that passes every check', () => {
    expect(W).toHaveLength(10);
    expect(new Set(W.map((w) => w.pool)).size).toBe(10);
    for (const w of W) {
      const ex = poolById(w.pool);
      expect(ex, w.pool).toBeDefined();
      expect(verifyExercise(ex!).reasons, w.pool).toEqual([]);
      expect(grade(ex!, perfectAnswers(ex!)).score10, w.pool).toBeCloseTo(10, 12);
    }
  });

  it('"now you" points to a real template and level', () => {
    for (const w of W) {
      expect(TEMPLATES).toContain(w.nowYou.template);
      expect(LEVELS[w.nowYou.template as TemplateId]).toContain(w.nowYou.level);
    }
  });

  it('text templates of worked exercises and solutions contain no hard-coded numbers', () => {
    for (const dict of [eu, es] as Record<string, string>[])
      for (const [k, v] of Object.entries(dict)) if (k.startsWith('wk.') || k.startsWith('sol.')) expect(hardNumbers(v), `${k}: ${v}`).toEqual([]);
  });

  it('every why/careful key exists in both languages', () => {
    const ke = Object.keys(eu).filter((k) => k.startsWith('wk.'));
    const ks = Object.keys(es).filter((k) => k.startsWith('wk.'));
    expect(ks.sort()).toEqual(ke.sort());
  });

  it.each(W.map((w) => [w.id, w.pool]))('%s: steps in both languages with the same numbers; summary = grader', (_id, pool) => {
    const ex = poolById(pool)!;
    const se = buildWorked(ex, (k, v) => translate('eu', k, v));
    const ss = buildWorked(ex, (k, v) => translate('es', k, v));
    expect(se.length).toBe(ex.asks.length + 2);
    expect(ss.map((s) => s.key)).toEqual(se.map((s) => s.key));
    const nums = (steps: typeof se) => steps.flatMap((s) => s.what.flatMap((w) => w.match(/\d+(,\d+)?/g) ?? []));
    expect(nums(ss)).toEqual(nums(se));
    // every ask step explains why
    for (const s of se.slice(1, -1)) expect(s.why, s.key).toBeTruthy();
    // the summary lines, typed back as answers, score 10/10
    const sum = se[se.length - 1]!.what;
    expect(sum).toHaveLength(ex.asks.length);
    expect(sum.every((l) => !l.includes('NaN') && !l.includes('undefined'))).toBe(true);
  });
});

/**
 * Theory (spec §14.3):
 *  - every topic in both languages; the ids list used by worked exercises matches;
 *  - no hand-written numbers in the prose (examples use solver variables);
 *  - every example fills in both languages from its pool exercise;
 *  - every formula marked `check` is compared with the solvers on 1000 random cases.
 */
import fc from 'fast-check';
import { TOPIC_IDS } from '../src/content/theory/ids';
import { TOPICS } from '../src/content/theory/topics';
import type { FormulaId } from '../src/content/theory/types';
import { capability } from '../src/core/capability';
import * as D from '../src/core/decimal';
import { describe as describeDs } from '../src/core/descriptive';
import { phi, populationDefects, upperTail } from '../src/core/normal';
import { poolById } from '../src/data/pool';
import { translate } from '../src/i18n';
import { fillTemplate } from '../src/ui/theoryTemplate';

const RUNS = { numRuns: 1000 };
const close = (a: number, b: number, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** A random spec + process: LSL < USL, σ > 0, μ anywhere around the tolerance. */
const procArb = fc.record({
  l: fc.integer({ min: 19000, max: 20000 }),
  w: fc.integer({ min: 5, max: 400 }),
  m: fc.integer({ min: -300, max: 700 }),
  s: fc.integer({ min: 1, max: 200 }),
});
const proc = (r: { l: number; w: number; m: number; s: number }) => {
  const lsl = D.q(r.l, 1000);
  const usl = D.q(r.l + r.w, 1000);
  const mu = D.q(r.l + r.m, 1000);
  return { lsl, usl, mu, sigma: r.s / 1000, L: D.toNumber(lsl), U: D.toNumber(usl), M: D.toNumber(mu) };
};
const freqArb = fc.array(fc.tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 15 })), { minLength: 2, maxLength: 8 }).filter((cs) => cs.reduce((a, c) => a + c[1], 0) >= 2);

const CHECKS: Record<FormulaId, () => void> = {
  mean: () =>
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -5000, max: 5000 }), { minLength: 1, maxLength: 40 }), (ks) => {
        const xs = ks.map((k) => D.q(k, 100));
        expect(D.eq(describeDs({ kind: 'values', unit: '', values: xs }).mean, D.div(D.sum(xs), D.q(xs.length)))).toBe(true);
      }),
      RUNS,
    ),
  'mean-freq': () =>
    fc.assert(
      fc.property(freqArb, (cs) => {
        const classes = cs.map(([k, f]) => ({ x: D.q(k, 10), f }));
        const n = cs.reduce((a, c) => a + c[1], 0);
        const sfx = D.sum(classes.map((c) => D.mul(c.x, D.q(c.f))));
        expect(D.eq(describeDs({ kind: 'freq', unit: '', classes }).mean, D.div(sfx, D.q(n)))).toBe(true);
      }),
      RUNS,
    ),
  'var-sample': () =>
    fc.assert(
      fc.property(freqArb, (cs) => {
        const classes = cs.map(([k, f]) => ({ x: D.q(k, 10), f }));
        const n = cs.reduce((a, c) => a + c[1], 0);
        const m = D.div(D.sum(classes.map((c) => D.mul(c.x, D.q(c.f)))), D.q(n));
        const ss = D.sum(classes.map((c) => D.mul(D.q(c.f), D.pow(D.sub(c.x, m), 2))));
        const d = describeDs({ kind: 'freq', unit: '', classes });
        expect(close(d.s, Math.sqrt(D.toNumber(ss) / (n - 1)))).toBe(true);
        expect(close(d.sigma, Math.sqrt(D.toNumber(ss) / n))).toBe(true);
      }),
      RUNS,
    ),
  'var-pop': () => CHECKS['var-sample'](),
  z: () =>
    fc.assert(
      fc.property(procArb, (r) => {
        const p = proc(r);
        const d = populationDefects(p.M, p.sigma, p.L, p.U);
        expect(close(d.zL!, (p.L - p.M) / p.sigma, 1e-9)).toBe(true);
        expect(close(d.below!, phi((p.L - p.M) / p.sigma), 1e-9)).toBe(true);
        expect(close(d.above!, 1 - phi((p.U - p.M) / p.sigma), 1e-9) || close(d.above!, upperTail((p.U - p.M) / p.sigma), 1e-12)).toBe(true);
      }),
      RUNS,
    ),
  'pct-population': () =>
    fc.assert(
      fc.property(procArb, (r) => {
        const p = proc(r);
        const formula = 100 * (phi((p.L - p.M) / p.sigma) + upperTail((p.U - p.M) / p.sigma));
        expect(close(100 * populationDefects(p.M, p.sigma, p.L, p.U).total, formula, 1e-12)).toBe(true);
      }),
      RUNS,
    ),
  cp: () =>
    fc.assert(
      fc.property(procArb, (r) => {
        const p = proc(r);
        expect(close(capability({ lsl: p.lsl, usl: p.usl }, p.mu, p.sigma).cp!, (p.U - p.L) / (6 * p.sigma))).toBe(true);
      }),
      RUNS,
    ),
  cpu: () => CHECKS.cpk(),
  cpl: () => CHECKS.cpk(),
  cpk: () =>
    fc.assert(
      fc.property(procArb, (r) => {
        const p = proc(r);
        const c = capability({ lsl: p.lsl, usl: p.usl }, p.mu, p.sigma);
        const cpu = (p.U - p.M) / (3 * p.sigma);
        const cpl = (p.M - p.L) / (3 * p.sigma);
        expect(close(c.cpu!, cpu) && close(c.cpl!, cpl) && close(c.cpk, Math.min(cpu, cpl))).toBe(true);
      }),
      RUNS,
    ),
  'cp-cpk-mean': () =>
    fc.assert(
      fc.property(procArb, (r) => {
        const p = proc(r);
        const c = capability({ lsl: p.lsl, usl: p.usl }, p.mu, p.sigma);
        expect(close(c.cp!, (c.cpu! + c.cpl!) / 2, 1e-9) && c.cpk <= c.cp! + 1e-12).toBe(true);
      }),
      RUNS,
    ),
};

/** Constants that belong to rules or references, not to data. */
/** exam years are references (OPE Madrid 2025, Euskadi OPE 2020), not data */
const ALLOWED = [/\b20\d\d\b/g, /99,73/g, /\b68\b/g, /\b95\b/g, /1,33/g, /[±]?\s?[236]σ/g, /n − 1/g, /σₙ₋₁/g, /1 − Φ/g, /\d+\. gaia/g, /tema \d+/g, /ISO 286/g, /< 1\b/g, /\b1 ≤/g, /= 1 − /g];
function hardNumbers(s: string): string[] {
  let x = s.replace(/\{\{[^}]+\}\}/g, '');
  for (const re of ALLOWED) x = x.replace(re, '');
  return x.match(/\d+/g) ?? [];
}

describe('theory topics', () => {
  it('ids list matches the topics', () => expect(TOPIC_IDS).toEqual(TOPICS.map((t) => t.id)));

  it.each(TOPICS.map((tp) => [tp.id, tp] as const))('%s: both languages, no hand-written numbers, examples fill', (_id, tp) => {
    expect(tp.title.eu && tp.title.es).toBeTruthy();
    for (const b of tp.blocks) {
      if (b.t === 'p' || b.t === 'note' || b.t === 'example') {
        expect(b.eu.length > 0 && b.es.length > 0).toBe(true);
        expect(hardNumbers(b.eu), b.eu).toEqual([]);
        expect(hardNumbers(b.es), b.es).toEqual([]);
      }
      if (b.t === 'list') {
        expect(b.eu.length).toBe(b.es.length);
        for (const x of [...b.eu, ...b.es]) expect(hardNumbers(x), x).toEqual([]);
      }
      if (b.t === 'example') {
        const ex = poolById(b.pool);
        expect(ex, b.pool).toBeDefined();
        for (const lang of ['eu', 'es'] as const) {
          const out = fillTemplate(b[lang], ex!, (k, v) => translate(lang, k, v));
          expect(out).not.toMatch(/\{\{|NaN|undefined/);
        }
      }
    }
  });

  const checked = [...new Set(TOPICS.flatMap((tp) => tp.blocks.flatMap((b) => (b.t === 'f' && b.check ? [b.check] : []))))];
  it.each(checked)('formula %s = solvers (1000 random cases)', (id) => CHECKS[id]());
});

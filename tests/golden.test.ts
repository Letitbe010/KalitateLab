import * as D from '../src/core/decimal';
import { describe as describeDs } from '../src/core/descriptive';
import { populationDefects } from '../src/core/normal';
import type { Dataset } from '../src/core/model';
import { capability } from '../src/core/capability';
import { pLimits, xbarRLimits } from '../src/core/charts';
import { pareto } from '../src/core/pareto';
import golden from './golden/golden.json';

/** Typed access to a golden case (the JSON union is too loose for TypeScript). */
export function byId<I, E>(id: string): { input: I; expected: E } {
  const c = golden.cases.find((k) => k.id === id);
  if (!c) throw new Error(`golden case ${id} missing`);
  return c as unknown as { input: I; expected: E };
}
const num = (s: string): number => D.toNumber(D.dec(s));

/** |value − expected| ≤ half a unit of the last decimal written in `expected`. */
export function expectGolden(value: number, expected: string, label: string): void {
  const decimals = (expected.split(/[.,]/)[1] ?? '').length;
  const tol = 0.5 * 10 ** -decimals + 1e-12;
  const e = num(expected);
  if (!(Math.abs(value - e) <= tol)) {
    throw new Error(`${label}: got ${value}, golden ${expected} (±${tol})`);
  }
}

describe('golden KQ2 — % defective in the population (normal)', () => {
  const { input: i, expected: e } = byId<{ lsl: string; usl: string; mu: string; sigma: string }, Record<string, string>>('KQ2');
  const r = populationDefects(num(i.mu), num(i.sigma), num(i.lsl), num(i.usl));
  it('z values', () => {
    expectGolden(r.zU!, e.zU!, 'zU');
    expectGolden(r.zL!, e.zL!, 'zL');
  });
  it('tails and total in %, and ppm', () => {
    expectGolden(100 * r.above!, e.pctAbove!, '% above');
    expectGolden(100 * r.below!, e.pctBelow!, '% below');
    expectGolden(100 * r.total, e.pctTotal!, '% total');
    expectGolden(1e6 * r.total, e.ppm!, 'ppm');
  });
});

describe('golden KQ5 — frequency table (Euskadi 2020 style)', () => {
  const { input: i, expected: e } = byId<{ classes: [string, number][] }, { n: number; mean: string; sigma: string; s: string }>('KQ5');
  const ds: Dataset = { kind: 'freq', unit: 'mm', classes: i.classes.map(([x, f]) => ({ x: D.dec(x), f })) };
  const r = describeDs(ds);
  it('n and exact mean', () => {
    expect(r.n).toBe(e.n);
    expect(D.eq(r.mean, D.dec(e.mean))).toBe(true);
  });
  it('σₙ and sₙ₋₁ are told apart', () => {
    expectGolden(r.sigma, e.sigma, 'σn');
    expectGolden(r.s, e.s, 's(n−1)');
    expect(Math.abs(r.s - r.sigma)).toBeGreaterThan(0.001);
  });
});

describe('golden KQ1 — capability from a summary', () => {
  const { input: i, expected: e } = byId<Record<string, string>, Record<string, string>>('KQ1');
  const c = capability({ lsl: D.dec(i.lsl!), usl: D.dec(i.usl!) }, D.dec(i.mu!), num(i.sigma!));
  it('Cp, Cpu, Cpl, Cpk', () => {
    expectGolden(c.cp!, e.cp!, 'Cp');
    expectGolden(c.cpu!, e.cpu!, 'Cpu');
    expectGolden(c.cpl!, e.cpl!, 'Cpl');
    expectGolden(c.cpk, e.cpk!, 'Cpk');
  });
  it('off-centre towards USL', () => expect(c.centered).toBe(e.centered));
});

describe('golden KQ3 — X̄-R limits (table constants, exact)', () => {
  const { input: i, expected: e } = byId<{ n: number; xbarbar: string; rbar: string }, Record<string, string>>('KQ3');
  const L = xbarRLimits(D.dec(i.xbarbar), D.dec(i.rbar), i.n);
  it('limits are exactly the golden values', () => {
    expect(D.eq(L.xbar.ucl, D.dec(e.uclX!))).toBe(true);
    expect(D.eq(L.xbar.lcl, D.dec(e.lclX!))).toBe(true);
    expect(D.eq(L.R.ucl, D.dec(e.uclR!))).toBe(true);
    expect(D.eq(L.R.lcl, D.dec(e.lclR!))).toBe(true);
  });
  it('σ̂ = R̄/d₂', () => expectGolden(D.toNumber(L.sigmaHat), e.sigmaHat!, 'σ̂'));
});

describe('golden KQ4 — p chart', () => {
  const { input: i, expected: e } = byId<{ pbar: string; n: number }, Record<string, string>>('KQ4');
  const L = pLimits(D.dec(i.pbar), i.n);
  it('σp, UCL, raw LCL and LCL clipped to 0', () => {
    expectGolden(L.sigma, e.sigmaP!, 'σp');
    expectGolden(L.ucl, e.ucl!, 'UCL');
    expectGolden(L.lclRaw, e.lclRaw!, 'LCL raw');
    expect(L.lcl).toBe(0);
  });
});

describe('golden KQ6 — Pareto', () => {
  const { input: i, expected: e } = byId<{ items: [string, string][]; threshold: number; rule: 'crossing' | 'within' }, { total: string; cumPct: string[]; classA: string[] }>('KQ6');
  const r = pareto(i.items.map(([label, v]) => ({ label, value: D.dec(v) })), i.threshold, i.rule);
  it('total and cumulative %', () => {
    expect(D.eq(r.total, D.dec(e.total))).toBe(true);
    r.rows.forEach((row, k) => expectGolden(D.toNumber(row.cumPct), e.cumPct[k]!, `cum ${k}`));
    expect(D.eq(r.rows[r.rows.length - 1]!.cumPct, D.q(100))).toBe(true);
  });
  it('class A', () => expect(r.classA).toEqual(e.classA));
});

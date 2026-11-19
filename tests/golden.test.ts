import * as D from '../src/core/decimal';
import { describe as describeDs } from '../src/core/descriptive';
import { populationDefects } from '../src/core/normal';
import type { Dataset } from '../src/core/model';
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

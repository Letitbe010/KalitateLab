import fc from 'fast-check';
import * as D from '../src/core/decimal';
import { countSample, describe as describeDs, frequencyTable, moments, pctSample, weightedPoints } from '../src/core/descriptive';
import { pctSampleB, shortcut, welford } from '../src/core/descriptiveAlt';
import type { Dataset } from '../src/core/model';

const dec = D.dec;
const S = D.toString;

/** Random measurement data: values with 1–3 decimals around a nominal. */
const valuesArb = fc
  .tuple(fc.integer({ min: 0, max: 3 }), fc.array(fc.integer({ min: -5000, max: 5000 }), { minLength: 2, maxLength: 60 }))
  .map(([digits, ks]): Dataset => ({ kind: 'values', unit: 'mm', values: ks.map((k) => D.q(k, 10 ** digits)) }));

const freqArb = fc.array(fc.integer({ min: 0, max: 12 }), { minLength: 2, maxLength: 9 }).filter((fs) => fs.reduce((a, b) => a + b, 0) >= 2).map(
  (fs): Dataset => ({
    kind: 'freq',
    unit: 'mm',
    classes: fs.map((f, i) => ({ x: D.add(dec('23,3'), D.q(i, 10)), f })),
  }),
);

describe('descriptive: KQ5-style frequency table by hand', () => {
  const ds: Dataset = {
    kind: 'freq',
    unit: 'mm',
    classes: [
      { x: dec('23,3'), f: 2 },
      { x: dec('23,4'), f: 5 },
      { x: dec('23,5'), f: 10 },
      { x: dec('23,6'), f: 6 },
      { x: dec('23,7'), f: 2 },
    ],
  };
  it('mean is exact and both deviations are reported', () => {
    const r = describeDs(ds);
    expect(r.n).toBe(25);
    expect(S(r.mean)).toBe(S(dec('23,504')));
    // SS = 0.2696 exactly → σ² = 0.010784, s² = 0.011233...
    expect(S(r.ss)).toBe(S(dec('0,2696')));
    expect(r.sigma).toBeCloseTo(0.10385, 5);
    expect(r.s).toBeCloseTo(0.10599, 5);
  });
  it('% of the sample with strict and inclusive bounds', () => {
    expect(S(pctSample(ds, 'lt', dec('23,4')))).toBe('8');
    expect(S(pctSample(ds, 'le', dec('23,4')))).toBe('28');
    expect(S(pctSample(ds, 'lt', dec('23,3')))).toBe('0');
    expect(S(pctSample(ds, 'gt', dec('23,6')))).toBe('8');
  });
});

describe('descriptive: interval classes', () => {
  const ds: Dataset = {
    kind: 'freq',
    unit: 'mm',
    classes: [
      { a: dec('10'), b: dec('12'), f: 3 },
      { a: dec('12'), b: dec('14'), f: 5 },
      { a: dec('14'), b: dec('16'), f: 2 },
    ],
  };
  it('uses the midpoint as class mark', () => {
    expect(weightedPoints(ds).map((p) => S(p.x))).toEqual(['11', '13', '15']);
    expect(S(describeDs(ds).mean)).toBe(S(dec('12,8')));
  });
  it('counts whole classes and refuses a bound inside a class', () => {
    expect(countSample(ds, 'lt', dec('14'))).toEqual({ count: 8, n: 10 });
    expect(countSample(ds, 'ge', dec('14'))).toEqual({ count: 2, n: 10 });
    expect(() => countSample(ds, 'lt', dec('13'))).toThrow();
  });
});

describe('descriptive: solver A = solver B exactly', () => {
  it('Welford and shortcut equal the two-pass definition (values)', () => {
    fc.assert(
      fc.property(valuesArb, (ds) => {
        const a = moments(weightedPoints(ds));
        const w = welford(ds);
        const s = shortcut(ds);
        return D.eq(a.mean, w.mean) && D.eq(a.mean, s.mean) && D.eq(a.ss, w.ss) && D.eq(a.ss, s.ss) && a.n === w.n;
      }),
    );
  });
  it('… and on frequency tables', () => {
    fc.assert(
      fc.property(freqArb, (ds) => {
        const a = moments(weightedPoints(ds).filter((p) => p.f > 0));
        const w = welford(ds);
        return D.eq(a.mean, w.mean) && D.eq(a.ss, w.ss);
      }),
    );
  });
  it('% of the sample: A (by classes) = B (datum by datum)', () => {
    fc.assert(
      fc.property(freqArb, fc.integer({ min: 0, max: 9 }), (ds, k) => {
        const bound = D.add(dec('23,3'), D.q(k, 10));
        return (
          D.eq(pctSample(ds, 'lt', bound), pctSampleB(ds, (x) => D.lt(x, bound))) &&
          D.eq(pctSample(ds, 'ge', bound), pctSampleB(ds, (x) => !D.lt(x, bound)))
        );
      }),
    );
  });
});

describe('descriptive: properties (spec §11.1)', () => {
  it('adding a constant shifts x̄ and leaves s unchanged', () => {
    fc.assert(
      fc.property(valuesArb, fc.integer({ min: -1000, max: 1000 }), (ds, c) => {
        if (ds.kind !== 'values') return true;
        const k = D.q(c, 10);
        const a = describeDs(ds);
        const b = describeDs({ ...ds, values: ds.values.map((x) => D.add(x, k)) });
        return D.eq(b.mean, D.add(a.mean, k)) && D.eq(a.ss, b.ss);
      }),
    );
  });
  it('multiplying by k scales s by |k| (variance by k²)', () => {
    fc.assert(
      fc.property(valuesArb, fc.integer({ min: -20, max: 20 }).filter((k) => k !== 0), (ds, k) => {
        if (ds.kind !== 'values') return true;
        const K = D.q(k);
        const a = describeDs(ds);
        const b = describeDs({ ...ds, values: ds.values.map((x) => D.mul(x, K)) });
        return D.eq(b.varPop, D.mul(a.varPop, D.mul(K, K))) && Math.abs(b.s - Math.abs(k) * a.s) <= 1e-12 * Math.max(1, b.s);
      }),
    );
  });
  it('s ≥ σ and s/σ = √(n/(n−1))', () => {
    fc.assert(
      fc.property(valuesArb, (ds) => {
        const r = describeDs(ds);
        if (r.sigma === 0) return r.s === 0;
        return r.s >= r.sigma && Math.abs(r.s / r.sigma - Math.sqrt(r.n / (r.n - 1))) < 1e-12;
      }),
    );
  });
});

describe('descriptive: frequency table builder', () => {
  it('groups, sorts and accumulates', () => {
    const t = frequencyTable(['23,5', '23,4', '23,5', '23,6'].map(dec));
    expect(t.map((r) => [S(r.x), r.f, r.cum])).toEqual([
      ['117/5', 1, 1],
      ['47/2', 2, 3],
      ['118/5', 1, 4],
    ]);
  });
});

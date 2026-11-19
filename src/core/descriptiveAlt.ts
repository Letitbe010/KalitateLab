/**
 * Solver B for descriptive statistics (spec §5.2): algorithms independent of solver A.
 *
 * - Welford's online update, one datum at a time (frequencies expanded), in exact rationals.
 * - The "textbook" shortcut SS = Σx² − (Σx)²/n, also exact.
 * Both must equal solver A exactly (rationals, no tolerance).
 *
 * This file deliberately does not import descriptive.ts.
 */
import * as D from './decimal';
import type { Decimal } from './decimal';
import type { Dataset } from './model';

function* expand(ds: Dataset): Generator<Decimal> {
  if (ds.kind === 'values') {
    yield* ds.values;
  } else if (ds.kind === 'subgroups') {
    for (const g of ds.groups) yield* g;
  } else if (ds.kind === 'freq') {
    for (const c of ds.classes) {
      const x = c.x ?? (c.a && c.b ? D.mul(D.add(c.a, c.b), D.q(1, 2)) : null);
      if (!x) throw new Error('Frequency class needs x or both a and b');
      for (let i = 0; i < c.f; i++) yield x;
    }
  } else {
    throw new Error(`Dataset kind "${ds.kind}" has no raw data points`);
  }
}

export interface MomentsB {
  n: number;
  mean: Decimal;
  ss: Decimal;
}

/** Welford: mₖ = mₖ₋₁ + (x − mₖ₋₁)/k; Mₖ = Mₖ₋₁ + (x − mₖ₋₁)(x − mₖ). */
export function welford(ds: Dataset): MomentsB {
  let k = 0;
  let m = D.ZERO;
  let M2 = D.ZERO;
  for (const x of expand(ds)) {
    k += 1;
    const delta = D.sub(x, m);
    m = D.add(m, D.div(delta, D.q(k)));
    M2 = D.add(M2, D.mul(delta, D.sub(x, m)));
  }
  if (k === 0) throw new RangeError('Empty dataset');
  return { n: k, mean: m, ss: M2 };
}

/** Shortcut formula: SS = Σx² − (Σx)²/n. */
export function shortcut(ds: Dataset): MomentsB {
  let n = 0;
  let s1 = D.ZERO;
  let s2 = D.ZERO;
  for (const x of expand(ds)) {
    n += 1;
    s1 = D.add(s1, x);
    s2 = D.add(s2, D.mul(x, x));
  }
  if (n === 0) throw new RangeError('Empty dataset');
  return { n, mean: D.div(s1, D.q(n)), ss: D.sub(s2, D.div(D.mul(s1, s1), D.q(n))) };
}

/** % of the sample, counted datum by datum (only for point data, not interval classes). */
export function pctSampleB(ds: Dataset, test: (x: Decimal) => boolean): Decimal {
  let n = 0;
  let c = 0;
  for (const x of expand(ds)) {
    n += 1;
    if (test(x)) c += 1;
  }
  return D.q(100 * c, n);
}

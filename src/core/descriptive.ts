/**
 * Solver A for descriptive statistics (spec §3, §5.1): direct formulas on exact rationals.
 *
 * x̄ = Σfᵢxᵢ / n, SS = Σfᵢ(xᵢ − x̄)², σ² = SS/n (population), s² = SS/(n − 1) (sample).
 * In interval classes the class mark is the midpoint (a + b)/2.
 */
import * as D from './decimal';
import type { Decimal } from './decimal';
import type { BoundSide, Dataset, FreqClass } from './model';

/** A weighted point: value x repeated f times. */
export interface Weighted {
  x: Decimal;
  f: number;
}

/** Class mark of a frequency class: x, or the midpoint of [a, b). */
export function classMark(c: FreqClass): Decimal {
  if (c.x) return c.x;
  if (c.a && c.b) return D.div(D.add(c.a, c.b), D.q(2));
  throw new Error('Frequency class needs x or both a and b');
}

/** Flattens any numeric dataset to weighted points (values, freq, subgroups). */
export function weightedPoints(ds: Dataset): Weighted[] {
  switch (ds.kind) {
    case 'values':
      return ds.values.map((x) => ({ x, f: 1 }));
    case 'freq':
      return ds.classes.map((c) => {
        if (!Number.isInteger(c.f) || c.f < 0) throw new RangeError(`Invalid frequency ${c.f}`);
        return { x: classMark(c), f: c.f };
      });
    case 'subgroups':
      return ds.groups.flat().map((x) => ({ x, f: 1 }));
    default:
      throw new Error(`Dataset kind "${ds.kind}" has no raw data points`);
  }
}

export interface Moments {
  n: number;
  sum: Decimal;
  mean: Decimal;
  /** Σf(x − x̄)², exact. */
  ss: Decimal;
  /** σ² = SS/n */
  varPop: Decimal;
  /** s² = SS/(n − 1); null when n = 1. */
  varSample: Decimal | null;
}

export function moments(pts: Weighted[]): Moments {
  let n = 0;
  let sum = D.ZERO;
  for (const { x, f } of pts) {
    n += f;
    sum = D.add(sum, D.mul(x, D.q(f)));
  }
  if (n === 0) throw new RangeError('Empty dataset');
  const mean = D.div(sum, D.q(n));
  let ss = D.ZERO;
  for (const { x, f } of pts) {
    const d = D.sub(x, mean);
    ss = D.add(ss, D.mul(D.q(f), D.mul(d, d)));
  }
  return {
    n,
    sum,
    mean,
    ss,
    varPop: D.div(ss, D.q(n)),
    varSample: n > 1 ? D.div(ss, D.q(n - 1)) : null,
  };
}

export interface Descriptive extends Moments {
  /** σₙ (population, divides by n) */
  sigma: number;
  /** sₙ₋₁ (sample, divides by n − 1); NaN when n = 1. */
  s: number;
  min: Decimal;
  max: Decimal;
  range: Decimal;
}

export function describe(ds: Dataset): Descriptive {
  const pts = weightedPoints(ds).filter((p) => p.f > 0);
  const m = moments(pts);
  let lo = pts[0]!.x;
  let hi = pts[0]!.x;
  for (const { x } of pts) {
    if (D.lt(x, lo)) lo = x;
    if (D.gt(x, hi)) hi = x;
  }
  return {
    ...m,
    sigma: D.sqrtToNumber(m.varPop),
    s: m.varSample ? D.sqrtToNumber(m.varSample) : Number.NaN,
    min: lo,
    max: hi,
    range: D.sub(hi, lo),
  };
}

/** Does value x satisfy "x <side> bound"? */
export function satisfies(x: Decimal, side: BoundSide, bound: Decimal): boolean {
  const c = D.cmp(x, bound);
  switch (side) {
    case 'lt':
      return c < 0;
    case 'le':
      return c <= 0;
    case 'gt':
      return c > 0;
    case 'ge':
      return c >= 0;
  }
}

/**
 * Count of data in the sample that satisfy "x <side> bound" (spec §3: % in the sample is a
 * direct count). For interval classes [a, b) the whole class must lie on one side of the
 * bound; a bound strictly inside a class cannot be counted and throws.
 */
export function countSample(ds: Dataset, side: BoundSide, bound: Decimal): { count: number; n: number } {
  let count = 0;
  let n = 0;
  if (ds.kind === 'freq') {
    for (const c of ds.classes) {
      n += c.f;
      if (c.x) {
        if (satisfies(c.x, side, bound)) count += c.f;
        continue;
      }
      if (!c.a || !c.b) throw new Error('Frequency class needs x or both a and b');
      const below = side === 'lt' || side === 'le';
      // [a, b): fully below the bound if b ≤ bound, fully above if a ≥ bound
      if (D.cmp(c.b, bound) <= 0) {
        if (below) count += c.f;
      } else if (D.cmp(c.a, bound) >= 0) {
        if (!below) count += c.f;
      } else {
        throw new RangeError('The bound falls inside an interval class: the sample count is undefined');
      }
    }
    return { count, n };
  }
  for (const { x, f } of weightedPoints(ds)) {
    n += f;
    if (satisfies(x, side, bound)) count += f;
  }
  return { count, n };
}

/** % of the sample (exact rational, in percent). */
export function pctSample(ds: Dataset, side: BoundSide, bound: Decimal): Decimal {
  const { count, n } = countSample(ds, side, bound);
  return D.div(D.q(100 * count), D.q(n));
}

/** Frequency table of raw values: distinct values ascending, with f, relative and cumulative f. */
export function frequencyTable(values: Decimal[]): { x: Decimal; f: number; cum: number; rel: Decimal }[] {
  const sorted = [...values].sort(D.cmp);
  const out: { x: Decimal; f: number; cum: number; rel: Decimal }[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && D.eq(last.x, v)) last.f += 1;
    else out.push({ x: v, f: 1, cum: 0, rel: D.ZERO });
  }
  let cum = 0;
  for (const row of out) {
    cum += row.f;
    row.cum = cum;
    row.rel = D.q(row.f, sorted.length);
  }
  return out;
}

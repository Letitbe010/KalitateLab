/**
 * Solver B for out-of-control points (spec §5.2): a second, differently written check.
 *
 * Attribute charts are decided EXACTLY, without square roots:
 *   point x is above UCL ⇔ x − CL > 0 and (x − CL)² > 9·var
 *   point x is below LCL ⇔ CL − x > 0 and (CL − x)² > 9·var   (a clipped LCL = 0 can never be crossed)
 * X̄-R limits are recomputed from the table as w = A₂R̄ and compared through |x − CL| > w.
 * This file does not import charts.ts.
 */
import { constants } from './constants';
import * as D from './decimal';
import type { Decimal } from './decimal';
import type { ChartKind } from './model';

function beyond(x: Decimal, cl: Decimal, variance: Decimal): boolean {
  const d = D.sub(x, cl);
  return !D.isZero(d) && D.gt(D.mul(d, d), D.mul(D.q(9), variance));
}

export function attributeOutB(chart: ChartKind, samples: { n: number; defects: number }[]): number[] {
  const N = samples.reduce((a, s) => a + s.n, 0);
  const T = samples.reduce((a, s) => a + s.defects, 0);
  const res: number[] = [];
  samples.forEach((s, i) => {
    let x: Decimal;
    let cl: Decimal;
    let v: Decimal;
    if (chart === 'p') {
      cl = D.q(T, N);
      x = D.q(s.defects, s.n);
      v = D.div(D.mul(cl, D.sub(D.ONE, cl)), D.q(s.n));
    } else if (chart === 'np') {
      const p = D.q(T, N);
      cl = D.mul(p, D.q(s.n));
      x = D.q(s.defects);
      v = D.mul(cl, D.sub(D.ONE, p));
    } else if (chart === 'c') {
      cl = D.q(T, samples.length);
      x = D.q(s.defects);
      v = cl;
    } else {
      cl = D.q(T, N);
      x = D.q(s.defects, s.n);
      v = D.div(cl, D.q(s.n));
    }
    if (beyond(x, cl, v)) res.push(i + 1);
  });
  return res;
}

/** X̄-R out-of-control points, written independently of charts.ts. */
export function xbarROutB(groups: Decimal[][]): { outXbar: number[]; outR: number[] } {
  const n = groups[0]!.length;
  const k = constants(n);
  const stats = groups.map((g) => {
    const sorted = [...g].sort(D.cmp);
    return { m: D.mul(D.sum(g), D.q(1, n)), r: D.sub(sorted[n - 1]!, sorted[0]!) };
  });
  const xbb = D.mul(D.sum(stats.map((s) => s.m)), D.q(1, groups.length));
  const rbar = D.mul(D.sum(stats.map((s) => s.r)), D.q(1, groups.length));
  const w = D.mul(k.A2, rbar);
  const outXbar: number[] = [];
  const outR: number[] = [];
  stats.forEach((s, i) => {
    if (D.gt(D.abs(D.sub(s.m, xbb)), w)) outXbar.push(i + 1);
    if (D.gt(s.r, D.mul(k.D4, rbar)) || D.lt(s.r, D.mul(k.D3, rbar))) outR.push(i + 1);
  });
  return { outXbar, outR };
}

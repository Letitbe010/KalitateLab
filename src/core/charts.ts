/**
 * Control charts (spec §3):
 *   X̄-R: X̿ ± A₂R̄; R: D₃R̄, D₄R̄.   X̄-s: X̿ ± A₃s̄; s: B₃s̄, B₄s̄.
 *   p: p̄ ± 3√(p̄(1 − p̄)/n); np: np̄ ± 3√(np̄(1 − p̄)); c: c̄ ± 3√c̄; u: ū ± 3√(ū/n).
 * A negative LCL is set to 0 (lclRaw keeps the computed value for the diagnosis).
 * Out of control (v1): a point strictly beyond a limit. A point exactly on a limit is in control.
 *
 * X̄-R limits are exact rationals (table constants). Point numbering is 1-based, as in exams.
 */
import { rangeOf } from './capability';
import { constants } from './constants';
import * as D from './decimal';
import type { Decimal } from './decimal';
import { describe as describeDs } from './descriptive';
import type { ChartKind } from './model';

export interface ExactLimits {
  cl: Decimal;
  ucl: Decimal;
  lcl: Decimal;
  lclRaw: Decimal;
}

export interface Limits {
  cl: number;
  ucl: number;
  lcl: number;
  lclRaw: number;
}

export function xbarRLimits(xbarbar: Decimal, rbar: Decimal, n: number): { xbar: ExactLimits; R: ExactLimits; sigmaHat: Decimal } {
  const k = constants(n);
  const w = D.mul(k.A2, rbar);
  const lclR = D.mul(k.D3, rbar);
  const lclX = D.sub(xbarbar, w);
  return {
    xbar: { cl: xbarbar, ucl: D.add(xbarbar, w), lcl: lclX, lclRaw: lclX },
    R: { cl: rbar, ucl: D.mul(k.D4, rbar), lcl: lclR, lclRaw: lclR },
    sigmaHat: D.div(rbar, k.d2),
  };
}

function equalGroups(groups: Decimal[][]): number {
  const n = groups[0]?.length ?? 0;
  if (groups.length === 0 || groups.some((g) => g.length !== n)) throw new Error('All subgroups must have the same size');
  return n;
}

/** 1-based indices of values strictly outside [lcl, ucl]. */
function outsideExact(values: Decimal[], lim: ExactLimits): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    if (D.gt(v, lim.ucl) || D.lt(v, lim.lcl)) out.push(i + 1);
  });
  return out;
}

function outsideNum(values: number[], lims: Limits[]): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    const l = lims[i]!;
    if (v > l.ucl || v < l.lcl) out.push(i + 1);
  });
  return out;
}

export interface XbarRChart {
  n: number;
  means: Decimal[];
  ranges: Decimal[];
  xbarbar: Decimal;
  rbar: Decimal;
  xbar: ExactLimits;
  R: ExactLimits;
  sigmaHat: Decimal;
  outXbar: number[];
  outR: number[];
}

export function xbarRChart(groups: Decimal[][]): XbarRChart {
  const n = equalGroups(groups);
  const means = groups.map((g) => D.div(D.sum(g), D.q(n)));
  const ranges = groups.map(rangeOf);
  const xbarbar = D.div(D.sum(means), D.q(groups.length));
  const rbar = D.div(D.sum(ranges), D.q(groups.length));
  const lim = xbarRLimits(xbarbar, rbar, n);
  return { n, means, ranges, xbarbar, rbar, ...lim, outXbar: outsideExact(means, lim.xbar), outR: outsideExact(ranges, lim.R) };
}

export function xbarSLimits(xbarbar: Decimal, sbar: number, n: number): { xbar: Limits; s: Limits; sigmaHat: number } {
  const k = constants(n);
  const A3 = D.toNumber(k.A3);
  const xb = D.toNumber(xbarbar);
  const lclS = D.toNumber(k.B3) * sbar;
  return {
    xbar: { cl: xb, ucl: xb + A3 * sbar, lcl: xb - A3 * sbar, lclRaw: xb - A3 * sbar },
    s: { cl: sbar, ucl: D.toNumber(k.B4) * sbar, lcl: lclS, lclRaw: lclS },
    sigmaHat: sbar / D.toNumber(k.c4),
  };
}

export interface XbarSChart {
  n: number;
  means: Decimal[];
  sds: number[];
  xbarbar: Decimal;
  sbar: number;
  xbar: Limits;
  s: Limits;
  sigmaHat: number;
  outXbar: number[];
  outS: number[];
}

export function xbarSChart(groups: Decimal[][]): XbarSChart {
  const n = equalGroups(groups);
  const means = groups.map((g) => D.div(D.sum(g), D.q(n)));
  const sds = groups.map((g) => describeDs({ kind: 'values', values: g, unit: '' }).s);
  const xbarbar = D.div(D.sum(means), D.q(groups.length));
  const sbar = sds.reduce((a, b) => a + b, 0) / sds.length;
  const lim = xbarSLimits(xbarbar, sbar, n);
  const k = groups.length;
  return {
    n,
    means,
    sds,
    xbarbar,
    sbar,
    ...lim,
    outXbar: outsideNum(means.map(D.toNumber), Array(k).fill(lim.xbar)),
    outS: outsideNum(sds, Array(k).fill(lim.s)),
  };
}

// ------------------------------------------------------------ attributes

/** Limits from a centre line and an exact variance: CL ± 3√var, LCL clipped to 0. */
function fromVariance(cl: Decimal, variance: Decimal): Limits & { sigma: number } {
  const sigma = D.sqrtToNumber(variance);
  const c = D.toNumber(cl);
  const lclRaw = c - 3 * sigma;
  return { cl: c, ucl: c + 3 * sigma, lclRaw, lcl: Math.max(0, lclRaw), sigma };
}

export const pLimits = (pbar: Decimal, n: number) => fromVariance(pbar, D.div(D.mul(pbar, D.sub(D.ONE, pbar)), D.q(n)));
export const npLimits = (pbar: Decimal, n: number) => fromVariance(D.mul(D.q(n), pbar), D.mul(D.mul(D.q(n), pbar), D.sub(D.ONE, pbar)));
export const cLimits = (cbar: Decimal) => fromVariance(cbar, cbar);
export const uLimits = (ubar: Decimal, n: number) => fromVariance(ubar, D.div(ubar, D.q(n)));

export interface AttributeChart {
  chart: ChartKind;
  /** p̄, np̄, c̄ or ū (exact) */
  center: Decimal;
  /** plotted statistic per sample (exact): p = d/n, np = d, c = defects, u = defects/n */
  points: Decimal[];
  /** limits per sample (identical when n is constant) */
  limits: (Limits & { sigma: number })[];
  out: number[];
}

/**
 * p, np, c, u charts from samples {n, defects}. "defects" is the number of defective
 * units (p, np) or the number of defects (c, u). p and u allow variable n (limits per sample);
 * np and c need a constant n (c: constant inspection unit).
 */
export function attributeChart(chart: ChartKind, samples: { n: number; defects: number }[]): AttributeChart {
  if (samples.length === 0) throw new Error('No samples');
  for (const s of samples) {
    if (!Number.isInteger(s.n) || !Number.isInteger(s.defects) || s.n <= 0 || s.defects < 0) throw new RangeError('Invalid sample');
    if ((chart === 'p' || chart === 'np') && s.defects > s.n) throw new RangeError('More defectives than units');
  }
  const N = samples.reduce((a, s) => a + s.n, 0);
  const totalD = samples.reduce((a, s) => a + s.defects, 0);
  const constN = samples.every((s) => s.n === samples[0]!.n);
  if ((chart === 'np' || chart === 'c') && !constN) throw new Error(`${chart} chart needs a constant sample size`);
  let center: Decimal;
  let points: Decimal[];
  let limits: (Limits & { sigma: number })[];
  switch (chart) {
    case 'p': {
      center = D.q(totalD, N);
      points = samples.map((s) => D.q(s.defects, s.n));
      limits = samples.map((s) => pLimits(center, s.n));
      break;
    }
    case 'np': {
      const n = samples[0]!.n;
      const pbar = D.q(totalD, N);
      center = D.mul(D.q(n), pbar);
      points = samples.map((s) => D.q(s.defects));
      limits = samples.map(() => npLimits(pbar, n));
      break;
    }
    case 'c': {
      center = D.q(totalD, samples.length);
      points = samples.map((s) => D.q(s.defects));
      limits = samples.map(() => cLimits(center));
      break;
    }
    case 'u': {
      center = D.q(totalD, N);
      points = samples.map((s) => D.q(s.defects, s.n));
      limits = samples.map((s) => uLimits(center, s.n));
      break;
    }
  }
  return { chart, center, points, limits, out: outsideNum(points.map(D.toNumber), limits) };
}

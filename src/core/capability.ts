/**
 * Process capability (spec §3):
 *   Cp = (USL − LSL)/(6σ), Cpu = (USL − μ)/(3σ), Cpl = (μ − LSL)/(3σ), Cpk = min(Cpu, Cpl).
 * σ̂: s of all data, R̄/d₂ or s̄/c₄ (table constants), as the exercise states.
 */
import { constants } from './constants';
import * as D from './decimal';
import type { Decimal } from './decimal';
import { describe as describeDs } from './descriptive';
import type { Dataset, SigmaHatRule, Spec } from './model';

export interface Capability {
  cp?: number;
  cpu?: number;
  cpl?: number;
  /** min of the indices available (one-sided specs give only Cpu or Cpl). */
  cpk: number;
  /** 'yes' when μ is exactly at the middle of the tolerance; else the side μ is shifted towards. */
  centered?: 'yes' | 'USL' | 'LSL';
}

export function capability(spec: Spec, mu: Decimal, sigma: number): Capability {
  if (!(sigma > 0)) throw new RangeError('σ must be > 0');
  const { lsl, usl } = spec;
  if (!lsl && !usl) throw new Error('Capability needs at least one specification limit');
  const out: Partial<Capability> = {};
  if (usl) out.cpu = D.toNumber(D.sub(usl, mu)) / (3 * sigma);
  if (lsl) out.cpl = D.toNumber(D.sub(mu, lsl)) / (3 * sigma);
  if (usl && lsl) {
    if (!D.gt(usl, lsl)) throw new RangeError('USL must be greater than LSL');
    out.cp = D.toNumber(D.sub(usl, lsl)) / (6 * sigma);
    const mid = D.div(D.add(usl, lsl), D.q(2));
    const c = D.cmp(mu, mid);
    out.centered = c === 0 ? 'yes' : c > 0 ? 'USL' : 'LSL';
  }
  out.cpk = Math.min(out.cpu ?? Infinity, out.cpl ?? Infinity);
  return out as Capability;
}

export type CapableVerdict = 'not' | 'marginal' | 'capable';

/** Interpretation with explicit thresholds (default [1, 1.33]): Cp < t₁ not, t₁ ≤ Cp < t₂ marginal, Cp ≥ t₂ capable. */
export function capableVerdict(index: number, thresholds: [number, number] = [1, 1.33]): CapableVerdict {
  const [t1, t2] = thresholds;
  if (index < t1) return 'not';
  if (index < t2) return 'marginal';
  return 'capable';
}

export interface SigmaHat {
  value: number;
  rule: SigmaHatRule;
  /** R̄ (exact) or s̄, and the constant used, for the solution steps */
  rbar?: Decimal;
  sbar?: number;
  constant?: Decimal;
  n?: number;
}

function equalGroups(ds: Dataset): Decimal[][] {
  if (ds.kind !== 'subgroups') throw new Error('R̄/d₂ and s̄/c₄ need subgroups');
  const n = ds.groups[0]?.length ?? 0;
  if (ds.groups.length === 0 || ds.groups.some((g) => g.length !== n)) throw new Error('All subgroups must have the same size');
  return ds.groups;
}

/** Range of a subgroup (exact). */
export function rangeOf(g: Decimal[]): Decimal {
  let lo = g[0]!;
  let hi = g[0]!;
  for (const x of g) {
    if (D.lt(x, lo)) lo = x;
    if (D.gt(x, hi)) hi = x;
  }
  return D.sub(hi, lo);
}

export function sigmaHat(ds: Dataset, rule: Exclude<SigmaHatRule, 'either'>): SigmaHat {
  if (rule === 's') return { value: describeDs(ds).s, rule };
  const groups = equalGroups(ds);
  const n = groups[0]!.length;
  const k = constants(n);
  if (rule === 'Rbar/d2') {
    const rbar = D.div(D.sum(groups.map(rangeOf)), D.q(groups.length));
    return { value: D.toNumber(D.div(rbar, k.d2)), rule, rbar, constant: k.d2, n };
  }
  const sbar = groups.reduce((acc, g) => acc + describeDs({ kind: 'values', values: g, unit: '' }).s, 0) / groups.length;
  return { value: sbar / D.toNumber(k.c4), rule, sbar, constant: k.c4, n };
}

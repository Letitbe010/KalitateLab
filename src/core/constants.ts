/**
 * SPC constants (spec §3): the printed table the student uses (src/data/constants.json)
 * and an independent first-principles computation used to check it (spec §5.2).
 *
 * The solvers always use the TABLE values (user decision 2026-11-19): the expected answer
 * is what the student gets with the exam table.
 */
import table from '../data/constants.json';
import * as D from './decimal';
import type { Decimal } from './decimal';
import { density, phi } from './normal';

export type ConstName = 'A2' | 'A3' | 'B3' | 'B4' | 'D3' | 'D4' | 'd2' | 'd3' | 'c4';
export const CONST_NAMES: ConstName[] = ['A2', 'A3', 'B3', 'B4', 'D3', 'D4', 'd2', 'd3', 'c4'];
export const N_MIN = 2;
export const N_MAX = 25;

export type Constants = Record<ConstName, Decimal>;

/** Exact table values for subgroup size n (2…25). */
export function constants(n: number): Constants {
  if (!Number.isInteger(n) || n < N_MIN || n > N_MAX) throw new RangeError(`SPC constants are tabulated for n = 2…25 (got ${n})`);
  const row = (table.n as Record<string, Record<ConstName, string>>)[String(n)];
  if (!row) throw new Error(`constants.json has no row for n = ${n}`);
  const out = {} as Constants;
  for (const k of CONST_NAMES) out[k] = D.dec(row[k]);
  return out;
}

/** Table value as text, exactly as printed (for the solution steps). */
export function constantText(n: number, k: ConstName): string {
  return (table.n as Record<string, Record<ConstName, string>>)[String(n)]![k];
}

// ------------------------------------------------------------ first principles

function simpsonWeights(m: number): number[] {
  return Array.from({ length: m + 1 }, (_, i) => (i === 0 || i === m ? 1 : i % 2 ? 4 : 2));
}

/** d₂ = E[R]/σ = ∫ [1 − Φ(x)ⁿ − (1 − Φ(x))ⁿ] dx. */
export function d2Exact(n: number, m = 4000): number {
  const a = -10;
  const b = 10;
  const h = (b - a) / m;
  const w = simpsonWeights(m);
  let s = 0;
  for (let i = 0; i <= m; i++) {
    const P = phi(a + i * h);
    s += w[i]! * (1 - P ** n - (1 - P) ** n);
  }
  return (s * h) / 3;
}

/**
 * d₃ = sd(R)/σ from the joint density of (min, range), on a rectangle (x, r) so Simpson's
 * rule stays exact-order (a triangle cut along the diagonal would break it):
 * f(x, r) = n(n−1)φ(x)φ(x + r)[Φ(x + r) − Φ(x)]ⁿ⁻², r > 0;  E[Rᵏ] = ∬ rᵏ f dx dr.
 */
export function d3Exact(n: number, m = 640): number {
  const a = -8;
  const b = 8;
  const rmax = 16;
  const hx = (b - a) / m;
  const hr = rmax / m;
  const w = simpsonWeights(m);
  const xs = Array.from({ length: m + 1 }, (_, i) => a + i * hx);
  const Px = xs.map(phi);
  const Fx = xs.map(density);
  let e1 = 0;
  let e2 = 0;
  for (let j = 1; j <= m; j++) {
    const r = j * hr;
    let inner = 0;
    for (let i = 0; i <= m; i++) {
      const y = xs[i]! + r;
      inner += w[i]! * Fx[i]! * density(y) * (phi(y) - Px[i]!) ** (n - 2);
    }
    e1 += w[j]! * inner * r;
    e2 += w[j]! * inner * r * r;
  }
  const k = n * (n - 1) * (hx / 3) * (hr / 3);
  e1 *= k;
  e2 *= k;
  return Math.sqrt(e2 - e1 * e1);
}

/** Γ(k/2) for a positive integer k, in closed form. */
function gammaHalf(k: number): number {
  if (k % 2 === 0) {
    let g = 1;
    for (let i = 2; i < k / 2; i++) g *= i;
    return g; // (k/2 − 1)!
  }
  let g = Math.sqrt(Math.PI);
  for (let i = 1; i < k; i += 2) g *= i / 2; // Γ(1/2)·(1/2)(3/2)…
  return g;
}

/** c₄ = √(2/(n−1)) · Γ(n/2) / Γ((n−1)/2). */
export function c4Exact(n: number): number {
  return Math.sqrt(2 / (n - 1)) * (gammaHalf(n) / gammaHalf(n - 1));
}

/** All constants from first principles (unrounded). */
export function firstPrinciples(n: number, d2 = d2Exact(n), d3 = d3Exact(n)): Record<ConstName, number> {
  const c4 = c4Exact(n);
  const k = (3 * Math.sqrt(1 - c4 * c4)) / c4;
  return {
    d2,
    d3,
    c4,
    A2: 3 / (d2 * Math.sqrt(n)),
    A3: 3 / (c4 * Math.sqrt(n)),
    D3: Math.max(0, 1 - (3 * d3) / d2),
    D4: 1 + (3 * d3) / d2,
    B3: Math.max(0, 1 - k),
    B4: 1 + k,
  };
}

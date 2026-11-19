/**
 * Standard normal distribution (spec §3, §5.1, §5.2).
 *
 * Solver A: erf by its all-positive power series for |x| < 3 and erfc by its continued
 *           fraction for x ≥ 2 (accurate relative values in the far tail, for ppm).
 * Solver B: adaptive Simpson integration of the density φ (independent of erf).
 * Spec requirement: |A − B| < 1e-10.
 */

const SQRT2 = Math.SQRT2;
const SQRT_PI = Math.sqrt(Math.PI);
const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** erf(x) for 0 ≤ x < 3: erf(x) = 2/√π·e^(−x²)·Σ 2ⁿx^(2n+1)/(1·3·…·(2n+1)). No cancellation. */
function erfSeries(x: number): number {
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n < 500; n++) {
    term *= (2 * x2) / (2 * n + 1);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return (2 / SQRT_PI) * Math.exp(-x2) * sum;
}

/** erfc(x) for x ≥ 2 (switch point chosen so the tail is accurate to ~1e-14 relative; 1 − erf would lose digits): e^(−x²)/√π · 1/(x + ½/(x + 1/(x + (3/2)/(x + 2/(x + …))))). */
function erfcContinuedFraction(x: number): number {
  let f = x;
  for (let k = 200; k >= 1; k--) f = x + k / 2 / f;
  return Math.exp(-x * x) / SQRT_PI / f;
}

/** Complementary error function erfc(x) = 1 − erf(x), accurate (relative) for large x. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2) return 1 - erfSeries(x);
  return erfcContinuedFraction(x);
}

export function erf(x: number): number {
  if (x < 0) return -erf(-x);
  if (x < 3) return erfSeries(x);
  return 1 - erfcContinuedFraction(x);
}

/** Solver A: Φ(z) = P(Z ≤ z). */
export function phi(z: number): number {
  return z < 0 ? 0.5 * erfc(-z / SQRT2) : 1 - 0.5 * erfc(z / SQRT2);
}

/** Solver A: upper tail Q(z) = P(Z > z) = 1 − Φ(z), accurate for large z. */
export function upperTail(z: number): number {
  return z > 0 ? 0.5 * erfc(z / SQRT2) : 1 - 0.5 * erfc(-z / SQRT2);
}

/** Standard normal density. */
export function density(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT_2PI;
}

// ---------------------------------------------------------------- solver B

function simpson(a: number, b: number, fa: number, fm: number, fb: number): number {
  return ((b - a) / 6) * (fa + 4 * fm + fb);
}

function adaptive(
  f: (x: number) => number,
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
  whole: number,
  eps: number,
  depth: number,
): number {
  const m = (a + b) / 2;
  const lm = (a + m) / 2;
  const rm = (m + b) / 2;
  const flm = f(lm);
  const frm = f(rm);
  const left = simpson(a, m, fa, flm, fm);
  const right = simpson(m, b, fm, frm, fb);
  const diff = left + right - whole;
  if (depth <= 0 || Math.abs(diff) <= 15 * eps) return left + right + diff / 15;
  return (
    adaptive(f, a, m, fa, flm, fm, left, eps / 2, depth - 1) + adaptive(f, m, b, fm, frm, fb, right, eps / 2, depth - 1)
  );
}

/** ∫ₐᵇ φ(x) dx by adaptive Simpson (Richardson-corrected). */
export function integrateDensity(a: number, b: number, eps = 1e-15): number {
  if (a === b) return 0;
  if (a > b) return -integrateDensity(b, a, eps);
  // Split into unit pieces so the adaptive rule never skips the bell.
  let total = 0;
  const n = Math.max(1, Math.ceil(b - a));
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h;
    const x1 = i === n - 1 ? b : x0 + h;
    const f0 = density(x0);
    const f1 = density(x1);
    const fm = density((x0 + x1) / 2);
    total += adaptive(density, x0, x1, f0, fm, f1, simpson(x0, x1, f0, fm, f1), eps / n, 40);
  }
  return total;
}

/** Solver B: Φ(z) by integrating φ (tails taken on the short side). */
export function phiB(z: number): number {
  if (z <= 0) return integrateDensity(-40, z);
  return 1 - integrateDensity(z, 40);
}

/** Solver B: Q(z) = P(Z > z). */
export function upperTailB(z: number): number {
  // In the tail the tolerance follows the size of the result (relative accuracy for ppm).
  const eps = Math.min(1e-15, density(z) * 1e-14);
  return z >= 0 ? integrateDensity(z, 40, eps) : 1 - integrateDensity(-40, z);
}

// ---------------------------------------------------------------- inverse

/**
 * Φ⁻¹(p): Acklam's rational approximation (rel. error ≈ 1e-9) refined with two Halley
 * steps on solver A, giving full double accuracy.
 */
export function phiInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return Number.NaN;
  }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  for (let i = 0; i < 2; i++) {
    // work on the smaller tail for accuracy
    // e = Φ(x) − p, written as (1 − p) − Q(x) in the upper half
    const e = p < 0.5 ? phi(x) - p : 1 - p - upperTail(x);
    const u = e / density(x);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}

// ---------------------------------------------------------------- % defective in the population

export interface PopulationDefects {
  /** z of each limit given: zL = (LSL − μ)/σ, zU = (USL − μ)/σ */
  zL?: number;
  zU?: number;
  /** fractions (0…1), not percent */
  below?: number;
  above?: number;
  total: number;
}

/**
 * Estimated fraction of defective parts in the population for a normal N(μ, σ) and the given
 * specification limits (spec §3: population % is estimated with the normal, never counted).
 * Continuous distribution: < and ≤ give the same value.
 */
export function populationDefects(mu: number, sigma: number, lsl?: number, usl?: number): PopulationDefects {
  if (!(sigma > 0)) throw new RangeError('σ must be > 0');
  const out: PopulationDefects = { total: 0 };
  if (lsl !== undefined) {
    out.zL = (lsl - mu) / sigma;
    out.below = phi(out.zL);
    out.total += out.below;
  }
  if (usl !== undefined) {
    out.zU = (usl - mu) / sigma;
    out.above = upperTail(out.zU);
    out.total += out.above;
  }
  return out;
}

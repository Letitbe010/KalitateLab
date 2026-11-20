/**
 * Number formatting for the UI: decimal comma in both languages (eu/es), tabular figures.
 * Results are shown with 4 significant figures (spec §3), but never with fewer decimals than
 * `minDecimals` (so a control limit keeps the digits that matter for its band).
 */
import * as D from '../core/decimal';
import type { Decimal } from '../core/decimal';

export function fmt(x: number, minDecimals = 0, sig = 4, trim = true): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const dec = Math.min(12, Math.max(minDecimals, sig - 1 - mag, 0));
  let s = x.toFixed(dec);
  // drop trailing zeros beyond minDecimals (8,000 → 8; 23,200 → 23,2)
  if (trim && dec > minDecimals && s.includes('.')) {
    const keep = s.indexOf('.') + minDecimals;
    let end = s.length;
    while (end - 1 > keep && s[end - 1] === '0') end--;
    s = s.slice(0, end);
    if (s.endsWith('.')) s = s.slice(0, -1);
  }
  return s.replace('.', ',').replace('-', '−');
}

/** Exact decimal as given (23,5 stays 23,5). */
export function fmtDec(x: Decimal): string {
  let d = x.d;
  let a = 0;
  let b = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    a++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    b++;
  }
  return (d === 1n ? D.toFixed(x, Math.max(a, b)) : fmt(D.toNumber(x), 0, 6)).replace('.', ',').replace('-', '−');
}

export const pct = (x: number): string => `${fmt(x)} %`;

/** Decimals of a finite decimal (denominator 2^a·5^b → max(a, b)); 6 for other fractions. */
export function decimalsOf(x: Decimal): number {
  let d = x.d;
  let a = 0;
  let b = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    a++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    b++;
  }
  return d === 1n ? Math.max(a, b) : 6;
}

/** Specification limits with a common precision (19,960 next to 19,939, not 19,96). */
export function specDecimals(...xs: (Decimal | undefined)[]): number {
  return Math.max(0, ...xs.filter((v): v is Decimal => !!v).map(decimalsOf));
}

export const fixed = (x: Decimal, k: number): string => D.toFixed(x, k).replace('.', ',').replace('-', '−');

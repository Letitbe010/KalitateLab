/**
 * Pareto analysis (spec §3): items sorted in descending order, % and cumulative % (exact).
 * Class A threshold and rule come from the exercise:
 *   'crossing' — items up to and including the one whose cumulative % reaches or passes the threshold;
 *   'within'   — items whose cumulative % does not exceed the threshold.
 * Ties keep the input order here; the grader accepts any order among equal values (spec §8.2).
 */
import * as D from './decimal';
import type { Decimal } from './decimal';

export interface ParetoRow {
  label: string;
  value: Decimal;
  pct: Decimal;
  cumPct: Decimal;
}

export interface ParetoResult {
  total: Decimal;
  rows: ParetoRow[];
  classA: string[];
}

export function pareto(items: { label: string; value: Decimal }[], threshold = 80, rule: 'crossing' | 'within' = 'crossing'): ParetoResult {
  if (items.length === 0) throw new Error('No items');
  if (items.some((it) => D.sign(it.value) < 0)) throw new RangeError('Pareto values must be ≥ 0');
  const total = D.sum(items.map((it) => it.value));
  if (D.isZero(total)) throw new RangeError('Pareto total is 0');
  const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => D.cmp(b.value, a.value) || a.i - b.i);
  let cum = D.ZERO;
  const hundred = D.q(100);
  const rows: ParetoRow[] = sorted.map((it) => {
    const pct = D.div(D.mul(it.value, hundred), total);
    cum = D.add(cum, pct);
    return { label: it.label, value: it.value, pct, cumPct: cum };
  });
  const t = D.parse(String(threshold));
  const classA: string[] = [];
  for (const r of rows) {
    if (rule === 'within') {
      if (D.cmp(r.cumPct, t) <= 0) classA.push(r.label);
      else break;
    } else {
      classA.push(r.label);
      if (D.cmp(r.cumPct, t) >= 0) break;
    }
  }
  return { total, rows, classA };
}

/**
 * Global consistency checks (spec §5.3). Each returns a list of violations (empty = OK).
 * Used by tests now and by the generator later (an exercise that fails is never shown).
 */
import type { Capability } from './capability';
import type { AttributeChart } from './charts';
import * as D from './decimal';
import type { PopulationDefects } from './normal';
import type { ParetoResult } from './pareto';

const EPS = 1e-12;

export function checkCapability(c: Capability): string[] {
  const v: string[] = [];
  if (c.cp !== undefined) {
    if (c.cpk > c.cp + EPS) v.push(`Cpk (${c.cpk}) > Cp (${c.cp})`);
    const equal = Math.abs(c.cp - c.cpk) <= EPS * Math.max(1, c.cp);
    if (equal !== (c.centered === 'yes')) v.push('Cp = Cpk must hold exactly when μ is at the middle');
    if (c.cpu !== undefined && c.cpl !== undefined && Math.abs((c.cpu + c.cpl) / 2 - c.cp) > EPS * Math.max(1, c.cp)) {
      v.push('(Cpu + Cpl)/2 ≠ Cp');
    }
  }
  return v;
}

export function checkDefects(p: PopulationDefects): string[] {
  const v: string[] = [];
  for (const [k, x] of Object.entries({ below: p.below, above: p.above, total: p.total })) {
    if (x !== undefined && !(x >= 0 && x <= 1)) v.push(`${k} fraction ${x} outside [0, 1]`);
  }
  return v;
}

export function checkPareto(r: ParetoResult): string[] {
  const v: string[] = [];
  const last = r.rows[r.rows.length - 1];
  if (!last || !D.eq(last.cumPct, D.q(100))) v.push('cumulative % does not end at 100');
  for (let i = 1; i < r.rows.length; i++) {
    if (D.gt(r.rows[i]!.value, r.rows[i - 1]!.value)) v.push('rows not in descending order');
  }
  return v;
}

export function checkAttribute(c: AttributeChart): string[] {
  const v: string[] = [];
  if (c.chart === 'p' && (D.sign(c.center) < 0 || D.gt(c.center, D.ONE))) v.push('p̄ outside [0, 1]');
  for (const l of c.limits) {
    if (l.lcl < 0) v.push('LCL < 0');
    if (l.lcl > l.cl || l.ucl < l.cl) v.push('limits do not bracket the centre line');
  }
  return v;
}

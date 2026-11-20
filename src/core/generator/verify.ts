/**
 * Verification of an exercise before it is shown (spec §5, §10.3). An exercise is rejected when:
 * - a solver throws, or solver A and solver B disagree (descriptive exact, Φ within 1e-10,
 *   out-of-control points);
 * - a global check fails (§5.3);
 * - a common mistake cannot be told apart from the correct answer (§10.3);
 * - an answer sits so close to a decision boundary that the tolerance could flip it
 *   (capability verdict, a point near a control limit, Pareto class A at the threshold);
 * - a % defective is below 0,01 % at levels 1–2 (not readable from a z table).
 */
import { capabilities, processStats, solveExercise, defectsFor } from '../solve';
import { attributeChart, xbarRChart, xbarSChart } from '../charts';
import { attributeOutB, xbarROutB } from '../chartsAlt';
import { checkAttribute, checkCapability, checkPareto } from '../checks';
import * as D from '../decimal';
import { describe as describeDs } from '../descriptive';
import { welford } from '../descriptiveAlt';
import { indistinguishable } from '../grader';
import type { Exercise } from '../model';
import { phi, phiB, upperTail, upperTailB } from '../normal';
import { pareto } from '../pareto';

export interface Verdict {
  ok: boolean;
  reasons: string[];
}

export function verifyExercise(ex: Exercise): Verdict {
  const reasons: string[] = [];
  try {
    solveExercise(ex);
  } catch (e) {
    return { ok: false, reasons: [`solver: ${(e as Error).message}`] };
  }
  const ds = ex.dataset;

  // solver A = solver B (descriptive, exact)
  if (ds.kind === 'values' || ds.kind === 'freq' || ds.kind === 'subgroups') {
    const a = describeDs(ds);
    const b = welford(ds);
    if (!D.eq(a.mean, b.mean) || !D.eq(a.ss, b.ss)) reasons.push('descriptive A ≠ B');
    if (a.s === 0) reasons.push('zero spread');
  }

  const kinds = new Set(ex.asks.map((a) => a.type));

  // normal: A = B at every z used, and readable %
  if (kinds.has('pctPopulation') || kinds.has('z')) {
    const st = processStats(ex);
    for (const ask of ex.asks.filter((a) => a.type === 'pctPopulation')) {
      for (const s of st.sigmas) {
        const p = defectsFor(ask, ex, st.mu, s.value);
        for (const z of [p.zL, p.zU]) {
          if (z === undefined) continue;
          if (Math.abs(phi(z) - phiB(z)) > 1e-10 || Math.abs(upperTail(z) - upperTailB(z)) > 1e-10) reasons.push('normal A ≠ B');
        }
        if (ex.difficulty < 3 && 100 * p.total < 0.01) reasons.push('% defective below 0,01 %');
        if (100 * p.total > 60) reasons.push('% defective unrealistic');
      }
    }
  }

  // capability: global checks and a safe distance from the verdict thresholds
  if (ex.spec && ['cp', 'cpk', 'cpu', 'cpl', 'capable', 'centered'].some((k) => kinds.has(k as never))) {
    const { caps } = capabilities(ex);
    for (const { cap } of caps) {
      reasons.push(...checkCapability(cap));
      const th = ex.rules.capableThresholds ?? [1, 1.33];
      for (const ask of ex.asks.filter((a) => a.type === 'capable')) {
        const v = cap[ask.index ?? 'cp']!;
        if (th.some((t) => Math.abs(v - t) < 0.02)) reasons.push('capability index within 0,02 of a threshold');
      }
    }
  }

  // control charts: A = B and no point near a limit
  const margin = 0.03;
  for (const ask of ex.asks.filter((a) => a.type === 'outOfControl' || a.type === 'controlLimits')) {
    if (ds.kind === 'subgroups') {
      if (ex.rules.sigmaHat === 'sbar/c4' || ask.chart === 's') {
        const c = xbarSChart(ds.groups);
        const near = (v: number, l: { cl: number; ucl: number; lcl: number }) =>
          Math.abs(v - l.ucl) < margin * (l.ucl - l.cl) || Math.abs(v - l.lcl) < margin * (l.ucl - l.cl);
        if (c.means.some((m) => near(D.toNumber(m), c.xbar)) || c.sds.some((s) => near(s, c.s))) reasons.push('point near a control limit');
      } else {
        const a = xbarRChart(ds.groups);
        const b = xbarROutB(ds.groups);
        if (JSON.stringify([a.outXbar, a.outR]) !== JSON.stringify([b.outXbar, b.outR])) reasons.push('X̄-R out-of-control A ≠ B');
        const band = D.toNumber(D.sub(a.xbar.ucl, a.xbar.cl));
        const bandR = D.toNumber(D.sub(a.R.ucl, a.R.cl));
        const nearX = a.means.some((m) => [a.xbar.ucl, a.xbar.lcl].some((l) => Math.abs(D.toNumber(D.sub(m, l))) < margin * band));
        const nearR = a.ranges.some(
          (r) =>
            Math.abs(D.toNumber(D.sub(r, a.R.ucl))) < margin * bandR ||
            (!D.isZero(a.R.lcl) && Math.abs(D.toNumber(D.sub(r, a.R.lcl))) < margin * bandR),
        );
        if (nearX || nearR) reasons.push('point near a control limit');
      }
    }
    if (ds.kind === 'attributes') {
      const a = attributeChart(ds.chart, ds.samples);
      reasons.push(...checkAttribute(a));
      if (JSON.stringify(a.out) !== JSON.stringify(attributeOutB(ds.chart, ds.samples))) reasons.push('attribute out-of-control A ≠ B');
      a.points.forEach((p, i) => {
        const l = a.limits[i]!;
        const v = D.toNumber(p);
        const w = l.ucl - l.cl;
        if (Math.abs(v - l.ucl) < margin * w || (l.lcl > 0 && Math.abs(v - l.lcl) < margin * w)) reasons.push('point near a control limit');
      });
    }
  }

  // Pareto: checks and a clear class A at levels 1–2
  if (ds.kind === 'pareto') {
    const r = pareto(ds.items, ex.rules.paretoThreshold ?? 80, ex.rules.paretoRule ?? 'crossing');
    reasons.push(...checkPareto(r));
    if (ex.difficulty < 3) {
      const t = ex.rules.paretoThreshold ?? 80;
      if (r.rows.some((row) => Math.abs(D.toNumber(row.cumPct) - t) < 0.5)) reasons.push('cumulative % within 0,5 points of the class-A threshold');
      const vals = r.rows.map((x) => D.toString(x.value));
      if (new Set(vals).size !== vals.length) reasons.push('tied values at levels 1–2');
    }
  }

  const ind = indistinguishable(ex);
  if (ind.length) reasons.push(...ind.map((x) => `indistinguishable mistake ${x}`));

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

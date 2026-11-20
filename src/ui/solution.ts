/**
 * Step-by-step solution of each ask (spec §8.4): data → formula → numbers substituted →
 * result with units → checks. Every number comes from the core solvers at run time.
 */
import { capability, capableVerdict, rangeOf } from '../core/capability';
import { xbarRChart, xbarSChart } from '../core/charts';
import { constantText } from '../core/constants';
import * as D from '../core/decimal';
import { countSample, describe as describeDs } from '../core/descriptive';
import type { Ask, Exercise } from '../core/model';
import { pareto } from '../core/pareto';
import { attributesFor, dataDecimals, defectsFor, processStats } from '../core/solve';
import { fmt, fmtDec } from './format';

type T = (k: string, v?: Record<string, string | number>) => string;

const SYM: Record<string, string> = { s: 's (n − 1)', sigma: 'σₙ (n)', 'Rbar/d2': 'R̄/d₂', 'sbar/c4': 's̄/c₄' };
const sym = (k: string): string => SYM[k] ?? k;

export interface SolutionBlock {
  lines: string[];
}

export function solutionFor(ex: Exercise, ask: Ask, t: T): SolutionBlock {
  const ds = ex.dataset;
  const u = 'unit' in ds ? ds.unit : '';
  const dd = dataDecimals(ds) + 2;
  const L = (x: number) => fmt(x, dd);
  const lines: string[] = [];
  const raw = ds.kind === 'values' || ds.kind === 'freq' || ds.kind === 'subgroups';
  const sigmaLine = (): { mu: number; sigma: number } => {
    const st = processStats(ex);
    if (st.sigmas.length > 1) lines.push(t('sol.either', { a: sym(st.sigmas[0]!.note), b: sym(st.sigmas[1]!.note) }));
    lines.push(`μ = ${L(st.mu)} ${u}; σ = ${L(st.sigma)} ${u} (${sym(st.sigmas[0]!.note)})`);
    return { mu: st.mu, sigma: st.sigma };
  };

  switch (ask.type) {
    case 'mean': {
      if (!raw) {
        lines.push(`x̄ = ${fmtDec((ds as { mean: D.Decimal }).mean)} ${u}`);
        break;
      }
      const d = describeDs(ds);
      lines.push(ds.kind === 'freq' ? 'x̄ = Σ fᵢ·xᵢ / n' : 'x̄ = Σ xᵢ / n');
      lines.push(`x̄ = ${fmt(D.toNumber(d.sum), dd)} / ${d.n} = ${L(D.toNumber(d.mean))} ${u}`);
      break;
    }
    case 'sd': {
      if (!raw) break;
      const d = describeDs(ds);
      lines.push(`SS = Σ ${ds.kind === 'freq' ? 'fᵢ·' : ''}(xᵢ − x̄)² = ${fmt(D.toNumber(d.ss), dd + 2)} ${u}²`);
      lines.push(`s = √(SS / (n − 1)) = √(${fmt(D.toNumber(d.ss), dd + 2)} / ${d.n - 1}) = ${L(d.s)} ${u}`);
      lines.push(`σₙ = √(SS / n) = √(${fmt(D.toNumber(d.ss), dd + 2)} / ${d.n}) = ${L(d.sigma)} ${u}`);
      break;
    }
    case 'pctSample': {
      const { count, n } = countSample(ds, ask.side!, ask.bound!);
      lines.push(`x ${t(`side.${ask.side}`)} ${fmtDec(ask.bound!)} ${u}: ${count} / ${n}`);
      lines.push(`% = 100 · ${count} / ${n} = ${fmt((100 * count) / n)} %`);
      break;
    }
    case 'pctPopulation': {
      const { mu, sigma } = sigmaLine();
      const p = defectsFor(ask, ex, mu, sigma);
      if (p.zL !== undefined) lines.push(`z(${t('spec.lsl')}) = (${fmtDec(ask.bound ?? ex.spec!.lsl!)} − ${L(mu)}) / ${L(sigma)} = ${fmt(p.zL)} → Φ(z) = ${fmt(100 * p.below!)} %`);
      if (p.zU !== undefined) lines.push(`z(${t('spec.usl')}) = (${fmtDec(ask.bound ?? ex.spec!.usl!)} − ${L(mu)}) / ${L(sigma)} = ${fmt(p.zU)} → 1 − Φ(z) = ${fmt(100 * p.above!)} %`);
      lines.push(`% = ${fmt(100 * p.total)} % (${t('sol.ppm', { v: fmt(1e6 * p.total) })})`);
      break;
    }
    case 'z': {
      const { mu, sigma } = sigmaLine();
      lines.push(`z = (${fmtDec(ask.bound!)} − ${L(mu)}) / ${L(sigma)} = ${fmt((D.toNumber(ask.bound!) - mu) / sigma)}`);
      break;
    }
    case 'cp':
    case 'cpk':
    case 'cpu':
    case 'cpl':
    case 'capable':
    case 'centered': {
      const { mu, sigma } = sigmaLine();
      const st = processStats(ex);
      const c = capability(ex.spec!, st.muExact ?? D.parse(String(mu)), sigma);
      const lsl = ex.spec!.lsl ? fmtDec(ex.spec!.lsl) : '';
      const usl = ex.spec!.usl ? fmtDec(ex.spec!.usl) : '';
      if (ask.type === 'cp' || ask.type === 'capable') lines.push(`Cp = (${t('spec.usl')} − ${t('spec.lsl')}) / 6σ = (${usl} − ${lsl}) / (6 · ${L(sigma)}) = ${fmt(c.cp!)}`);
      if (ask.type !== 'cp' && ask.type !== 'centered') {
        if (c.cpu !== undefined) lines.push(`Cpu = (${t('spec.usl')} − μ) / 3σ = (${usl} − ${L(mu)}) / (3 · ${L(sigma)}) = ${fmt(c.cpu)}`);
        if (c.cpl !== undefined) lines.push(`Cpl = (μ − ${t('spec.lsl')}) / 3σ = (${L(mu)} − ${lsl}) / (3 · ${L(sigma)}) = ${fmt(c.cpl)}`);
        if (ask.type === 'cpk' || ask.type === 'capable') lines.push(`Cpk = min(Cpu, Cpl) = ${fmt(c.cpk)}`);
      }
      if (ask.type === 'capable') {
        const th = ex.rules.capableThresholds ?? [1, 1.33];
        const idx = ask.index ?? 'cp';
        const v = c[idx]!;
        lines.push(t('sol.verdict', { t: `${idx === 'cp' ? 'Cp' : 'Cpk'} = ${fmt(v)}; ${fmt(th[0])} / ${fmt(th[1])}` }) + ` → ${t(`choice.${capableVerdict(v, th)}`)}`);
      }
      if (ask.type === 'centered' && c.centered) {
        const mid = D.toNumber(D.div(D.add(ex.spec!.lsl!, ex.spec!.usl!), D.q(2)));
        lines.push(t(`sol.centered.${c.centered}`, { m: L(mid) }));
      }
      if (c.cp !== undefined && (ask.type === 'cpk' || ask.type === 'capable')) lines.push(t('sol.check.cpk'));
      break;
    }
    case 'sigmaHat': {
      if (ds.kind !== 'subgroups') break;
      const n = ds.groups[0]!.length;
      const rule = ex.rules.sigmaHat ?? 's';
      if (rule === 'Rbar/d2' || rule === 'either') {
        const rbar = D.div(D.sum(ds.groups.map(rangeOf)), D.q(ds.groups.length));
        lines.push(`R̄ = Σ Rᵢ / k = ${L(D.toNumber(rbar))} ${u} (k = ${ds.groups.length})`);
        lines.push(`${t('sol.table', { n })}: d₂ = ${constantText(n, 'd2').replace('.', ',')}`);
        lines.push(`σ̂ = R̄ / d₂ = ${L(D.toNumber(rbar) / D.toNumber(D.dec(constantText(n, 'd2'))))} ${u}`);
      }
      if (rule === 's' || rule === 'either') lines.push(`s = ${L(describeDs(ds).s)} ${u}`);
      break;
    }
    case 'controlLimits':
    case 'outOfControl': {
      if (ds.kind === 'subgroups') {
        const n = ds.groups[0]!.length;
        const k = (c: Parameters<typeof constantText>[1]) => constantText(n, c).replace('.', ',');
        if (ex.rules.sigmaHat === 'sbar/c4' || ask.chart === 's') {
          const c = xbarSChart(ds.groups);
          lines.push(`X̿ = ${L(D.toNumber(c.xbarbar))}; s̄ = ${L(c.sbar)} ${u}; ${t('sol.table', { n })}: A₃ = ${k('A3')}, B₃ = ${k('B3')}, B₄ = ${k('B4')}`);
          if (ask.chart === 's') lines.push(`${t('field.cl')} = s̄ = ${L(c.s.cl)}; ${t('field.ucl')} = B₄·s̄ = ${L(c.s.ucl)}; ${t('field.lcl')} = B₃·s̄ = ${L(c.s.lcl)}`);
          else lines.push(`${t('field.cl')} = X̿ = ${L(c.xbar.cl)}; ${t('field.ucl')} = X̿ + A₃·s̄ = ${L(c.xbar.ucl)}; ${t('field.lcl')} = X̿ − A₃·s̄ = ${L(c.xbar.lcl)}`);
          if (ask.type === 'outOfControl') lines.push(outLine(ask.chart === 's' ? c.outS : c.outXbar, ask.chart === 's' ? c.sds : c.means.map(D.toNumber), L, t));
        } else {
          const c = xbarRChart(ds.groups);
          const x = (v: D.Decimal) => L(D.toNumber(v));
          lines.push(`X̿ = ${x(c.xbarbar)}; R̄ = ${x(c.rbar)} ${u}; ${t('sol.table', { n })}: A₂ = ${k('A2')}, D₃ = ${k('D3')}, D₄ = ${k('D4')}`);
          if (ask.chart === 'R') lines.push(`${t('field.cl')} = R̄ = ${x(c.R.cl)}; ${t('field.ucl')} = D₄·R̄ = ${x(c.R.ucl)}; ${t('field.lcl')} = D₃·R̄ = ${x(c.R.lcl)}`);
          else lines.push(`${t('field.cl')} = X̿ = ${x(c.xbar.cl)}; ${t('field.ucl')} = X̿ + A₂·R̄ = ${x(c.xbar.ucl)}; ${t('field.lcl')} = X̿ − A₂·R̄ = ${x(c.xbar.lcl)}`);
          if (ask.type === 'outOfControl') lines.push(outLine(ask.chart === 'R' ? c.outR : c.outXbar, (ask.chart === 'R' ? c.ranges : c.means).map(D.toNumber), L, t));
        }
      } else if (ds.kind === 'attributes') {
        const a = attributesFor(ex, ask.chart);
        const kind = a.chart;
        const l = a.limits[0]!;
        const N = ds.samples.reduce((s, x) => s + x.n, 0);
        const T = ds.samples.reduce((s, x) => s + x.defects, 0);
        const n = ds.samples[0]!.n;
        const f = (v: number) => fmt(v, 0, 5);
        if (kind === 'p') lines.push(`p̄ = Σd / Σn = ${T} / ${N} = ${f(l.cl)}; σp = √(p̄(1 − p̄)/n) = √(${f(l.cl)}·${f(1 - l.cl)}/${n}) = ${f(l.sigma)}`);
        if (kind === 'np') lines.push(`p̄ = ${T} / ${N}; np̄ = ${f(l.cl)}; σ = √(np̄(1 − p̄)) = ${f(l.sigma)}`);
        if (kind === 'c') lines.push(`c̄ = Σc / k = ${T} / ${ds.samples.length} = ${f(l.cl)}; σ = √c̄ = ${f(l.sigma)}`);
        if (kind === 'u') lines.push(`ū = Σc / Σn = ${T} / ${N} = ${f(l.cl)}; σ = √(ū/n) = ${f(l.sigma)}`);
        lines.push(`${t('field.ucl')} = ${t('field.cl')} + 3σ = ${f(l.ucl)}`);
        lines.push(l.lclRaw < 0 ? t('sol.lclClip', { v: f(l.lclRaw) }) : `${t('field.lcl')} = ${t('field.cl')} − 3σ = ${f(l.lcl)}`);
        if (ask.type === 'outOfControl') lines.push(outLine(a.out, a.points.map(D.toNumber), f, t));
      }
      break;
    }
    case 'pareto': {
      if (ds.kind !== 'pareto') break;
      const r = pareto(ds.items, ex.rules.paretoThreshold ?? 80, ex.rules.paretoRule ?? 'crossing');
      lines.push(`Σ = ${fmtDec(r.total)} €`);
      for (const row of r.rows) lines.push(`${row.label}: ${fmtDec(row.value)} € → ${fmt(D.toNumber(row.pct), 2)} % · Σ ${fmt(D.toNumber(row.cumPct), 2)} %`);
      lines.push(`A: ${r.classA.join(', ')}`);
      lines.push(t('sol.check.cum'));
      break;
    }
  }
  return { lines };
}

function outLine(out: number[], values: number[], f: (x: number) => string, t: T): string {
  return out.length ? out.map((i) => `${i} (${f(values[i - 1]!)})`).join(', ') : t('sol.none');
}

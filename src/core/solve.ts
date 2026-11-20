/**
 * Solves every ask of an exercise from the data shown to the user (spec §8.1: the correct
 * answer is always recomputed from the displayed data). Used by the grader, the generator
 * and the solution steps.
 */
import { capability, capableVerdict, sigmaHat as estimateSigma, type Capability, type CapableVerdict } from './capability';
import { attributeChart, xbarRChart, xbarSChart } from './charts';
import * as D from './decimal';
import type { Decimal } from './decimal';
import { describe as describeDs, pctSample } from './descriptive';
import type { Ask, Dataset, Exercise } from './model';
import { populationDefects, type PopulationDefects } from './normal';
import { pareto } from './pareto';

export type Quantity = 'length' | 'percent' | 'none';

/** A numeric answer; `accepted` lists every value that counts as correct (e.g. s and σ under "either"). */
export interface NumberExpected {
  kind: 'number';
  value: number;
  quantity: Quantity;
  accepted: { value: number; note?: string }[];
}

export interface LimitsExpected {
  kind: 'limits';
  cl: number;
  ucl: number;
  lcl: number;
  lclRaw: number;
}

export interface ChoiceExpected {
  kind: 'choice';
  value: string;
}

export interface SetExpected {
  kind: 'set';
  value: number[];
}

export interface ParetoExpected {
  kind: 'pareto';
  /** labels in descending order; groups of equal values may be permuted */
  order: string[];
  tieGroups: string[][];
  cumPct: number[];
  classA: string[];
}

export type Expected = NumberExpected | LimitsExpected | ChoiceExpected | SetExpected | ParetoExpected;

/** Location and spread used for the normal and for capability, with every accepted σ variant. */
export interface Stats {
  mu: number;
  muExact?: Decimal;
  /** σ used for the primary answer */
  sigma: number;
  /** all σ values that count as correct (s and σₙ under "either") */
  sigmas: { value: number; note: string }[];
  /** both deviations when raw data exist (for the diagnosis) */
  s?: number;
  sigmaPop?: number;
  n?: number;
}

function hasRawData(ds: Dataset): boolean {
  return ds.kind === 'values' || ds.kind === 'freq' || ds.kind === 'subgroups';
}

/** μ and σ for the normal / capability, following the exercise rules (spec §3). */
export function processStats(ex: Exercise): Stats {
  const ds = ex.dataset;
  if (ds.kind === 'summary') {
    const sd = D.toNumber(ds.sd);
    return { mu: D.toNumber(ds.mean), muExact: ds.mean, sigma: sd, sigmas: [{ value: sd, note: ds.sdKind }], n: ds.n };
  }
  if (!hasRawData(ds)) throw new Error(`No process statistics for dataset "${ds.kind}"`);
  const d = describeDs(ds);
  const base = { mu: D.toNumber(d.mean), muExact: d.mean, s: d.s, sigmaPop: d.sigma, n: d.n };
  const rule = ex.rules.sigmaHat;
  if (rule === 'either') {
    const r = estimateSigma(ds, 'Rbar/d2');
    return { ...base, sigma: r.value, sigmas: [{ value: r.value, note: 'Rbar/d2' }, { value: d.s, note: 's' }] };
  }
  if (rule && rule !== 's') {
    const sh = estimateSigma(ds, rule);
    return { ...base, sigma: sh.value, sigmas: [{ value: sh.value, note: rule }] };
  }
  switch (ex.rules.sd) {
    case 's':
      return { ...base, sigma: d.s, sigmas: [{ value: d.s, note: 's' }] };
    case 'sigma':
      return { ...base, sigma: d.sigma, sigmas: [{ value: d.sigma, note: 'sigma' }] };
    case 'either':
      return { ...base, sigma: d.s, sigmas: [{ value: d.s, note: 's' }, { value: d.sigma, note: 'sigma' }] };
  }
}

/** Population defect fraction for an ask (bound + side, or the specification tails). */
export function defectsFor(ask: Ask, ex: Exercise, mu: number, sigma: number): PopulationDefects {
  if (ask.bound) {
    const b = D.toNumber(ask.bound);
    const below = ask.side === 'lt' || ask.side === 'le';
    return below ? populationDefects(mu, sigma, b, undefined) : populationDefects(mu, sigma, undefined, b);
  }
  const lsl = ex.spec?.lsl ? D.toNumber(ex.spec.lsl) : undefined;
  const usl = ex.spec?.usl ? D.toNumber(ex.spec.usl) : undefined;
  const tails = ask.tails ?? 'outside';
  if (tails === 'below') return populationDefects(mu, sigma, lsl, undefined);
  if (tails === 'above') return populationDefects(mu, sigma, undefined, usl);
  return populationDefects(mu, sigma, lsl, usl);
}

function num(value: number, quantity: Quantity, accepted?: { value: number; note?: string }[]): NumberExpected {
  return { kind: 'number', value, quantity, accepted: accepted ?? [{ value }] };
}

export function capabilities(ex: Exercise): { st: Stats; caps: { cap: Capability; note: string }[] } {
  if (!ex.spec) throw new Error('Capability asks need a specification');
  const st = processStats(ex);
  const mu = st.muExact ?? D.parse(String(st.mu));
  return { st, caps: st.sigmas.map((s) => ({ cap: capability(ex.spec!, mu, s.value), note: s.note })) };
}

function subgroups(ex: Exercise): Decimal[][] {
  if (ex.dataset.kind !== 'subgroups') throw new Error('This ask needs subgroups');
  return ex.dataset.groups;
}

/**
 * Attribute chart for an ask. The ask may name the other chart of the p/np pair (same
 * samples, constant n): p and np are two views of the same data (worked exercise 8).
 */
export function attributesFor(ex: Exercise, chart?: Ask['chart']) {
  if (ex.dataset.kind !== 'attributes') throw new Error('This ask needs attribute samples');
  const ds = ex.dataset;
  const pair = (c: string) => c === 'p' || c === 'np';
  const kind = chart && chart !== ds.chart && pair(chart) && pair(ds.chart) ? chart : ds.chart;
  if (chart && chart !== kind) throw new Error(`Dataset is a ${ds.chart} chart, ask is ${chart}`);
  return attributeChart(kind as 'p' | 'np' | 'c' | 'u', ds.samples);
}

export function solveAsk(ex: Exercise, ask: Ask): Expected {
  const ds = ex.dataset;
  switch (ask.type) {
    case 'mean': {
      const m = ds.kind === 'summary' ? D.toNumber(ds.mean) : D.toNumber(describeDs(ds).mean);
      return num(m, 'length');
    }
    case 'sd': {
      if (ds.kind === 'summary') return num(D.toNumber(ds.sd), 'length');
      const d = describeDs(ds);
      if (ex.rules.sd === 's') return num(d.s, 'length', [{ value: d.s, note: 's' }]);
      if (ex.rules.sd === 'sigma') return num(d.sigma, 'length', [{ value: d.sigma, note: 'sigma' }]);
      return num(d.s, 'length', [
        { value: d.s, note: 's' },
        { value: d.sigma, note: 'sigma' },
      ]);
    }
    case 'pctSample': {
      if (!ask.bound || !ask.side) throw new Error('pctSample needs bound and side');
      return num(D.toNumber(pctSample(ds, ask.side, ask.bound)), 'percent');
    }
    case 'pctPopulation': {
      const st = processStats(ex);
      const acc = st.sigmas.map((s) => ({ value: 100 * defectsFor(ask, ex, st.mu, s.value).total, note: s.note }));
      return num(acc[0]!.value, 'percent', acc);
    }
    case 'z': {
      if (!ask.bound) throw new Error('z needs a bound');
      const st = processStats(ex);
      const b = D.toNumber(ask.bound);
      const acc = st.sigmas.map((s) => ({ value: (b - st.mu) / s.value, note: s.note }));
      return num(acc[0]!.value, 'none', acc);
    }
    case 'cp':
    case 'cpk':
    case 'cpu':
    case 'cpl': {
      const { caps } = capabilities(ex);
      const key = ask.type;
      const acc = caps.map(({ cap, note }) => {
        const v = cap[key];
        if (v === undefined) throw new Error(`${key} is undefined for this specification`);
        return { value: v, note };
      });
      return num(acc[0]!.value, 'none', acc);
    }
    case 'capable': {
      const { caps } = capabilities(ex);
      const idx = ask.index ?? 'cp';
      const verdicts = new Set<CapableVerdict>(caps.map(({ cap }) => capableVerdict(cap[idx]!, ex.rules.capableThresholds)));
      if (verdicts.size > 1) throw new Error('The verdict depends on s vs σ: the exercise must fix the rule');
      return { kind: 'choice', value: [...verdicts][0]! };
    }
    case 'centered': {
      const { caps } = capabilities(ex);
      const c = caps[0]!.cap.centered;
      if (!c) throw new Error('centered needs both limits');
      return { kind: 'choice', value: c };
    }
    case 'sigmaHat': {
      const rule = ex.rules.sigmaHat ?? 's';
      if (rule === 'either') {
        const r = estimateSigma(ds, 'Rbar/d2').value;
        const s = estimateSigma(ds, 's').value;
        return num(r, 'length', [
          { value: r, note: 'Rbar/d2' },
          { value: s, note: 's' },
        ]);
      }
      return num(estimateSigma(ds, rule).value, 'length');
    }
    case 'controlLimits': {
      const chart = ask.chart;
      if (chart === 'xbar' || chart === 'R' || chart === 's') {
        const g = subgroups(ex);
        if (ex.rules.sigmaHat === 'sbar/c4' || chart === 's') {
          const c = xbarSChart(g);
          const L = chart === 's' ? c.s : c.xbar;
          return { kind: 'limits', ...L };
        }
        const c = xbarRChart(g);
        const L = chart === 'R' ? c.R : c.xbar;
        return { kind: 'limits', cl: D.toNumber(L.cl), ucl: D.toNumber(L.ucl), lcl: D.toNumber(L.lcl), lclRaw: D.toNumber(L.lclRaw) };
      }
      const a = attributesFor(ex, chart);
      const first = a.limits[0]!;
      if (a.limits.some((l) => l.ucl !== first.ucl)) throw new Error('Variable n: limits differ per sample (not a single answer)');
      return { kind: 'limits', cl: first.cl, ucl: first.ucl, lcl: first.lcl, lclRaw: first.lclRaw };
    }
    case 'outOfControl': {
      const chart = ask.chart;
      if (chart === 'xbar' || chart === 'R' || chart === 's') {
        const g = subgroups(ex);
        if (ex.rules.sigmaHat === 'sbar/c4' || chart === 's') {
          const c = xbarSChart(g);
          return { kind: 'set', value: chart === 's' ? c.outS : c.outXbar };
        }
        const c = xbarRChart(g);
        return { kind: 'set', value: chart === 'R' ? c.outR : c.outXbar };
      }
      return { kind: 'set', value: attributesFor(ex, chart).out };
    }
    case 'pareto': {
      if (ds.kind !== 'pareto') throw new Error('pareto needs a pareto dataset');
      const r = pareto(ds.items, ex.rules.paretoThreshold ?? 80, ex.rules.paretoRule ?? 'crossing');
      const tieGroups: string[][] = [];
      for (const row of r.rows) {
        const last = tieGroups[tieGroups.length - 1];
        const prev = last ? r.rows.find((x) => x.label === last[0]) : undefined;
        if (last && prev && D.eq(prev.value, row.value)) last.push(row.label);
        else tieGroups.push([row.label]);
      }
      return {
        kind: 'pareto',
        order: r.rows.map((x) => x.label),
        tieGroups,
        cumPct: r.rows.map((x) => D.toNumber(x.cumPct)),
        classA: r.classA,
      };
    }
  }
}

export function solveExercise(ex: Exercise): Record<string, Expected> {
  const out: Record<string, Expected> = {};
  for (const a of ex.asks) out[a.id] = solveAsk(ex, a);
  return out;
}

/** Largest number of decimals among the raw data (to judge how precisely answers are given). */
export function dataDecimals(ds: Dataset): number {
  // a finite decimal has a denominator 2^a·5^b and max(a, b) decimals
  const decs = (x: Decimal): number => {
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
    return d === 1n ? Math.max(a, b) : 6; // not a finite decimal: treat as fine-grained
  };
  switch (ds.kind) {
    case 'values':
      return Math.max(0, ...ds.values.map(decs));
    case 'subgroups':
      return Math.max(0, ...ds.groups.flat().map(decs));
    case 'freq':
      return Math.max(0, ...ds.classes.flatMap((c) => [c.x, c.a, c.b].filter((v): v is Decimal => !!v).map(decs)));
    case 'summary':
      return Math.max(decs(ds.mean), decs(ds.sd));
    default:
      return 0;
  }
}

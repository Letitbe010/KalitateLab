/**
 * Grader and error diagnosis (spec §8). Deterministic: every answer is compared with the
 * verified solver output (solve.ts); a wrong answer is re-checked against the result of each
 * common mistake (spec §8.3) and the first hypothesis that matches is reported.
 *
 * Tolerances (spec §8.1, visible in settings):
 *   x̄, s, σ̂: 0.1 % relative            Cp/Cpk/Cpu/Cpl: ±0.01           z: ±0.01
 *   % defective (population): 3 % relative or 0.01 percentage points
 *   % in the sample: exact count, 0.1 % relative or 0.01 percentage points (user rounding)
 *   control limits: UCL and LCL within 0.2 % of their DISTANCE TO THE CENTRE LINE
 *     (the 3-decimal constants only affect the A₂R̄, D₄R̄… term; 0.2 % of an X̄ limit's value
 *     would be wider than the whole control band), CL like a mean.
 * Rounding allowance: a value equal to the exact answer rounded to the user's own number of
 * decimals is accepted when that number is at least the data's decimals + 1.
 */
import * as D from './decimal';
import { describe as describeDs, pctSample } from './descriptive';
import { constants } from './constants';
import type { Ask, Exercise } from './model';
import { capableVerdict } from './capability';
import {
  capabilities,
  dataDecimals,
  defectsFor,
  processStats,
  solveAsk,
  type Expected,
  type LimitsExpected,
  type NumberExpected,
  type ParetoExpected,
  type Quantity,
} from './solve';

// ------------------------------------------------------------------ settings

export interface Tolerances {
  meanSdRel: number;
  indexAbs: number;
  zAbs: number;
  popPctRel: number;
  popPctAbs: number;
  samplePctRel: number;
  samplePctAbs: number;
  limitsRelToBand: number;
  paretoPctAbs: number;
}

export const DEFAULT_TOLERANCES: Tolerances = {
  meanSdRel: 0.001,
  indexAbs: 0.01,
  zAbs: 0.01,
  popPctRel: 0.03,
  popPctAbs: 0.01,
  samplePctRel: 0.001,
  samplePctAbs: 0.01,
  limitsRelToBand: 0.002,
  paretoPctAbs: 0.01,
};

// ------------------------------------------------------------------ input

export interface Answer {
  value?: string;
  unit?: string;
  cl?: string;
  ucl?: string;
  lcl?: string;
  choice?: string;
  set?: string;
  order?: string;
  cumPct?: string[];
  classA?: string;
}

export interface ParsedNumber {
  value: number;
  /** decimals written by the user (null with an exponent) */
  decimals: number | null;
}

/** "1,333", "1.333", "−0,5", " 12 " → number. Both separators at once, or garbage → null. */
export function parseUserNumber(raw: string | undefined): ParsedNumber | null | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/−/g, '-').replace(/\s+/g, '');
  if (s === '') return undefined;
  if (s.includes(',') && s.includes('.')) return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const value = D.toNumber(D.parse(s));
  const m = /[.,](\d*)/.exec(s);
  const decimals = /[eE]/.test(s) ? null : m ? m[1]!.length : 0;
  return { value, decimals };
}

const UNIT_FACTORS: Record<Quantity, Record<string, number>> = {
  length: { mm: 1, 'µm': 0.001, um: 0.001 },
  percent: { '%': 1, ppm: 1e-4, fraction: 100 },
  none: { '': 1 },
};

export function toBaseUnit(value: number, quantity: Quantity, unit: string | undefined): number | null {
  const table = UNIT_FACTORS[quantity];
  const key = unit ?? (quantity === 'length' ? 'mm' : quantity === 'percent' ? '%' : '');
  const f = table[key];
  return f === undefined ? null : value * f;
}

// ------------------------------------------------------------------ output

export type Status = 'correct' | 'wrong' | 'missing' | 'invalid';

/** Diagnosis ids (spec §8.3; ids map to eu/es texts in the UI). */
export type DiagnosisId =
  | 'sd-n-vs-n1'
  | 'variance-for-sd'
  | 'freq-ignored'
  | 'population-for-sample'
  | 'sample-for-population'
  | 'bound-inclusive'
  | 'wrong-tail'
  | 'one-tail-only'
  | 'z-sign'
  | 'cp-for-cpk'
  | 'cpk-for-cp'
  | 'max-for-min'
  | 'usl-lsl-swapped'
  | 'cp-3sigma'
  | 'cpk-6sigma'
  | 'rbar-not-divided'
  | 'wrong-n-constant'
  | 'overall-s-for-within'
  | 'limits-no-sqrt-n'
  | 'lcl-not-clipped'
  | 'p-np-mixed'
  | 'pareto-unsorted'
  | 'not-identified';

export interface ItemResult {
  /** 'value', 'cl', 'ucl', 'lcl', 'choice', 'set', 'order', 'cumPct', 'classA' */
  part: string;
  status: Status;
  expected: number | string | number[] | string[];
  given?: number | string | number[] | string[];
  /** which accepted variant matched (e.g. 's' or 'sigma' under "either") */
  note?: string;
  diagnosis?: DiagnosisId;
}

export interface AskResult {
  id: string;
  type: Ask['type'];
  status: Status | 'partial';
  /** fraction of the ask's weight earned, 0…1 */
  score: number;
  items: ItemResult[];
}

export interface GradeResult {
  asks: AskResult[];
  /** 0…10, weighted by exercise.weights (default 1 each) */
  score10: number;
}

// ------------------------------------------------------------------ helpers

interface NumTol {
  rel?: number;
  abs?: number;
  /** relative tolerance measured on |expected − ref| instead of |expected| */
  ref?: number;
  /** rounding allowance from this many user decimals on */
  minDecimals?: number;
}

function within(u: number, e: number, t: NumTol, decimals: number | null): boolean {
  const scale = t.ref !== undefined ? Math.abs(e - t.ref) : Math.abs(e);
  const tol = Math.max(t.abs ?? 0, (t.rel ?? 0) * scale) * (1 + 1e-9) + 1e-15;
  if (Math.abs(u - e) <= tol) return true;
  if (t.minDecimals !== undefined && decimals !== null && decimals >= t.minDecimals) {
    return Math.abs(u - e) <= 0.5 * 10 ** -decimals * (1 + 1e-9);
  }
  return false;
}

function numberTol(ask: Ask, ex: Exercise, T: Tolerances): NumTol {
  const dmin = dataDecimals(ex.dataset) + 1;
  switch (ask.type) {
    case 'mean':
    case 'sd':
    case 'sigmaHat':
      return { rel: T.meanSdRel, minDecimals: dmin };
    case 'pctSample':
      return { rel: T.samplePctRel, abs: T.samplePctAbs };
    case 'pctPopulation':
      return { rel: T.popPctRel, abs: T.popPctAbs };
    case 'z':
      return { abs: T.zAbs };
    default:
      return { abs: T.indexAbs };
  }
}

/** A hypothesis: the value a typical mistake produces. */
interface Hyp {
  id: DiagnosisId;
  value: number;
}

function firstMatch(u: number, hyps: Hyp[], expectedValues: number[], t: NumTol, decimals: number | null): DiagnosisId {
  for (const h of hyps) {
    if (!Number.isFinite(h.value)) continue;
    // a hypothesis that cannot be told apart from a correct answer is never reported
    if (expectedValues.some((e) => within(h.value, e, t, null))) continue;
    if (within(u, h.value, t, decimals)) return h.id;
  }
  return 'not-identified';
}

// ------------------------------------------------------------------ hypotheses (spec §8.3)

function numberHypotheses(ex: Exercise, ask: Ask, exp: NumberExpected): Hyp[] {
  const ds = ex.dataset;
  const hyps: Hyp[] = [];
  const raw = ds.kind === 'values' || ds.kind === 'freq' || ds.kind === 'subgroups';
  switch (ask.type) {
    case 'mean': {
      if (ds.kind === 'freq') {
        const marks = ds.classes.map((c) => ({ kind: 'values' as const, x: c.x ?? D.div(D.add(c.a!, c.b!), D.q(2)) }));
        hyps.push({ id: 'freq-ignored', value: D.toNumber(D.div(D.sum(marks.map((m) => m.x)), D.q(marks.length))) });
      }
      break;
    }
    case 'sd': {
      if (!raw) break;
      const d = describeDs(ds);
      if (ex.rules.sd === 's') hyps.push({ id: 'sd-n-vs-n1', value: d.sigma });
      if (ex.rules.sd === 'sigma') hyps.push({ id: 'sd-n-vs-n1', value: d.s });
      hyps.push({ id: 'variance-for-sd', value: d.s * d.s }, { id: 'variance-for-sd', value: d.sigma * d.sigma });
      if (ds.kind === 'freq') {
        const vals = ds.classes.map((c) => c.x ?? D.div(D.add(c.a!, c.b!), D.q(2)));
        const u = describeDs({ kind: 'values', values: vals, unit: '' });
        hyps.push({ id: 'freq-ignored', value: u.s }, { id: 'freq-ignored', value: u.sigma });
      }
      break;
    }
    case 'pctSample': {
      if (!ask.bound || !ask.side) break;
      const flip = { lt: 'le', le: 'lt', gt: 'ge', ge: 'gt' } as const;
      hyps.push({ id: 'bound-inclusive', value: D.toNumber(pctSample(ds, flip[ask.side], ask.bound)) });
      if (raw) {
        const st = processStats(ex);
        for (const s of [st.s, st.sigmaPop]) if (s) hyps.push({ id: 'population-for-sample', value: 100 * defectsFor(ask, ex, st.mu, s).total });
      }
      break;
    }
    case 'pctPopulation': {
      const st = processStats(ex);
      if (raw) {
        // the same question answered by counting the sample
        const sampleCount = (): number | null => {
          try {
            if (ask.bound && ask.side) return D.toNumber(pctSample(ds, ask.side, ask.bound));
            const tails = ask.tails ?? 'outside';
            let p = 0;
            if (tails !== 'above' && ex.spec?.lsl) p += D.toNumber(pctSample(ds, 'lt', ex.spec.lsl));
            if (tails !== 'below' && ex.spec?.usl) p += D.toNumber(pctSample(ds, 'gt', ex.spec.usl));
            return p;
          } catch {
            return null;
          }
        };
        const c = sampleCount();
        if (c !== null) hyps.push({ id: 'sample-for-population', value: c });
        if (ex.rules.sd === 's' && st.sigmaPop && !ex.rules.sigmaHat) hyps.push({ id: 'sd-n-vs-n1', value: 100 * defectsFor(ask, ex, st.mu, st.sigmaPop).total });
        if (ex.rules.sd === 'sigma' && st.s && !ex.rules.sigmaHat) hyps.push({ id: 'sd-n-vs-n1', value: 100 * defectsFor(ask, ex, st.mu, st.s).total });
      }
      for (const s of st.sigmas) {
        const p = defectsFor(ask, ex, st.mu, s.value);
        if (p.below !== undefined) hyps.push({ id: 'wrong-tail', value: 100 * (1 - p.below) });
        if (p.above !== undefined) hyps.push({ id: 'wrong-tail', value: 100 * (1 - p.above) });
        if (p.below !== undefined && p.above !== undefined) {
          hyps.push({ id: 'one-tail-only', value: 100 * p.below }, { id: 'one-tail-only', value: 100 * p.above });
        }
      }
      break;
    }
    case 'z': {
      for (const a of exp.accepted) hyps.push({ id: 'z-sign', value: -a.value });
      const st = processStats(ex);
      if (ask.bound && ex.rules.sd === 's' && st.sigmaPop) hyps.push({ id: 'sd-n-vs-n1', value: (D.toNumber(ask.bound) - st.mu) / st.sigmaPop });
      if (ask.bound && ex.rules.sd === 'sigma' && st.s) hyps.push({ id: 'sd-n-vs-n1', value: (D.toNumber(ask.bound) - st.mu) / st.s });
      break;
    }
    case 'cp':
    case 'cpk':
    case 'cpu':
    case 'cpl': {
      const { caps, st } = capabilities(ex);
      for (const { cap } of caps) {
        if (ask.type === 'cpk') {
          if (cap.cp !== undefined) hyps.push({ id: 'cp-for-cpk', value: cap.cp });
          hyps.push({ id: 'cpk-6sigma', value: cap.cpk / 2 });
          if (cap.cpu !== undefined && cap.cpl !== undefined) hyps.push({ id: 'max-for-min', value: Math.max(cap.cpu, cap.cpl) });
        }
        if (ask.type === 'cp') {
          hyps.push({ id: 'cp-3sigma', value: 2 * cap.cp! }, { id: 'cpk-for-cp', value: cap.cpk });
        }
        if (ask.type === 'cpu' && cap.cpl !== undefined) hyps.push({ id: 'usl-lsl-swapped', value: cap.cpl });
        if (ask.type === 'cpl' && cap.cpu !== undefined) hyps.push({ id: 'usl-lsl-swapped', value: cap.cpu });
      }
      // σ rule fixed and the other deviation used
      if (!ex.rules.sigmaHat && ex.spec && st.muExact && ex.rules.sd !== 'either') {
        const other = ex.rules.sd === 's' ? st.sigmaPop : st.s;
        if (other) {
          const v = capabilityValue(ex, ask, other);
          if (v !== undefined) hyps.push({ id: 'sd-n-vs-n1', value: v });
        }
      }
      // σ̂ = R̄ (not divided by d₂)
      if (ex.rules.sigmaHat === 'Rbar/d2' && ds.kind === 'subgroups') {
        const rbar = D.toNumber(D.div(D.sum(ds.groups.map(rangeOfGroup)), D.q(ds.groups.length)));
        const v = capabilityValue(ex, ask, rbar);
        if (v !== undefined) hyps.push({ id: 'rbar-not-divided', value: v });
      }
      break;
    }
    case 'sigmaHat': {
      if (ds.kind !== 'subgroups') break;
      const n = ds.groups[0]!.length;
      const rbar = D.div(D.sum(ds.groups.map(rangeOfGroup)), D.q(ds.groups.length));
      if ((ex.rules.sigmaHat ?? 's') === 'Rbar/d2') {
        hyps.push({ id: 'rbar-not-divided', value: D.toNumber(rbar) });
        for (const m of [n - 1, n + 1]) if (m >= 2 && m <= 25) hyps.push({ id: 'wrong-n-constant', value: D.toNumber(D.div(rbar, constants(m).d2)) });
        hyps.push({ id: 'overall-s-for-within', value: describeDs(ds).s });
      }
      break;
    }
    default:
      break;
  }
  return hyps;
}

function rangeOfGroup(g: D.Decimal[]): D.Decimal {
  const sorted = [...g].sort(D.cmp);
  return D.sub(sorted[sorted.length - 1]!, sorted[0]!);
}

/** One capability index computed with a given σ (for the hypotheses). */
function capabilityValue(ex: Exercise, ask: Ask, sigma: number): number | undefined {
  const st = processStats(ex);
  const lsl = ex.spec?.lsl ? D.toNumber(ex.spec.lsl) : undefined;
  const usl = ex.spec?.usl ? D.toNumber(ex.spec.usl) : undefined;
  const cpu = usl !== undefined ? (usl - st.mu) / (3 * sigma) : undefined;
  const cpl = lsl !== undefined ? (st.mu - lsl) / (3 * sigma) : undefined;
  switch (ask.type) {
    case 'cp':
      return usl !== undefined && lsl !== undefined ? (usl - lsl) / (6 * sigma) : undefined;
    case 'cpu':
      return cpu;
    case 'cpl':
      return cpl;
    case 'cpk':
      return Math.min(cpu ?? Infinity, cpl ?? Infinity);
    default:
      return undefined;
  }
}

function limitsHypotheses(ex: Exercise, ask: Ask, part: 'cl' | 'ucl' | 'lcl', exp: LimitsExpected): Hyp[] {
  const hyps: Hyp[] = [];
  if (part === 'lcl' && exp.lclRaw < 0) hyps.push({ id: 'lcl-not-clipped', value: exp.lclRaw });
  const ds = ex.dataset;
  if (ds.kind === 'attributes' && (ds.chart === 'p' || ds.chart === 'np')) {
    const n = ds.samples[0]!.n;
    // the limits of the other chart (np ↔ p): values scaled by n
    const k = ds.chart === 'p' ? n : 1 / n;
    const v = part === 'cl' ? exp.cl : part === 'ucl' ? exp.ucl : Math.max(0, exp.lclRaw);
    hyps.push({ id: 'p-np-mixed', value: v * k });
  }
  if (ds.kind === 'subgroups' && (ask.chart === 'xbar' || ask.chart === 'R') && ex.rules.sigmaHat !== 'sbar/c4') {
    const n = ds.groups[0]!.length;
    const band = exp.ucl - exp.cl;
    const k = constants(n);
    for (const m of [n - 1, n + 1]) {
      if (m < 2 || m > 25 || part === 'cl') continue;
      const km = constants(m);
      if (ask.chart === 'xbar') {
        const b = band * (D.toNumber(km.A2) / D.toNumber(k.A2));
        hyps.push({ id: 'wrong-n-constant', value: part === 'ucl' ? exp.cl + b : exp.cl - b });
      } else {
        hyps.push({ id: 'wrong-n-constant', value: part === 'ucl' ? exp.cl * D.toNumber(km.D4) : exp.cl * D.toNumber(km.D3) });
      }
    }
    if (ask.chart === 'xbar' && part !== 'cl') {
      // ±3σ̂ of individuals instead of ±3σ̂/√n (seen in course notes)
      const sig = (band / 3) * Math.sqrt(n);
      hyps.push({ id: 'limits-no-sqrt-n', value: part === 'ucl' ? exp.cl + 3 * sig : exp.cl - 3 * sig });
    }
  }
  return hyps;
}

// ------------------------------------------------------------------ grading per ask kind

function gradeNumber(ex: Exercise, ask: Ask, exp: NumberExpected, ans: Answer | undefined, T: Tolerances): ItemResult {
  const parsed = parseUserNumber(ans?.value);
  if (parsed === undefined) return { part: 'value', status: 'missing', expected: exp.value };
  if (parsed === null) return { part: 'value', status: 'invalid', expected: exp.value, given: ans?.value };
  const u = toBaseUnit(parsed.value, exp.quantity, ans?.unit);
  if (u === null) return { part: 'value', status: 'invalid', expected: exp.value, given: ans?.value };
  const t = numberTol(ask, ex, T);
  for (const a of exp.accepted) {
    if (within(u, a.value, t, parsed.decimals)) return { part: 'value', status: 'correct', expected: a.value, given: u, note: a.note };
  }
  const diagnosis = firstMatch(u, numberHypotheses(ex, ask, exp), exp.accepted.map((a) => a.value), t, parsed.decimals);
  return { part: 'value', status: 'wrong', expected: exp.value, given: u, diagnosis };
}

function gradeLimits(ex: Exercise, ask: Ask, exp: LimitsExpected, ans: Answer | undefined, T: Tolerances): ItemResult[] {
  const variables = ex.dataset.kind === 'subgroups';
  const dmin = variables ? dataDecimals(ex.dataset) + 1 : undefined;
  return (['cl', 'ucl', 'lcl'] as const).map((part) => {
    const e = exp[part];
    const parsed = parseUserNumber(ans?.[part]);
    if (parsed === undefined) return { part, status: 'missing' as const, expected: e };
    if (parsed === null) return { part, status: 'invalid' as const, expected: e, given: ans?.[part] };
    const u = toBaseUnit(parsed.value, variables ? 'length' : 'none', variables ? ans?.unit : undefined);
    if (u === null) return { part, status: 'invalid' as const, expected: e, given: ans?.[part] };
    const t: NumTol =
      part === 'cl'
        ? { rel: T.meanSdRel, minDecimals: dmin }
        : { rel: T.limitsRelToBand, ref: exp.cl, minDecimals: dmin };
    if (within(u, e, t, parsed.decimals)) return { part, status: 'correct' as const, expected: e, given: u };
    // the hypotheses for UCL/LCL are judged with a tolerance on the band width
    const diagnosis = firstMatch(u, limitsHypotheses(ex, ask, part, exp), [e], { ...t, ref: exp.cl, rel: part === 'cl' ? T.meanSdRel : T.limitsRelToBand }, parsed.decimals);
    return { part, status: 'wrong' as const, expected: e, given: u, diagnosis };
  });
}

function parseIntSet(raw: string): number[] | null {
  const parts = raw
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

function parseLabels(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Every valid class A: the labels before the boundary tie group plus any choice inside it. */
function classAValid(exp: ParetoExpected, given: string[]): boolean {
  const k = exp.classA.length;
  if (given.length !== k || new Set(given).size !== k) return false;
  let pos = 0;
  const fixed: string[] = [];
  for (const g of exp.tieGroups) {
    if (pos + g.length <= k) {
      fixed.push(...g);
      pos += g.length;
      continue;
    }
    const need = k - pos;
    const rest = given.filter((x) => !fixed.includes(x));
    return fixed.every((x) => given.includes(x)) && rest.length === need && rest.every((x) => g.includes(x));
  }
  return fixed.every((x) => given.includes(x));
}

function orderValid(exp: ParetoExpected, given: string[]): boolean {
  if (given.length !== exp.order.length) return false;
  let pos = 0;
  for (const g of exp.tieGroups) {
    const slice = given.slice(pos, pos + g.length);
    if (slice.length !== g.length || !slice.every((x) => g.includes(x)) || new Set(slice).size !== g.length) return false;
    pos += g.length;
  }
  return true;
}

function gradePareto(ex: Exercise, exp: ParetoExpected, ans: Answer | undefined, T: Tolerances): ItemResult[] {
  const items: ItemResult[] = [];
  // order
  if (!ans?.order?.trim()) items.push({ part: 'order', status: 'missing', expected: exp.order });
  else {
    const g = parseLabels(ans.order);
    items.push({ part: 'order', status: orderValid(exp, g) ? 'correct' : 'wrong', expected: exp.order, given: g });
  }
  // cumulative %
  if (!ans?.cumPct || ans.cumPct.every((x) => !x?.trim())) items.push({ part: 'cumPct', status: 'missing', expected: exp.cumPct });
  else {
    const vals = ans.cumPct.map((x) => parseUserNumber(x));
    if (vals.length !== exp.cumPct.length || vals.some((v) => v === null || v === undefined)) {
      items.push({ part: 'cumPct', status: vals.some((v) => v === null) ? 'invalid' : 'wrong', expected: exp.cumPct, given: ans.cumPct });
    } else {
      const u = vals.map((v) => v!.value);
      const ok = u.every((x, i) => within(x, exp.cumPct[i]!, { abs: T.paretoPctAbs, rel: T.meanSdRel }, null));
      let diagnosis: DiagnosisId | undefined;
      if (!ok && ex.dataset.kind === 'pareto') {
        const items0 = ex.dataset.items;
        const total = D.sum(items0.map((i) => i.value));
        let c = D.ZERO;
        const unsorted = items0.map((i) => D.toNumber((c = D.add(c, D.div(D.mul(i.value, D.q(100)), total)))));
        const differs = unsorted.some((x, i) => Math.abs(x - exp.cumPct[i]!) > T.paretoPctAbs);
        const matches = differs && u.every((x, i) => Math.abs(x - unsorted[i]!) <= T.paretoPctAbs);
        diagnosis = matches ? 'pareto-unsorted' : 'not-identified';
      }
      items.push({ part: 'cumPct', status: ok ? 'correct' : 'wrong', expected: exp.cumPct, given: u, ...(diagnosis ? { diagnosis } : {}) });
    }
  }
  // class A
  if (!ans?.classA?.trim()) items.push({ part: 'classA', status: 'missing', expected: exp.classA });
  else {
    const g = parseLabels(ans.classA);
    items.push({ part: 'classA', status: classAValid(exp, g) ? 'correct' : 'wrong', expected: exp.classA, given: g });
  }
  return items;
}

function gradeAsk(ex: Exercise, ask: Ask, ans: Answer | undefined, T: Tolerances): AskResult {
  const exp: Expected = solveAsk(ex, ask);
  let items: ItemResult[];
  switch (exp.kind) {
    case 'number':
      items = [gradeNumber(ex, ask, exp, ans, T)];
      break;
    case 'limits':
      items = gradeLimits(ex, ask, exp, ans, T);
      break;
    case 'choice': {
      const c = ans?.choice?.trim();
      items = [!c ? { part: 'choice', status: 'missing', expected: exp.value } : { part: 'choice', status: c === exp.value ? 'correct' : 'wrong', expected: exp.value, given: c }];
      break;
    }
    case 'set': {
      const raw = ans?.set?.trim();
      if (raw === undefined) items = [{ part: 'set', status: 'missing', expected: exp.value }];
      else {
        const g = parseIntSet(raw);
        items = [
          g === null
            ? { part: 'set', status: 'invalid', expected: exp.value, given: raw }
            : { part: 'set', status: JSON.stringify(g) === JSON.stringify(exp.value) ? 'correct' : 'wrong', expected: exp.value, given: g },
        ];
      }
      break;
    }
    case 'pareto':
      items = gradePareto(ex, exp, ans, T);
      break;
  }
  const correct = items.filter((i) => i.status === 'correct').length;
  const score = correct / items.length;
  const statuses = new Set(items.map((i) => i.status));
  const status: AskResult['status'] =
    statuses.size === 1 ? items[0]!.status : correct > 0 ? 'partial' : statuses.has('wrong') ? 'wrong' : statuses.has('invalid') ? 'invalid' : 'missing';
  return { id: ask.id, type: ask.type, status, score, items };
}

/** Grades all asks; score on 0–10 weighted by exercise.weights (spec §8.4). */
export function grade(ex: Exercise, answers: Record<string, Answer>, T: Tolerances = DEFAULT_TOLERANCES): GradeResult {
  const asks = ex.asks.map((a) => gradeAsk(ex, a, answers[a.id], T));
  let wsum = 0;
  let acc = 0;
  for (const r of asks) {
    const w = ex.weights[r.id] ?? 1;
    wsum += w;
    acc += w * r.score;
  }
  return { asks, score10: wsum > 0 ? (10 * acc) / wsum : 0 };
}

/** Re-exported for the UI (verdict helper with the exercise thresholds). */
export { capableVerdict };

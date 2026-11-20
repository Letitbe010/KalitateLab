/**
 * Worked exercises (spec §15): steps built at run time from a verified pool exercise.
 * Each step has three layers: what (the calculation; every number comes from the solvers via
 * solutionFor), why (the reason) and careful (the usual mistake, linked to the grader's
 * diagnosis). The text templates contain no numbers (tests/worked.test.ts).
 */
import type { Ask, Exercise } from '../core/model';
import { dataDecimals, solveAsk } from '../core/solve';
import { askLabel } from './describe';
import { fmt, fmtDec } from './format';
import { solutionFor } from './solution';

type T = (k: string, v?: Record<string, string | number>) => string;

export interface WStep {
  key: string;
  title: string;
  what: string[];
  why?: string;
  careful?: string;
  /** theory topic for the "why" layer (spec §14.1 numbering; linked in phase 7) */
  topic?: string;
}

const TOPIC: Partial<Record<Ask['type'], string>> = {
  mean: 'descriptive',
  sd: 'descriptive',
  pctSample: 'defects',
  pctPopulation: 'defects',
  z: 'normal',
  cp: 'capability',
  cpk: 'capability',
  cpu: 'capability',
  cpl: 'capability',
  capable: 'capability',
  centered: 'capability',
  sigmaHat: 'capability',
  controlLimits: 'charts',
  outOfControl: 'charts',
  pareto: 'pareto',
};

/** Key suffix for asks whose explanation depends on the chart. */
const variant = (ask: Ask): string => (ask.type === 'controlLimits' && ask.chart ? `${ask.type}.${ask.chart}` : ask.type);

const has = (t: T, key: string): string | undefined => {
  const v = t(key);
  return v === key ? undefined : v;
};

function readStep(ex: Exercise, t: T): WStep {
  const ds = ex.dataset;
  const what: string[] = [];
  const u = 'unit' in ds ? ds.unit : '';
  switch (ds.kind) {
    case 'freq':
      what.push(t('wk.read.freq', { k: ds.classes.length, n: ds.classes.reduce((a, c) => a + c.f, 0) }));
      break;
    case 'values':
      what.push(t('wk.read.values', { n: ds.values.length, d: dataDecimals(ds) }));
      break;
    case 'subgroups':
      what.push(t('wk.read.subgroups', { k: ds.groups.length, n: ds.groups[0]!.length }));
      break;
    case 'summary':
      what.push(`x̄ = ${fmtDec(ds.mean)} ${u}; ${ds.sdKind === 's' ? 's' : 'σ'} = ${fmtDec(ds.sd)} ${u}${ds.n !== undefined ? `; n = ${ds.n}` : ''}`);
      break;
    case 'attributes':
      what.push(t('wk.read.attributes', { k: ds.samples.length, n: ds.samples[0]!.n }));
      break;
    case 'pareto':
      what.push(t('wk.read.pareto', { k: ds.items.length }));
      break;
  }
  if (ex.spec?.lsl || ex.spec?.usl) {
    const parts = [ex.spec.designation, ex.spec.lsl ? `${t('spec.lsl')} = ${fmtDec(ex.spec.lsl)}` : '', ex.spec.usl ? `${t('spec.usl')} = ${fmtDec(ex.spec.usl)}` : ''].filter(Boolean);
    what.push(`${t('data.spec')}: ${parts.join(' · ')} ${u}`);
  }
  if (ex.rules.sd === 'either' && ex.asks.some((a) => a.type === 'sd' || a.type === 'pctPopulation')) what.push(t('wk.read.either'));
  return {
    key: 'read',
    title: t('wk.read.title'),
    what,
    ...(has(t, `wk.read.why.${ds.kind}`) ? { why: t(`wk.read.why.${ds.kind}`) } : {}),
    ...(has(t, `wk.read.careful.${ds.kind}`) ? { careful: t(`wk.read.careful.${ds.kind}`) } : {}),
  };
}

/** One line per ask with the final answer (the grader's expected values). */
export function summaryLines(ex: Exercise, t: T): string[] {
  const minDec = dataDecimals(ex.dataset) + 2;
  return ex.asks.map((ask, i) => {
    const e = solveAsk(ex, ask);
    const lbl = `${String.fromCharCode(97 + i)}) ${askLabel(ex, ask, t)}`;
    switch (e.kind) {
      case 'number': {
        const unit = e.quantity === 'percent' ? ' %' : e.quantity === 'length' && 'unit' in ex.dataset ? ` ${ex.dataset.unit}` : '';
        const dec = e.quantity === 'length' ? minDec : 0;
        return `${lbl}: ${e.accepted.map((a) => `${fmt(a.value, dec, 4, dec === 0)}${unit}`).join(' / ')}`;
      }
      case 'limits': {
        const dec = ex.dataset.kind === 'subgroups' ? minDec : 0;
        const f = (v: number) => fmt(v, dec, ex.dataset.kind === 'subgroups' ? 4 : 5, dec === 0);
        return `${lbl}: ${t('field.cl')} = ${f(e.cl)}; ${t('field.ucl')} = ${f(e.ucl)}; ${t('field.lcl')} = ${f(e.lcl)}`;
      }
      case 'choice':
        return `${lbl}: ${t(`choice.${e.value}`)}`;
      case 'set':
        return `${lbl}: ${e.value.length ? e.value.join(', ') : t('sol.none')}`;
      case 'pareto':
        return `${lbl}: ${e.order.join(' > ')} · A = ${e.classA.join(', ')}`;
    }
  });
}

export function buildWorked(ex: Exercise, t: T): WStep[] {
  const steps: WStep[] = [readStep(ex, t)];
  for (const ask of ex.asks) {
    const v = variant(ask);
    const why = has(t, `wk.why.${v}`) ?? has(t, `wk.why.${ask.type}`);
    const careful = has(t, `wk.careful.${v}`) ?? has(t, `wk.careful.${ask.type}`);
    steps.push({
      key: ask.id,
      title: askLabel(ex, ask, t),
      what: solutionFor(ex, ask, t).lines,
      ...(why ? { why } : {}),
      ...(careful ? { careful } : {}),
      ...(TOPIC[ask.type] ? { topic: TOPIC[ask.type] } : {}),
    });
  }
  steps.push({ key: 'summary', title: t('wk.summary.title'), what: summaryLines(ex, t) });
  return steps;
}

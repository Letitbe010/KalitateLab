/**
 * Template variables for theory examples (spec §14.3): texts carry {{…}} variables, never
 * hand-written numbers. Every value is computed here from the solvers on a pool exercise.
 *
 *   {{a:ID}}      expected answer of ask ID (all accepted variants, with units)
 *   {{n}}         number of data (or n of the summary)
 *   {{mu}}        mean used by the process statistics;  {{sd}} its σ (primary rule)
 *   {{s}} {{sn}}  sample (n − 1) and population (n) deviations of raw data
 *   {{lsl}} {{usl}} {{tol}}   specification limits and tolerance width
 *   {{zl}} {{zu}} z of each limit;  {{pl}} {{pu}} % below LSL / above USL (normal)
 */
import * as D from '../core/decimal';
import { describe as describeDs } from '../core/descriptive';
import type { Exercise } from '../core/model';
import { populationDefects } from '../core/normal';
import { dataDecimals, processStats } from '../core/solve';
import { fixed, fmt, fmtDec, specDecimals } from './format';
import { summaryLines } from './worked';

export class TemplateError extends Error {}

type T = (k: string, v?: Record<string, string | number>) => string;

export function fillTemplate(text: string, ex: Exercise, t: T): string {
  const ds = ex.dataset;
  const u = 'unit' in ds ? ds.unit : '';
  const dd = dataDecimals(ds) + 2;
  const L = (x: number) => `${fmt(x, dd, 4, false)} ${u}`.trim();
  const raw = ds.kind === 'values' || ds.kind === 'freq' || ds.kind === 'subgroups';
  const summary = summaryLines(ex, t);
  const st = () => processStats(ex);
  const lim = (k: 'lsl' | 'usl') => {
    const v = ex.spec?.[k];
    if (!v) throw new TemplateError(`${ex.id} has no ${k}`);
    return v;
  };
  const defects = () => {
    const s = st();
    return populationDefects(s.mu, s.sigma, ex.spec?.lsl ? D.toNumber(ex.spec.lsl) : undefined, ex.spec?.usl ? D.toNumber(ex.spec.usl) : undefined);
  };
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, body: string) => {
    const [k, a = ''] = body.split(':');
    switch (k) {
      case 'a': {
        const i = ex.asks.findIndex((x) => x.id === a);
        if (i < 0) throw new TemplateError(`${ex.id} has no ask ${a}`);
        return summary[i]!.replace(/^[a-z]\)[^:]*:\s*/, '');
      }
      case 'n':
        if (raw) return String(describeDs(ds).n);
        if (ds.kind === 'summary' && ds.n !== undefined) return String(ds.n);
        throw new TemplateError(`${ex.id}: no n`);
      // summary data are shown as given (20,01, not 20,01000)
      case 'mu':
        return ds.kind === 'summary' ? `${fmtDec(ds.mean)} ${u}` : L(st().mu);
      case 'sd':
        return ds.kind === 'summary' ? `${fmtDec(ds.sd)} ${u}` : L(st().sigma);
      case 's':
        if (!raw) throw new TemplateError(`${ex.id}: no raw data`);
        return L(describeDs(ds).s);
      case 'sn':
        if (!raw) throw new TemplateError(`${ex.id}: no raw data`);
        return L(describeDs(ds).sigma);
      case 'lsl':
        return `${fixed(lim('lsl'), specDecimals(ex.spec?.lsl, ex.spec?.usl))} ${u}`;
      case 'usl':
        return `${fixed(lim('usl'), specDecimals(ex.spec?.lsl, ex.spec?.usl))} ${u}`;
      case 'tol':
        return `${fixed(D.sub(lim('usl'), lim('lsl')), specDecimals(ex.spec?.lsl, ex.spec?.usl))} ${u}`;
      case 'zl':
        return fmt(defects().zL!);
      case 'zu':
        return fmt(defects().zU!);
      case 'pl':
        return `${fmt(100 * defects().below!)} %`;
      case 'pu':
        return `${fmt(100 * defects().above!)} %`;
      default:
        throw new TemplateError(`unknown variable ${body}`);
    }
  });
}

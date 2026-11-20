/**
 * The exercise data, always available (spec §6), with a copy button that puts the numbers on
 * the clipboard (tab-separated, decimal comma) for the calculator or a spreadsheet.
 */
import { useState } from 'react';
import type { Exercise } from '../core/model';
import { useT } from '../i18n';
import * as D from '../core/decimal';
import type { Decimal } from '../core/decimal';
import { dataDecimals } from '../core/solve';
import { decimalsOf, fmtDec } from './format';

function rowsOf(ex: Exercise, t: (k: string, v?: Record<string, string | number>) => string): { head: string[]; rows: string[][] } {
  const ds = ex.dataset;
  // measurements keep the instrument resolution (50,000 is not shown as 50)
  const k = dataDecimals(ds);
  const m = (x: Decimal): string => (k <= 6 ? D.toFixed(x, k).replace('.', ',').replace('-', '−') : fmtDec(x));
  switch (ds.kind) {
    case 'freq':
      return {
        head: [ds.classes[0]?.x ? t('data.x', { u: ds.unit }) : t('data.class', { u: ds.unit }), t('data.f')],
        rows: ds.classes.map((c) => [c.x ? m(c.x) : `${m(c.a!)} – ${m(c.b!)}`, String(c.f)]),
      };
    case 'values':
      return { head: [t('data.x', { u: ds.unit })], rows: ds.values.map((v) => [m(v)]) };
    case 'subgroups':
      return {
        head: [t('data.subgroup'), ...ds.groups[0]!.map((_, i) => t('data.piece', { i: i + 1 }))],
        rows: ds.groups.map((g, i) => [String(i + 1), ...g.map(m)]),
      };
    case 'summary':
      return {
        head: ['', ''],
        rows: [
          [t('data.mean'), `${fmtDec(ds.mean)} ${ds.unit}`],
          [t(`data.sd.${ds.sdKind}`), `${fmtDec(ds.sd)} ${ds.unit}`],
          ...(ds.n !== undefined ? [['n', String(ds.n)]] : []),
        ],
      };
    case 'attributes':
      return {
        head: [t('data.sample'), t('data.n'), t(`data.defects.${ds.chart}`)],
        rows: ds.samples.map((s, i) => [String(i + 1), String(s.n), String(s.defects)]),
      };
    case 'pareto':
      return { head: [t('data.cause'), t('data.value')], rows: ds.items.map((i) => [i.label, fmtDec(i.value)]) };
  }
}

export function DataTable({ ex }: { ex: Exercise }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const { head, rows } = rowsOf(ex, t);
  const spec = ex.spec;
  // specification limits share the precision of the most precise one (19,960, not 19,96)
  const specDec = spec ? Math.max(0, ...[spec.lsl, spec.usl].filter((v): v is Decimal => !!v).map((v) => decimalsOf(v))) : 0;
  const sp = (v: Decimal): string => D.toFixed(v, specDec).replace('.', ',').replace('-', '−');
  const copy = () => {
    const text = rows.map((r) => r.join('\t')).join('\n');
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };
  return (
    <section className="data" aria-label={t('data.title')}>
      <div className="data-head">
        <h2 className="sec">{t('data.title')}</h2>
        <button className="small" onClick={copy}>
          {copied ? t('data.copied') : t('data.copy')}
        </button>
      </div>
      {spec && (spec.lsl || spec.usl) && (
        <p className="spec-line">
          {t('data.spec')}: {spec.designation ? `${spec.designation} → ` : ''}
          {spec.lsl ? `${t('spec.lsl')} = ${sp(spec.lsl)}` : ''}
          {spec.lsl && spec.usl ? ' · ' : ''}
          {spec.usl ? `${t('spec.usl')} = ${sp(spec.usl)}` : ''} {'unit' in ex.dataset ? ex.dataset.unit : ''}
        </p>
      )}
      <div className="table-wrap">
        <table className="dtable">
          {head.some(Boolean) && (
            <thead>
              <tr>
                {head.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (j === 0 && head.some(Boolean) ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

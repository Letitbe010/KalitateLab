/**
 * Worked exercises (spec §15.2): "next step" mode or "show all"; each step with
 * what / why / careful. At the end: "now you" opens a new exercise of the same template.
 */
import { useMemo, useState } from 'react';
import worked from '../data/worked.json';
import { poolById } from '../data/pool';
import { useT } from '../i18n';
import { DataTable } from './DataTable';
import { hrefOf, randomSeed } from './router';
import { buildWorked } from './worked';

export interface WorkedEntry {
  id: string;
  pool: string;
  nowYou: { template: string; level: number };
  title: { eu: string; es: string };
  review?: string;
}
export const WORKED: WorkedEntry[] = worked.worked as WorkedEntry[];

export function WorkedList() {
  const { t, lang } = useT();
  return (
    <section className="card">
      <h1>{t('nav.workedTitle')}</h1>
      <p className="lead">{t('wk.lead')}</p>
      <div className="tiles">
        {WORKED.map((w, i) => (
          <a key={w.id} className="tile" href={hrefOf({ name: 'workedItem', id: w.id })}>
            <span className="tags">
              <span className="tag">{i + 1}</span>
              {w.review !== 'reviewed' && <span className="tag warn">{t('wk.draft')}</span>}
            </span>
            <b>{w.title[lang]}</b>
          </a>
        ))}
      </div>
    </section>
  );
}

export function WorkedItem({ id }: { id: string }) {
  const { t, lang } = useT();
  const entry = WORKED.find((w) => w.id === id);
  const ex = entry ? poolById(entry.pool) : undefined;
  const steps = useMemo(() => (ex ? buildWorked(ex, t) : []), [ex, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shown, setShown] = useState(1);
  if (!entry || !ex)
    return (
      <section className="card">
        <a href={hrefOf({ name: 'worked' })}>← {t('nav.worked')}</a>
        <p className="note warn">{t('ex.notFound')}</p>
      </section>
    );
  const finished = shown >= steps.length;
  const nowYou = () => {
    window.location.hash = hrefOf({ name: 'generated', template: entry.nowYou.template, level: entry.nowYou.level, seed: randomSeed() });
  };
  return (
    <section className="card exercise">
      <div className="ex-top">
        <a href={hrefOf({ name: 'worked' })}>← {t('nav.worked')}</a>
        <span className="tags">{entry.review !== 'reviewed' && <span className="tag warn">{t('wk.draft')}</span>}</span>
      </div>
      <h1>{entry.title[lang]}</h1>
      <p className="statement">{ex.text[lang]}</p>
      <DataTable ex={ex} />

      <ol className="steps wsteps">
        {steps.slice(0, shown).map((s, i) => (
          <li key={s.key} className={`wstep${i === shown - 1 && !finished ? ' current' : ''}`}>
            <header>
              <span className="tag">{t('wk.stepOf', { i: i + 1, n: steps.length })}</span>
              <b>{s.title}</b>
            </header>
            {s.what.map((l, k) => (
              <p key={k} className="mono">
                {l}
              </p>
            ))}
            {s.why && (
              <p className="why">
                <b>{t('wk.whyLabel')}:</b> {s.why}
              </p>
            )}
            {s.careful && (
              <p className="careful">
                <b>{t('wk.carefulLabel')}</b> {s.careful}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="actions">
        {!finished && (
          <>
            <button className="primary" onClick={() => setShown((n) => n + 1)}>
              {t('wk.next')}
            </button>
            <button onClick={() => setShown(steps.length)}>{t('wk.all')}</button>
          </>
        )}
        {finished && (
          <>
            <button className="primary" onClick={nowYou}>
              {t('wk.nowYou')}
            </button>
            <a className="btn-link" href={hrefOf({ name: 'pool', id: ex.id })}>
              {t('wk.practice')}
            </a>
            <button onClick={() => setShown(1)}>{t('wk.restart')}</button>
          </>
        )}
      </div>
    </section>
  );
}

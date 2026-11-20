/**
 * Practice exercise screen (spec §13.1): ① statement → ② solve → ③ grading → ④ solution.
 * The data table is always visible; charts that would give the answer away (normal curve,
 * control limits, Pareto) appear only after grading (spec §6), with the user's answer overlaid.
 */
import { useMemo, useState } from 'react';
import { attributeChart, xbarRChart, xbarSChart } from '../core/charts';
import * as D from '../core/decimal';
import { describe as describeDs, weightedPoints } from '../core/descriptive';
import { generate, LEVELS, TEMPLATES, type TemplateId } from '../core/generator';
import { type Answer, type GradeResult, grade, parseUserNumber } from '../core/grader';
import type { Exercise } from '../core/model';
import { pareto } from '../core/pareto';
import { dataDecimals, processStats } from '../core/solve';
import { poolById } from '../data/pool';
import { useT } from '../i18n';
import { AnswerForm } from './AnswerForm';
import { ControlChart, HistogramChart, ParetoChart } from './charts/Charts';
import { DataTable } from './DataTable';
import { askLabel, exerciseTitle, letter, templateOf } from './describe';
import { fmt } from './format';
import { hrefOf, randomSeed } from './router';
import { solutionFor } from './solution';
import { loadAnswers, saveAnswers } from './store';

export type ExerciseSource = { kind: 'generated'; template: string; level: number; seed: number } | { kind: 'pool'; id: string };

type Loaded = { ok: true; ex: Exercise } | { ok: false; reason: 'notFound' | 'error' };

function load(src: ExerciseSource): Loaded {
  try {
    if (src.kind === 'pool') {
      const ex = poolById(src.id);
      return ex ? { ok: true, ex } : { ok: false, reason: 'notFound' };
    }
    const tpl = src.template as TemplateId;
    if (!TEMPLATES.includes(tpl) || !(LEVELS[tpl] as number[]).includes(src.level)) return { ok: false, reason: 'notFound' };
    return { ok: true, ex: generate(tpl, src.seed, src.level as 1 | 2 | 3).exercise };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

const STEPS = ['steps.statement', 'steps.solve', 'steps.grade', 'steps.solution'] as const;

/** Histogram bars from raw data (class marks or distinct values). */
function histogramOf(ex: Exercise): { bars: { x: number; f: number }[]; width: number } | null {
  const ds = ex.dataset;
  if (ds.kind !== 'freq' && ds.kind !== 'values' && ds.kind !== 'subgroups') return null;
  const m = new Map<number, number>();
  for (const p of weightedPoints(ds)) {
    const x = D.toNumber(p.x);
    m.set(x, (m.get(x) ?? 0) + p.f);
  }
  const bars = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([x, f]) => ({ x, f }));
  if (ds.kind === 'subgroups' || bars.length > 15) {
    // group into ~8 classes
    const lo = bars[0]!.x;
    const hi = bars[bars.length - 1]!.x;
    const w = (hi - lo) / 8 || 1;
    const g = new Map<number, number>();
    for (const b of bars) {
      const k = Math.min(7, Math.floor((b.x - lo) / w));
      const mid = lo + (k + 0.5) * w;
      g.set(mid, (g.get(mid) ?? 0) + b.f);
    }
    return { bars: [...g.entries()].map(([x, f]) => ({ x, f })), width: w };
  }
  const steps = bars.slice(1).map((b, i) => b.x - bars[i]!.x);
  return { bars, width: steps.length ? Math.min(...steps) : 10 ** -dataDecimals(ds) };
}

export function PracticeExercise({ source }: { source: ExerciseSource }) {
  const { t, lang } = useT();
  const loaded = useMemo(() => load(source), [source]);
  const exId = loaded.ok ? loaded.ex.id : '';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => (exId ? loadAnswers(exId) : {}));
  const [result, setResult] = useState<GradeResult | undefined>();

  if (!loaded.ok)
    return (
      <section className="card">
        <a href={hrefOf({ name: 'home' })}>{t('ex.back')}</a>
        <p className="note warn">{t(loaded.reason === 'notFound' ? 'ex.notFound' : 'ex.error')}</p>
      </section>
    );
  const ex = loaded.ex;
  const tpl = templateOf(ex);

  const onChange = (askId: string, patch: Partial<Answer>) =>
    setAnswers((prev) => {
      const next = { ...prev, [askId]: { ...(prev[askId] ?? {}), ...patch } };
      saveAnswers(ex.id, next);
      return next;
    });
  const check = () => {
    setResult(grade(ex, answers));
    setStep(2);
  };
  const another = () => {
    if (tpl) window.location.hash = hrefOf({ name: 'generated', template: tpl, level: ex.difficulty, seed: randomSeed() });
  };

  const graded = step >= 2;
  const hist = histogramOf(ex);
  const hasNormal = ex.asks.some((a) => ['pctPopulation', 'cp', 'cpk', 'cpu', 'cpl', 'capable', 'centered', 'z'].includes(a.type));
  const lsl = ex.spec?.lsl ? D.toNumber(ex.spec.lsl) : undefined;
  const usl = ex.spec?.usl ? D.toNumber(ex.spec.usl) : undefined;
  let normal: { mu: number; sigma: number; n?: number } | undefined;
  if (graded && hasNormal) {
    const st = processStats(ex);
    normal = { mu: st.mu, sigma: st.sigma, ...(hist ? { n: describeDs(ex.dataset).n } : {}) };
  }
  const userLimits = (askId: string) => {
    const a = answers[askId];
    const num = (s?: string) => parseUserNumber(s)?.value;
    const f = a?.unit === 'µm' ? 0.001 : 1;
    const v = { cl: num(a?.cl), ucl: num(a?.ucl), lcl: num(a?.lcl) };
    return {
      ...(v.cl !== undefined ? { cl: v.cl * f } : {}),
      ...(v.ucl !== undefined ? { ucl: v.ucl * f } : {}),
      ...(v.lcl !== undefined ? { lcl: v.lcl * f } : {}),
    };
  };
  const limitsAsk = (chart: string) => ex.asks.find((a) => a.type === 'controlLimits' && a.chart === chart);
  const dd = dataDecimals(ex.dataset) + 1;

  return (
    <section className="card exercise">
      <div className="ex-top">
        <a href={hrefOf({ name: 'home' })}>{t('ex.back')}</a>
        <span className="tags">
          <span className={`tag origin-${ex.origin}`}>{t(`origin.${ex.origin}`)}</span>
          <span className="tag">{t('home.level', { n: ex.difficulty })}</span>
          {ex.seed !== undefined && <span className="tag">{t('ex.seed', { s: ex.seed })}</span>}
          {ex.review !== 'approved' && ex.origin !== 'generated' && <span className="tag warn">{t('home.review')}</span>}
        </span>
      </div>
      <h1>{exerciseTitle(ex, t)}</h1>

      <ol className="stepper" aria-label="steps">
        {STEPS.map((k, i) => (
          <li key={k} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="num">{i + 1}</span> <span className="lbl">{t(k)}</span>
          </li>
        ))}
      </ol>

      <p className="statement">{ex.text[lang]}</p>
      {ex.origin === 'generated' && <p className="note small">{t('ex.draft')}</p>}
      {ex.sourceUrl && (
        <p className="source">
          {t('ex.source')}:{' '}
          <a href={ex.sourceUrl} target="_blank" rel="noreferrer">
            {exerciseTitle(ex, t)}
          </a>
        </p>
      )}

      <DataTable ex={ex} />

      {hist && <HistogramChart title={graded && normal ? t('chart.normal') : t('chart.histogram')} bars={hist.bars} width={hist.width} {...(lsl !== undefined ? { lsl } : {})} {...(usl !== undefined ? { usl } : {})} {...(normal ? { normal } : {})} />}
      {!hist && normal && <HistogramChart title={t('chart.normal')} {...(lsl !== undefined ? { lsl } : {})} {...(usl !== undefined ? { usl } : {})} normal={normal} />}

      {graded && ex.dataset.kind === 'subgroups' && limitsAsk('xbar') && (() => {
        const useS = ex.rules.sigmaHat === 'sbar/c4';
        const c = useS ? xbarSChart(ex.dataset.groups) : xbarRChart(ex.dataset.groups);
        const xl = 'outS' in c ? c.xbar : { cl: D.toNumber(c.xbar.cl), ucl: D.toNumber(c.xbar.ucl), lcl: D.toNumber(c.xbar.lcl) };
        const second = 'outS' in c ? { pts: c.sds, l: c.s, out: c.outS, name: 's' } : { pts: c.ranges.map(D.toNumber), l: { cl: D.toNumber(c.R.cl), ucl: D.toNumber(c.R.ucl), lcl: D.toNumber(c.R.lcl) }, out: c.outR, name: 'R' };
        return (
          <>
            <ControlChart title={`${t('chart.control')} X̄`} points={c.means.map(D.toNumber)} limits={[xl]} out={c.outXbar} user={userLimits(limitsAsk('xbar')!.id)} decimals={dd} />
            <ControlChart title={`${t('chart.control')} ${second.name}`} points={second.pts} limits={[second.l]} out={second.out} {...(limitsAsk(second.name) ? { user: userLimits(limitsAsk(second.name)!.id) } : {})} decimals={dd} />
          </>
        );
      })()}
      {graded && ex.dataset.kind === 'attributes' && (() => {
        const a = attributeChart(ex.dataset.chart, ex.dataset.samples);
        const la = limitsAsk(ex.dataset.chart);
        return <ControlChart title={`${t('chart.control')} ${ex.dataset.chart}`} points={a.points.map(D.toNumber)} limits={a.limits} out={a.out} {...(la ? { user: userLimits(la.id) } : {})} />;
      })()}
      {graded && ex.dataset.kind === 'pareto' && (() => {
        const r = pareto(ex.dataset.items, ex.rules.paretoThreshold ?? 80, ex.rules.paretoRule ?? 'crossing');
        return <ParetoChart title={t('chart.pareto')} threshold={ex.rules.paretoThreshold ?? 80} rows={r.rows.map((x) => ({ label: x.label, value: D.toNumber(x.value), cum: D.toNumber(x.cumPct) }))} />;
      })()}

      {step === 0 ? (
        <div className="actions">
          <button className="primary" onClick={() => setStep(1)}>
            {t('ex.start')}
          </button>
        </div>
      ) : (
        <>
          <AnswerForm ex={ex} answers={answers} onChange={onChange} {...(result ? { results: result.asks } : {})} disabled={graded} />
          <div className="actions">
            {step === 1 && (
              <button className="primary" onClick={check}>
                {t('ex.check')}
              </button>
            )}
            {graded && (
              <>
                <span className="score" role="status">
                  {t('ex.score', { s: fmt(result?.score10 ?? 0, 1, 2) })}
                </span>
                {step === 2 && (
                  <button className="primary" onClick={() => setStep(3)}>
                    {t('ex.showSolution')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setResult(undefined);
                    setStep(1);
                  }}
                >
                  {t('ex.retry')}
                </button>
                {tpl && <button onClick={another}>{t('ex.another')}</button>}
              </>
            )}
          </div>
        </>
      )}

      {step === 3 && (
        <section className="steps" aria-label={t('sol.title')}>
          <h2 className="sec">{t('sol.title')}</h2>
          {ex.asks.map((a, i) => (
            <article key={a.id} className="wstep">
              <h3>
                {letter(i)} {askLabel(ex, a, t)}
              </h3>
              {solutionFor(ex, a, t).lines.map((l, k) => (
                <p key={k} className="mono">
                  {l}
                </p>
              ))}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

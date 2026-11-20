/**
 * Interactive theory widgets (spec §14.2). They use the same core solvers as the grader:
 * no calculation is duplicated here.
 */
import { useState } from 'react';
import { capability, capableVerdict } from '../../core/capability';
import * as D from '../../core/decimal';
import { density, phi, populationDefects } from '../../core/normal';
import { poolById } from '../../data/pool';
import { useT } from '../../i18n';
import { HistogramChart } from '../charts/Charts';
import { fmt } from '../format';

/** Capability simulator: move μ and σ; curve, defective area, % and Cp/Cpk live. */
export function CapabilityWidget() {
  const { t } = useT();
  // the specification of a verified pool exercise (KQ1), so no number is hand-written here
  const spec = poolById('adapted-kq1')!.spec!;
  const lsl = D.toNumber(spec.lsl!);
  const usl = D.toNumber(spec.usl!);
  const T = usl - lsl;
  const [mu, setMu] = useState((lsl + usl) / 2);
  const [sigma, setSigma] = useState(T / 8);
  const cap = capability(spec, D.parse(mu.toFixed(4)), sigma);
  const p = populationDefects(mu, sigma, lsl, usl);
  const th: [number, number] = [1, 1.33];
  return (
    <div className="widget">
      <span className="lab">{t('th.w.capability')}</span>
      <label className="slider">
        <span>
          μ = {fmt(mu, 4, 6)} mm
        </span>
        <input type="range" min={lsl} max={usl} step={T / 240} value={mu} onChange={(e) => setMu(Number(e.target.value))} />
      </label>
      <label className="slider">
        <span>
          σ = {fmt(sigma, 4, 4)} mm
        </span>
        <input type="range" min={T / 30} max={T / 3} step={T / 600} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} />
      </label>
      <HistogramChart title={t('chart.normal')} lsl={lsl} usl={usl} normal={{ mu, sigma }} />
      <p className="mono" role="status">
        Cp = {fmt(cap.cp!)} · Cpk = {fmt(cap.cpk)} · % = {fmt(100 * p.total)} % ({fmt(1e6 * p.total)} ppm) → {t(`choice.${capableVerdict(cap.cpk, th)}`)} (Cpk)
      </p>
    </div>
  );
}

/** n vs n − 1: how the difference between s and σₙ shrinks as n grows. */
export function NvsN1Widget() {
  const { t } = useT();
  const [n, setN] = useState(5);
  const ratio = Math.sqrt(n / (n - 1));
  return (
    <div className="widget">
      <span className="lab">{t('th.w.nvsn1')}</span>
      <label className="slider">
        <span>n = {n}</span>
        <input type="range" min={2} max={100} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
      </label>
      <p className="mono" role="status">
        s / σₙ = √(n / (n − 1)) = {fmt(ratio)} → s {fmt(100 * (ratio - 1), 1, 2)} % {t('th.w.larger')}
      </p>
      <div className="meter" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (ratio - 1) * 240)}%` }} />
      </div>
    </div>
  );
}

/** The 68–95–99,73 rule on the standard normal; the percentages come from Φ. */
export function EmpiricalFigure() {
  const { t } = useT();
  const W = 640;
  const H = 210;
  const X = (z: number) => 30 + ((z + 4) / 8) * (W - 60);
  const Y = (y: number) => H - 30 - (y / density(0)) * (H - 50);
  const pts = Array.from({ length: 161 }, (_, i) => -4 + i / 20);
  const band = (k: number) =>
    `M${X(-k)},${Y(0)} ` +
    pts
      .filter((z) => z >= -k && z <= k)
      .map((z) => `L${X(z)},${Y(density(z))}`)
      .join(' ') +
    ` L${X(k)},${Y(0)} Z`;
  return (
    <figure className="chart">
      <figcaption>{t('th.f.empirical')}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('th.f.empirical')}>
        {[3, 2, 1].map((k) => (
          <path key={k} className={`band b${k}`} d={band(k)} />
        ))}
        <path className="curve" d={pts.map((z, i) => `${i ? 'L' : 'M'}${X(z)},${Y(density(z))}`).join(' ')} />
        <line className="axis" x1={X(-4)} x2={X(4)} y1={Y(0)} y2={Y(0)} />
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <text key={k} className="tick" x={X(k)} y={H - 12} textAnchor="middle">
            {k === 0 ? 'μ' : `μ ${k > 0 ? '+' : '−'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}σ`}
          </text>
        ))}
        {[1, 2, 3].map((k) => (
          <text key={k} className="lbl" x={X(0)} y={Y(density(0)) + 18 + (k - 1) * 22} textAnchor="middle">
            ±{k}σ: {fmt(100 * (phi(k) - phi(-k)), 2, 4)} %
          </text>
        ))}
      </svg>
    </figure>
  );
}

export function TheoryWidget({ w }: { w: 'capability' | 'nvsn1' | 'control' | 'constants' }) {
  if (w === 'capability') return <CapabilityWidget />;
  if (w === 'nvsn1') return <NvsN1Widget />;
  return null;
}

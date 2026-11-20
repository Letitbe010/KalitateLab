/**
 * Hand-made SVG charts (spec §6, colour code §13.2):
 *   specification limits red · control limits blue · centre line grey · data dark grey ·
 *   defective area light red · the user's answer dashed orange.
 * Every chart has an aria-label; the numbers are always in the data table as well.
 */
import { density } from '../../core/normal';
import { useT } from '../../i18n';
import { fmt } from '../format';

const W = 640;
const H = 250;
const PAD = { l: 52, r: 16, t: 14, b: 34 };

function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

function ticks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const step0 = span / n;
  const p = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

function Legend({ items }: { items: { cls: string; label: string }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`sw ${i.cls}`} aria-hidden="true" /> {i.label}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ histogram + normal

export interface HistogramProps {
  bars?: { x: number; f: number }[];
  width?: number; // bar width in data units
  lsl?: number;
  usl?: number;
  /** normal curve (shown only after answering, spec §6) */
  normal?: { mu: number; sigma: number; n?: number };
  title: string;
}

export function HistogramChart({ bars, width, lsl, usl, normal, title }: HistogramProps) {
  const { t } = useT();
  const xs: number[] = [];
  if (bars) for (const b of bars) xs.push(b.x - (width ?? 0) / 2, b.x + (width ?? 0) / 2);
  if (lsl !== undefined) xs.push(lsl);
  if (usl !== undefined) xs.push(usl);
  if (normal) xs.push(normal.mu - 4 * normal.sigma, normal.mu + 4 * normal.sigma);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const padX = (hi - lo) * 0.05;
  const X = scale(lo - padX, hi + padX, PAD.l, W - PAD.r);
  // y in counts when there are bars, else in density
  const n = normal?.n ?? (bars ? bars.reduce((a, b) => a + b.f, 0) : 1);
  const curve = (x: number) => (normal ? (density((x - normal.mu) / normal.sigma) / normal.sigma) * (bars ? n * (width ?? 1) : 1) : 0);
  const ymax = Math.max(bars ? Math.max(...bars.map((b) => b.f)) : 0, normal ? curve(normal.mu) : 0) * 1.12 || 1;
  const Y = scale(0, ymax, H - PAD.b, PAD.t);
  const pts = normal ? Array.from({ length: 161 }, (_, i) => lo - padX + ((hi - lo + 2 * padX) * i) / 160) : [];
  const tail = (a: number, b: number) => {
    const xs2 = pts.filter((x) => x >= a && x <= b);
    if (xs2.length < 2) return '';
    return `M${X(xs2[0]!)},${Y(0)} ` + xs2.map((x) => `L${X(x)},${Y(curve(x))}`).join(' ') + ` L${X(xs2[xs2.length - 1]!)},${Y(0)} Z`;
  };
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks(lo, hi).map((v) => (
          <g key={v}>
            <line className="grid" x1={X(v)} x2={X(v)} y1={PAD.t} y2={H - PAD.b} />
            <text className="tick" x={X(v)} y={H - PAD.b + 16} textAnchor="middle">
              {fmt(v, 0, 5)}
            </text>
          </g>
        ))}
        {normal && lsl !== undefined && <path className="defects" d={tail(lo - padX, lsl)} />}
        {normal && usl !== undefined && <path className="defects" d={tail(usl, hi + padX)} />}
        {bars?.map((b) => (
          <rect key={b.x} className="hbar" x={X(b.x - (width ?? 0) / 2) + 1} width={Math.max(2, X(b.x + (width ?? 0) / 2) - X(b.x - (width ?? 0) / 2) - 2)} y={Y(b.f)} height={Y(0) - Y(b.f)} />
        ))}
        {normal && <path className="curve" d={pts.map((x, i) => `${i ? 'L' : 'M'}${X(x)},${Y(curve(x))}`).join(' ')} />}
        {[lsl, usl].map((v, i) =>
          v === undefined ? null : (
            <g key={i}>
              <line className="spec" x1={X(v)} x2={X(v)} y1={PAD.t} y2={H - PAD.b} />
              <text className="lbl spec-t" x={X(v)} y={PAD.t + 10} textAnchor={i ? 'end' : 'start'} dx={i ? -4 : 4}>
                {i ? t('spec.usl') : t('spec.lsl')}
              </text>
            </g>
          ),
        )}
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={Y(0)} y2={Y(0)} />
      </svg>
      <Legend
        items={[
          ...(bars ? [{ cls: 'hbar', label: t('legend.data') }] : []),
          ...(lsl !== undefined || usl !== undefined ? [{ cls: 'spec', label: t('legend.spec') }] : []),
          ...(normal ? [{ cls: 'defects', label: t('legend.defects') }] : []),
        ]}
      />
    </figure>
  );
}

// ------------------------------------------------------------------ control chart

export interface ControlProps {
  title: string;
  points: number[];
  limits: { cl: number; ucl: number; lcl: number }[]; // one per point, or a single entry
  out?: number[]; // 1-based
  user?: { cl?: number; ucl?: number; lcl?: number };
  decimals?: number;
}

export function ControlChart({ title, points, limits, out, user, decimals = 0 }: ControlProps) {
  const { t } = useT();
  const L = (i: number) => limits[Math.min(i, limits.length - 1)]!;
  const vals = [...points, ...limits.flatMap((l) => [l.ucl, l.lcl]), ...(user ? [user.ucl, user.lcl, user.cl].filter((v): v is number => v !== undefined && Number.isFinite(v)) : [])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.08;
  const Y = scale(lo - pad, hi + pad, H - PAD.b, PAD.t);
  const X = scale(0.5, points.length + 0.5, PAD.l, W - PAD.r);
  const stepLine = (key: 'cl' | 'ucl' | 'lcl') =>
    limits.length === 1
      ? `M${X(0.5)},${Y(limits[0]![key])} L${X(points.length + 0.5)},${Y(limits[0]![key])}`
      : points.map((_, i) => `${i ? 'L' : 'M'}${X(i + 0.5)},${Y(L(i)[key])} L${X(i + 1.5)},${Y(L(i)[key])}`).join(' ');
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks(lo - pad, hi + pad, 4).map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} />
            <text className="tick" x={PAD.l - 6} y={Y(v) + 4} textAnchor="end">
              {fmt(v, decimals, 5)}
            </text>
          </g>
        ))}
        <path className="cl" d={stepLine('cl')} />
        <path className="limit" d={stepLine('ucl')} />
        <path className="limit" d={stepLine('lcl')} />
        {user &&
          (['ucl', 'lcl', 'cl'] as const).map((k) =>
            user[k] !== undefined && Number.isFinite(user[k]) ? <line key={k} className="user" x1={X(0.5)} x2={X(points.length + 0.5)} y1={Y(user[k]!)} y2={Y(user[k]!)} /> : null,
          )}
        <path className="series" d={points.map((p, i) => `${i ? 'L' : 'M'}${X(i + 1)},${Y(p)}`).join(' ')} />
        {points.map((p, i) => {
          const isOut = out?.includes(i + 1);
          return <circle key={i} className={isOut ? 'pt out' : 'pt'} cx={X(i + 1)} cy={Y(p)} r={isOut ? 6 : 3.5} />;
        })}
        {points.map((_, i) =>
          points.length <= 25 || i % 2 === 0 ? (
            <text key={i} className="tick" x={X(i + 1)} y={H - PAD.b + 16} textAnchor="middle">
              {i + 1}
            </text>
          ) : null,
        )}
      </svg>
      <Legend
        items={[
          { cls: 'series', label: t('legend.data') },
          { cls: 'cl', label: t('legend.cl') },
          { cls: 'limit', label: t('legend.limits') },
          ...(out && out.length ? [{ cls: 'out', label: t('legend.out') }] : []),
          ...(user ? [{ cls: 'user', label: t('legend.user') }] : []),
        ]}
      />
    </figure>
  );
}

// ------------------------------------------------------------------ Pareto

export function ParetoChart({ title, rows, threshold }: { title: string; rows: { label: string; value: number; cum: number }[]; threshold: number }) {
  const { t } = useT();
  const vmax = Math.max(...rows.map((r) => r.value)) * 1.1;
  const total = rows.reduce((a, r) => a + r.value, 0);
  const X = scale(0, rows.length, PAD.l, W - 44);
  const Yv = scale(0, Math.max(vmax, total), H - PAD.b, PAD.t);
  const Yp = scale(0, 100, H - PAD.b, PAD.t);
  const bw = (X(1) - X(0)) * 0.7;
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {[0, 20, 40, 60, 80, 100].map((p) => (
          <g key={p}>
            <line className="grid" x1={PAD.l} x2={W - 44} y1={Yp(p)} y2={Yp(p)} />
            <text className="tick" x={W - 40} y={Yp(p) + 4}>
              {p} %
            </text>
          </g>
        ))}
        <line className="threshold" x1={PAD.l} x2={W - 44} y1={Yp(threshold)} y2={Yp(threshold)} />
        {rows.map((r, i) => (
          <g key={r.label}>
            <rect className="hbar" x={X(i + 0.5) - bw / 2} width={bw} y={Yv(r.value)} height={Yv(0) - Yv(r.value)} />
            <text className="tick" x={X(i + 0.5)} y={H - PAD.b + 16} textAnchor="middle">
              {r.label}
            </text>
          </g>
        ))}
        <path className="cum" d={rows.map((r, i) => `${i ? 'L' : 'M'}${X(i + 0.5)},${Yp(r.cum)}`).join(' ')} />
        {rows.map((r, i) => (
          <circle key={r.label} className="pt" cx={X(i + 0.5)} cy={Yp(r.cum)} r={3.5} />
        ))}
      </svg>
      <Legend
        items={[
          { cls: 'hbar', label: t('data.value') },
          { cls: 'cum', label: t('legend.cum') },
          { cls: 'threshold', label: `${t('legend.threshold')} (${threshold} %)` },
        ]}
      />
    </figure>
  );
}

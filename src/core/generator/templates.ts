/**
 * Exercise templates (spec §10.2). Reverse design: start from a target situation (nice z, Cp,
 * Cpk, a shifted subgroup…), build data that produce it, round the data as they will be shown,
 * and let solve.ts recompute every answer from the shown data (spec §8.1).
 */
import * as D from '../decimal';
import type { Decimal } from '../decimal';
import type { Ask, ChartKind, Exercise, Rules, Spec } from '../model';
import { binomial, poisson, type Rng } from './rng';
import { CAUSES, fd, sdRuleText, sideText, specText, thresholdsText } from './text';

export type TemplateId = 'freqTable' | 'defectsSummary' | 'capabilitySummary' | 'capabilitySubgroups' | 'xbarR' | 'attributes' | 'pareto';
export const TEMPLATES: TemplateId[] = ['freqTable', 'defectsSummary', 'capabilitySummary', 'capabilitySubgroups', 'xbarR', 'attributes', 'pareto'];

type Level = 1 | 2 | 3;
type Draft = Omit<Exercise, 'id' | 'origin' | 'seed'>;

/** Decimal rounded to k digits from a float. */
const dk = (x: number, k: number): Decimal => D.parse(x.toFixed(k));
const NOMINALS = [10, 12, 16, 20, 23.5, 25, 30, 35, 40, 45, 50, 63];

function base(difficulty: Level, rules: Rules, dataset: Exercise['dataset'], asks: Ask[], weights: Record<string, number>, text: { eu: string; es: string }, spec?: Spec): Draft {
  return { difficulty, rules, dataset, asks, weights, text, ...(spec ? { spec } : {}) };
}

// ------------------------------------------------------------------ 1. frequency table (Euskadi 2020 style)

function freqTable(r: Rng, level: Level): Draft {
  const N = r.pick(NOMINALS);
  const t = r.pick([0.2, 0.3]);
  const steps = Math.round(t / 0.1);
  const n = r.int(20, level === 1 ? 30 : 50);
  const mu = N + r.normal(0, 0.15 * t);
  const sd = t * (0.35 + 0.25 * r.next());
  const counts = new Map<number, number>();
  let drawn = 0;
  while (drawn < n) {
    const k = Math.round((r.normal(mu, sd) - N) / 0.1);
    if (Math.abs(k) > steps) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    drawn++;
  }
  const classes = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([k, f]) => ({ x: dk(N + k * 0.1, 1), f }));
  const sdRule: Rules['sd'] = level === 1 ? 'either' : r.pick(['s', 'sigma'] as const);
  const spec: Spec = { lsl: dk(N - t, 1), usl: dk(N + t, 1), nominal: dk(N, 1) };
  const kb = r.int(-steps + 1, -1);
  const side = r.pick(['lt', 'le'] as const);
  const bound = dk(N + kb * 0.1, 1);
  const asks: Ask[] = [
    { id: 'a1', type: 'mean' },
    { id: 'a2', type: 'sd' },
    { id: 'b', type: 'pctSample', bound, side },
    { id: 'c', type: 'pctPopulation', tails: 'outside' },
  ];
  const sp = specText(spec);
  const sdt = sdRuleText({ sd: sdRule });
  const sideT = sideText[side];
  return base(
    level,
    { sd: sdRule },
    { kind: 'freq', unit: 'mm', classes },
    asks,
    { a1: 1, a2: 1, b: 3, c: 5 },
    {
      eu: `${sp.eu}-ko luzera duen ardatz-populazio batetik ${n} elementuko lagin adierazgarri bat neurtu da (taula). a) Kalkulatu batez bestekoa eta ${sdt.eu}. b) Laginean, zer pieza-ehunekok du ${fd(bound)} mm ${sideT.eu} luzera? c) Lagina adierazgarria eta banaketa normala direla onartuta, estimatu populazioko pieza akastunen ehunekoa (tolerantziatik kanpo).`,
      es: `De una población de ejes de longitud ${sp.es} se ha medido una muestra representativa de ${n} elementos (tabla). a) Calcula la media y ${sdt.es}. b) En la muestra, ¿qué porcentaje de piezas tiene una longitud ${sideT.es} ${fd(bound)} mm? c) Suponiendo la muestra representativa y distribución normal, estima el porcentaje de piezas defectuosas en la población (fuera de tolerancia).`,
    },
    spec,
  );
}

// ------------------------------------------------------------------ 2. % defective from a summary

function defectsSummary(r: Rng, level: Level): Draft {
  const N = r.pick(NOMINALS);
  const t = r.pick([0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05]);
  const zU = r.pick(level === 3 ? [2.5, 3, 3.5] : [1.25, 1.5, 1.75, 2, 2.25, 2.5]);
  const zL = r.pick(level === 3 ? [-3, -3.5, -4] : [-1.5, -2, -2.5, -3]);
  const sigma = dk((2 * t) / (zU - zL), 4);
  const usl = dk(N + t, 3);
  const lsl = dk(N - t, 3);
  const mu = dk(D.toNumber(usl) - zU * D.toNumber(sigma), 4);
  const flip = r.next() < 0.5; // mirror so that the larger tail is sometimes below
  const muF = flip ? D.sub(D.add(usl, lsl), mu) : mu;
  const sdKind: 's' | 'sigma' = r.pick(['s', 'sigma'] as const);
  const spec: Spec = { lsl, usl, nominal: dk(N, 3) };
  const sp = specText(spec);
  const sym = sdKind === 's' ? 's' : 'σ';
  return base(
    level,
    { sd: sdKind },
    { kind: 'summary', mean: muF, sd: sigma, sdKind, unit: 'mm', ...(sdKind === 's' ? { n: r.pick([50, 100, 125, 200]) } : {}) },
    [
      { id: 'z', type: 'z', bound: usl },
      { id: 'p', type: 'pctPopulation', tails: 'outside' },
    ],
    { z: 2, p: 8 },
    {
      eu: `Diametro baten espezifikazioa ${sp.eu} da. Lagin adierazgarri baten emaitzak: x̄ = ${fd(muF)} mm, ${sym} = ${fd(sigma)} mm. Banaketa normala onartuta: a) kalkulatu goiko espezifikazio-mugari dagokion z balioa; b) estimatu pieza akastunen ehunekoa.`,
      es: `La especificación de un diámetro es ${sp.es}. Resultados de una muestra representativa: x̄ = ${fd(muF)} mm, ${sym} = ${fd(sigma)} mm. Suponiendo distribución normal: a) calcula el valor z correspondiente al LES; b) estima el porcentaje de piezas defectuosas.`,
    },
    spec,
  );
}

// ------------------------------------------------------------------ 3. capability from a summary

function targetCapability(r: Rng, level: Level): { cp: number; cpk: number } {
  const cp = r.pick(level === 1 ? [0.8, 1.2, 1.5, 2] : [0.75, 0.9, 1.1, 1.25, 1.5, 1.67, 2]);
  const delta = r.pick(level === 1 ? [0, 0.3, 0.5] : [0, 0.1, 0.25, 0.4, 0.6]);
  return { cp, cpk: Math.max(0.3, cp - delta) };
}

function capabilitySummary(r: Rng, level: Level): Draft {
  const N = r.pick(NOMINALS);
  const ei = r.pick([-0.05, -0.03, -0.025, -0.02, 0, 0.01]);
  const it = r.pick([0.021, 0.025, 0.033, 0.039, 0.046, 0.06]);
  const lsl = dk(N + ei, 3);
  const usl = dk(N + ei + it, 3);
  const { cp, cpk } = targetCapability(r, level);
  const sigma = dk(it / (6 * cp), 4);
  const s = D.toNumber(sigma);
  const mid = (D.toNumber(lsl) + D.toNumber(usl)) / 2;
  const dir = r.next() < 0.5 ? 1 : -1;
  const mu = dk(mid + dir * (cp - cpk) * 3 * s, 4);
  const spec: Spec = { lsl, usl, nominal: dk(N, 3) };
  const thresholds: [number, number] = [1, 1.33];
  const asks: Ask[] = [
    { id: 'cp', type: 'cp' },
    { id: 'cpk', type: 'cpk' },
    ...(level >= 2 ? [{ id: 'cpu', type: 'cpu' } as Ask, { id: 'cpl', type: 'cpl' } as Ask] : []),
    { id: 'cen', type: 'centered' },
    { id: 'cap', type: 'capable', index: level >= 2 ? 'cpk' : 'cp' },
  ];
  const sp = specText(spec);
  const th = thresholdsText(thresholds);
  const idx = level >= 2 ? 'Cpk' : 'Cp';
  return base(
    level,
    { sd: 'sigma', capableThresholds: thresholds },
    { kind: 'summary', mean: mu, sd: sigma, sdKind: 'sigma', unit: 'mm' },
    asks,
    Object.fromEntries(asks.map((a) => [a.id, a.type === 'cp' || a.type === 'cpk' ? 3 : 1])),
    {
      eu: `Kota baten mugak ${sp.eu} dira. Prozesuak, kontrol estatistikoan, μ = ${fd(mu)} mm eta σ = ${fd(sigma)} mm ditu. Kalkulatu prozesuaren gaitasun-indizeak, adierazi zentratuta dagoen (eta, ez badago, zein mugatara desplazatuta), eta erabaki gai den ${idx}-n oinarrituta. ${th.eu}`,
      es: `Los límites de una cota son ${sp.es}. El proceso, bajo control estadístico, tiene μ = ${fd(mu)} mm y σ = ${fd(sigma)} mm. Calcula los índices de capacidad del proceso, indica si está centrado (y, si no, hacia qué límite está desplazado) y decide si es capaz según ${idx}. ${th.es}`,
    },
    spec,
  );
}

// ------------------------------------------------------------------ subgroup data (µm resolution)

function subgroupData(r: Rng, k: number, n: number, mu: number, sigma: number): Decimal[][] {
  return Array.from({ length: k }, () => Array.from({ length: n }, () => dk(r.normal(mu, sigma), 3)));
}

// ------------------------------------------------------------------ 4. capability with subgroups (Madrid 2025 style)

function capabilitySubgroups(r: Rng, level: Level): Draft {
  const N = r.pick([20, 25, 30, 40, 50]);
  const eiUm = r.pick([-60, -40, -25, 0, 9, 17, 26]);
  const itUm = r.pick([16, 21, 25, 33, 39]);
  const lsl = dk(N + eiUm / 1000, 3);
  const usl = dk(N + (eiUm + itUm) / 1000, 3);
  const { cp, cpk } = targetCapability(r, level);
  const sigma = itUm / 1000 / (6 * cp);
  const mid = (D.toNumber(lsl) + D.toNumber(usl)) / 2;
  const mu = mid + (r.next() < 0.5 ? 1 : -1) * (cp - cpk) * 3 * sigma;
  const n = r.pick([4, 5]);
  const k = r.int(8, level === 3 ? 20 : 12);
  const groups = subgroupData(r, k, n, mu, sigma);
  const spec: Spec = { lsl, usl, nominal: dk(N, 3) };
  const thresholds: [number, number] = [1, 1.33];
  const sp = specText(spec);
  const th = thresholdsText(thresholds);
  return base(
    level,
    { sd: 's', sigmaHat: 'Rbar/d2', capableThresholds: thresholds },
    { kind: 'subgroups', groups, unit: 'mm' },
    [
      { id: 'sh', type: 'sigmaHat' },
      { id: 'cp', type: 'cp' },
      { id: 'cpk', type: 'cpk' },
      { id: 'cap', type: 'capable', index: 'cpk' },
    ],
    { sh: 2, cp: 3, cpk: 3, cap: 2 },
    {
      eu: `Kota baten mugak ${sp.eu} dira. ${k} azpitalde hartu dira, bakoitza ${n} neurketakoa (taula, mm-tan). Estimatu σ R̄/d₂ bidez, kalkulatu Cp eta Cpk, eta erabaki prozesua gai den Cpk-n oinarrituta. ${th.eu}`,
      es: `Los límites de una cota son ${sp.es}. Se han tomado ${k} subgrupos de ${n} medidas cada uno (tabla, en mm). Estima σ mediante R̄/d₂, calcula Cp y Cpk y decide si el proceso es capaz según Cpk. ${th.es}`,
    },
    spec,
  );
}

// ------------------------------------------------------------------ 5. X̄-R / X̄-s chart

function xbarR(r: Rng, level: Level): Draft {
  const useS = level === 3 && r.next() < 0.5;
  const n = useS ? r.int(6, 10) : r.int(3, 6);
  const k = r.int(15, 25);
  const mu = r.pick([20, 25, 30, 40, 50]) + r.int(-20, 20) / 1000;
  const sigma = r.pick([0.003, 0.004, 0.005, 0.006, 0.008]);
  const groups = subgroupData(r, k, n, mu, sigma);
  // shift 1–2 subgroups by 4–6 σ/√n so that their mean falls clearly outside
  const shifts = level === 1 ? 1 : r.int(1, 2);
  const hit = new Set<number>();
  while (hit.size < shifts) hit.add(r.int(0, k - 1));
  for (const i of hit) {
    const delta = (r.next() < 0.5 ? 1 : -1) * (4 + 2 * r.next()) * (sigma / Math.sqrt(n));
    groups[i] = groups[i]!.map((x) => dk(D.toNumber(x) + delta, 3));
  }
  const chart2 = useS ? 's' : 'R';
  const asks: Ask[] = [
    { id: 'lx', type: 'controlLimits', chart: 'xbar' },
    { id: 'l2', type: 'controlLimits', chart: chart2 },
    { id: 'oc', type: 'outOfControl', chart: 'xbar' },
  ];
  const name = useS ? 'X̄-s' : 'X̄-R';
  return base(
    level,
    { sd: 's', sigmaHat: useS ? 'sbar/c4' : 'Rbar/d2' },
    { kind: 'subgroups', groups, unit: 'mm' },
    asks,
    { lx: 4, l2: 3, oc: 3 },
    {
      eu: `Diametro bat kontrolatzeko ${k} azpitalde hartu dira, bakoitza ${n} piezakoa (taula, mm-tan). Kalkulatu ${name} kontrol-grafikoen erdiko lerroa eta kontrol-mugak (taulako konstanteekin), eta adierazi zein azpitalde dauden kontrolaz kanpo X̄ grafikoan (puntu bat mugetatik kanpo).`,
      es: `Para controlar un diámetro se han tomado ${k} subgrupos de ${n} piezas (tabla, en mm). Calcula la línea central y los límites de control de los gráficos ${name} (con las constantes de la tabla) e indica qué subgrupos están fuera de control en el gráfico X̄ (un punto fuera de los límites).`,
    },
  );
}

// ------------------------------------------------------------------ 6. attribute charts

function attributes(r: Rng, level: Level): Draft {
  const chart: ChartKind = r.pick(['p', 'np', 'c', 'u'] as const);
  const k = r.int(15, 25);
  let samples: { n: number; defects: number }[];
  if (chart === 'p' || chart === 'np') {
    const n = r.pick([50, 80, 100, 150, 200, 250]);
    const p = r.pick([0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1]);
    samples = Array.from({ length: k }, () => ({ n, defects: binomial(r, n, p) }));
  } else if (chart === 'c') {
    const lambda = r.pick([3, 4, 5, 6, 8, 10, 12]);
    samples = Array.from({ length: k }, () => ({ n: 1, defects: poisson(r, lambda) }));
  } else {
    const n = r.pick([5, 10, 20, 25]);
    const perUnit = r.pick([0.2, 0.3, 0.5, 0.8, 1, 1.5]);
    samples = Array.from({ length: k }, () => ({ n, defects: poisson(r, perUnit * n) }));
  }
  if (level >= 2 || r.next() < 0.5) {
    const i = r.int(0, k - 1);
    const s = samples[i]!;
    const bump = Math.max(4, Math.round(s.defects * 1.5 + 4));
    samples[i] = { n: s.n, defects: chart === 'p' || chart === 'np' ? Math.min(s.n, s.defects + bump) : s.defects + bump };
  }
  const what = {
    p: { eu: 'unitate akastunen proportzioa (p)', es: 'proporción de unidades defectuosas (p)' },
    np: { eu: 'unitate akastunen kopurua (np)', es: 'número de unidades defectuosas (np)' },
    c: { eu: 'akats-kopurua unitateko (c)', es: 'número de defectos por unidad de inspección (c)' },
    u: { eu: 'akatsak unitateko (u)', es: 'defectos por unidad (u)' },
  }[chart];
  const n0 = samples[0]!.n;
  return base(
    level,
    { sd: 's' },
    { kind: 'attributes', chart, samples },
    [
      { id: 'lim', type: 'controlLimits', chart },
      { id: 'oc', type: 'outOfControl', chart },
    ],
    { lim: 6, oc: 4 },
    {
      eu: `${k} lagin ikuskatu dira${chart === 'c' ? '' : `, bakoitza ${n0} unitatekoa`} (taula). Kalkulatu ${what.eu} grafikoaren erdiko lerroa eta kontrol-mugak (LCL negatiboa bada, 0), eta adierazi zein lagin dauden kontrolaz kanpo.`,
      es: `Se han inspeccionado ${k} muestras${chart === 'c' ? '' : ` de ${n0} unidades cada una`} (tabla). Calcula la línea central y los límites de control del gráfico de ${what.es} (si el LCI sale negativo, 0) e indica qué muestras están fuera de control.`,
    },
  );
}

// ------------------------------------------------------------------ 7. Pareto (Madrid 2025 style)

function paretoT(r: Rng, level: Level): Draft {
  const m = r.int(5, level === 1 ? 6 : 8);
  const causes = r.shuffle([...CAUSES]).slice(0, m);
  const values = Array.from({ length: m }, (_, i) => Math.max(1, Math.round((5000 * Math.pow(0.62 + 0.15 * r.next(), i)) / 100)) * 100);
  if (level === 3 && r.next() < 0.5 && m > 3) values[m - 2] = values[m - 3]!; // a tie
  const labels = 'ABCDEFGH'.split('');
  const order = r.shuffle(Array.from({ length: m }, (_, i) => i)); // shown unsorted
  const items = order.map((j, pos) => ({ label: labels[pos]!, value: D.q(values[j]!) }));
  const list = (lang: 'eu' | 'es') => order.map((j, pos) => `${labels[pos]}: ${causes[j]![lang]}`).join('; ');
  return base(
    level,
    { sd: 's', paretoThreshold: 80, paretoRule: 'crossing' },
    { kind: 'pareto', items },
    [{ id: 'pa', type: 'pareto' }],
    { pa: 10 },
    {
      eu: `Fabrikazio-prozesu bateko galerak kausaka kuantifikatu dira (taula, € — ${list('eu')}). Egin Pareto analisia: ordenatu kausak, kalkulatu ehuneko metatua eta adierazi A klaseko kausak (% 80a lortu edo gainditzen den kausaraino, hori barne).`,
      es: `Se han cuantificado por causas las pérdidas de un proceso de fabricación (tabla, € — ${list('es')}). Realiza el análisis de Pareto: ordena las causas, calcula el porcentaje acumulado e indica las causas de clase A (hasta la causa con la que se alcanza o supera el 80 %, incluida).`,
    },
  );
}

export const BUILDERS: Record<TemplateId, (r: Rng, level: Level) => Draft> = {
  freqTable,
  defectsSummary,
  capabilitySummary,
  capabilitySubgroups,
  xbarR,
  attributes,
  pareto: paretoT,
};

export const LEVELS: Record<TemplateId, Level[]> = {
  freqTable: [1, 2],
  defectsSummary: [1, 3],
  capabilitySummary: [1, 2],
  capabilitySubgroups: [2, 3],
  xbarR: [2, 3],
  attributes: [2],
  pareto: [1, 3],
};

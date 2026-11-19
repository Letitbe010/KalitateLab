/**
 * Grader tests (spec §11.1): correct answers score 100 %; each common mistake of §8.3 gets its
 * diagnosis; for multi-solution asks every valid answer scores 100 % and invalid ones 0.
 */
import fc from 'fast-check';
import { constants } from '../src/core/constants';
import * as D from '../src/core/decimal';
import { describe as describeDs } from '../src/core/descriptive';
import { grade, parseUserNumber, type Answer, type DiagnosisId } from '../src/core/grader';
import type { Ask, Dataset, Exercise, Rules } from '../src/core/model';
import { populationDefects } from '../src/core/normal';
import { solveExercise, type Expected } from '../src/core/solve';

const dec = D.dec;
const fmt = (x: number): string => x.toPrecision(12);

function ex(dataset: Dataset, asks: Ask[], rules: Partial<Rules> = {}, spec?: Exercise['spec']): Exercise {
  return {
    id: 't',
    origin: 'generated',
    difficulty: 1,
    dataset,
    ...(spec ? { spec } : {}),
    rules: { sd: 's', ...rules },
    asks,
    weights: {},
    text: { eu: '', es: '' },
  };
}

/** Answers built from the solver output (full precision). */
function perfect(e: Exercise): Record<string, Answer> {
  const sol = solveExercise(e);
  const out: Record<string, Answer> = {};
  for (const [id, x] of Object.entries(sol) as [string, Expected][]) {
    if (x.kind === 'number') out[id] = { value: fmt(x.value) };
    if (x.kind === 'limits') out[id] = { cl: fmt(x.cl), ucl: fmt(x.ucl), lcl: fmt(x.lcl) };
    if (x.kind === 'choice') out[id] = { choice: x.value };
    if (x.kind === 'set') out[id] = { set: x.value.join(', ') };
    if (x.kind === 'pareto') out[id] = { order: x.order.join(', '), cumPct: x.cumPct.map(fmt), classA: x.classA.join(', ') };
  }
  return out;
}

function diag(e: Exercise, id: string, a: Answer, part = 'value'): DiagnosisId | undefined {
  const r = grade(e, { [id]: a }).asks.find((x) => x.id === id)!;
  const item = r.items.find((i) => i.part === part)!;
  expect(item.status).toBe('wrong');
  return item.diagnosis;
}

const ok = (e: Exercise, id: string, a: Answer): boolean => grade(e, { [id]: a }).asks.find((x) => x.id === id)!.status === 'correct';

// ------------------------------------------------------------------ fixtures

/** Euskadi 2020 style: KQ5 frequency table, spec 23,5 ± 0,2. */
const KQ5: Dataset = {
  kind: 'freq',
  unit: 'mm',
  classes: [
    ['23,3', 2],
    ['23,4', 5],
    ['23,5', 10],
    ['23,6', 6],
    ['23,7', 2],
  ].map(([x, f]) => ({ x: dec(x as string), f: f as number })),
};
const SPEC_KQ = { lsl: dec('23,3'), usl: dec('23,7'), nominal: dec('23,5') };
const euskadi = ex(
  KQ5,
  [
    { id: 'a1', type: 'mean' },
    { id: 'a2', type: 'sd' },
    { id: 'b', type: 'pctSample', bound: dec('23,3'), side: 'le' },
    { id: 'c', type: 'pctPopulation', tails: 'outside' },
  ],
  { sd: 's' },
  SPEC_KQ,
);

/** KQ1 summary. */
const kq1 = ex(
  { kind: 'summary', mean: dec('20,01'), sd: dec('0,015'), sdKind: 'sigma', unit: 'mm' },
  [
    { id: 'cp', type: 'cp' },
    { id: 'cpk', type: 'cpk' },
    { id: 'cpu', type: 'cpu' },
    { id: 'cpl', type: 'cpl' },
    { id: 'cap', type: 'capable' },
    { id: 'capk', type: 'capable', index: 'cpk' },
    { id: 'cen', type: 'centered' },
    { id: 'pct', type: 'pctPopulation' },
    { id: 'zU', type: 'z', bound: dec('20,06') },
  ],
  { sd: 'sigma', capableThresholds: [1, 1.33] },
  { lsl: dec('19,94'), usl: dec('20,06') },
);

/** 20 subgroups of 5 (µm data), subgroup 8 shifted. */
const groups = Array.from({ length: 20 }, (_, i) =>
  ['40,000', '40,004', '39,998', '40,002', '39,996'].map((v, j) => D.add(dec(v), D.q(((i * 7 + j * 3) % 5) - 2, 1000))),
);
groups[7] = groups[7]!.map((x) => D.add(x, dec('0,020')));
const xr = ex(
  { kind: 'subgroups', groups, unit: 'mm' },
  [
    { id: 'lx', type: 'controlLimits', chart: 'xbar' },
    { id: 'lr', type: 'controlLimits', chart: 'R' },
    { id: 'sh', type: 'sigmaHat' },
    { id: 'oc', type: 'outOfControl', chart: 'xbar' },
    { id: 'cpk', type: 'cpk' },
  ],
  { sd: 's', sigmaHat: 'Rbar/d2' },
  { lsl: dec('39,970'), usl: dec('40,030') },
);

/** p chart, n = 200 constant, p̄ = 0,04 → raw LCL < 0. */
const pSamples = [8, 6, 10, 7, 9, 8, 7, 9, 8, 8].map((d) => ({ n: 200, defects: d }));
const pchart = ex({ kind: 'attributes', chart: 'p', samples: pSamples }, [{ id: 'lp', type: 'controlLimits', chart: 'p' }]);

/** KQ6 Pareto with a tie (C and D both 1 600 here). */
const paretoEx = (items: [string, string][]) =>
  ex({ kind: 'pareto', items: items.map(([label, v]) => ({ label, value: dec(v) })) }, [{ id: 'pa', type: 'pareto' }], { paretoThreshold: 80, paretoRule: 'crossing' });
const kq6 = paretoEx([
  ['A', '4500'],
  ['B', '2800'],
  ['C', '1600'],
  ['D', '1100'],
  ['E', '600'],
  ['F', '400'],
]);

// ------------------------------------------------------------------ tests

describe('grader: correct answers score 10/10', () => {
  it.each([
    ['Euskadi 2020 style', euskadi],
    ['KQ1 capability', kq1],
    ['X̄-R', xr],
    ['p chart', pchart],
    ['Pareto', kq6],
  ])('%s', (_name, e) => {
    const r = grade(e, perfect(e));
    expect(r.asks.filter((a) => a.status !== 'correct').map((a) => [a.id, a.items])).toEqual([]);
    expect(r.score10).toBe(10);
  });

  it('KQ5 values as a student writes them (rounded, comma decimals)', () => {
    const r = grade(euskadi, { a1: { value: '23,504' }, a2: { value: '0,1060' }, b: { value: '8' } });
    expect(r.asks.slice(0, 3).map((a) => a.status)).toEqual(['correct', 'correct', 'correct']);
    expect(r.asks[3]!.status).toBe('missing');
  });

  it('random datasets: the solver output always scores 10 (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 9800, max: 10200 }), { minLength: 5, maxLength: 40 }), fc.constantFrom<'s' | 'sigma' | 'either'>('s', 'sigma', 'either'), (ks, sd) => {
        const e = ex(
          { kind: 'values', unit: 'mm', values: ks.map((k) => D.q(k, 1000)) },
          [
            { id: 'm', type: 'mean' },
            { id: 's', type: 'sd' },
            { id: 'p', type: 'pctPopulation' },
            { id: 'k', type: 'cpk' },
          ],
          { sd },
          { lsl: dec('9,85'), usl: dec('10,15') },
        );
        if (describeDs(e.dataset).s === 0) return true;
        return grade(e, perfect(e)).score10 === 10;
      }),
      { numRuns: 200 },
    );
  });
});

describe('grader: tolerances and input handling (spec §8.1)', () => {
  it('Cp/Cpk ±0,01', () => {
    expect(ok(kq1, 'cp', { value: '1,34' })).toBe(true);
    expect(ok(kq1, 'cp', { value: '1,32' })).toBe(false);
  });
  it('% defective: 3 % relative (table z rounding) and ppm/fraction units', () => {
    // exact 0,04306 %; with z from tables (3,33 → Q = 0,000434) a student gets ≈ 0,0436 %
    expect(ok(kq1, 'pct', { value: '0,0436' })).toBe(true);
    expect(ok(kq1, 'pct', { value: '431', unit: 'ppm' })).toBe(true);
    expect(ok(kq1, 'pct', { value: '0,000431', unit: 'fraction' })).toBe(true);
    // spec §8.1: OR 0,01 percentage points absolute (lenient for very small %; reported to the user)
    expect(ok(kq1, 'pct', { value: '0,06' })).toBe(false);
  });
  it('lengths in µm are converted', () => {
    const r = grade(euskadi, { a2: { value: '106,0', unit: 'µm' } });
    expect(r.asks[1]!.status).toBe('correct');
  });
  it('X̄ limits: tolerance on the band, not on the value (50,0577 vs 50,06)', () => {
    const kq3like = solveExercise(xr).lx as Extract<Expected, { kind: 'limits' }>;
    const band = kq3like.ucl - kq3like.cl;
    // off by 1 % of the band → wrong although it is 0,0001 % of the value
    const bad = kq3like.ucl + 0.01 * band;
    expect(ok(xr, 'lx', { cl: fmt(kq3like.cl), ucl: fmt(bad), lcl: fmt(kq3like.lcl) })).toBe(false);
    // rounded to the data's decimals + 1 (4 here) → accepted
    const r4 = grade(xr, { lx: { cl: kq3like.cl.toFixed(4), ucl: kq3like.ucl.toFixed(4), lcl: kq3like.lcl.toFixed(4) } }).asks[0]!;
    for (const i of r4.items) expect(`${i.part} ${i.status} ${i.expected} ${i.given}`).toBe(`${i.part} correct ${i.expected} ${i.given}`);
  });
  it('unreadable input is "invalid", not wrong; empty is "missing"', () => {
    expect(parseUserNumber('1,2.3')).toBeNull();
    expect(parseUserNumber('abc')).toBeNull();
    expect(parseUserNumber('  ')).toBeUndefined();
    expect(parseUserNumber('−0,5')).toEqual({ value: -0.5, decimals: 1 });
    const r = grade(kq1, { cp: { value: 'x' } });
    expect(r.asks[0]!.status).toBe('invalid');
    expect(r.asks[1]!.status).toBe('missing');
  });
  it('weights scale the 0–10 score', () => {
    const e = { ...kq1, asks: kq1.asks.slice(0, 2), weights: { cp: 3, cpk: 1 } };
    expect(grade(e, { cp: { value: '1,333' }, cpk: { value: '0' } }).score10).toBeCloseTo(7.5, 12);
  });
});

describe('grader: multi-solution asks (spec §8.2)', () => {
  it('sd "either": s and σ both correct, and the note says which', () => {
    const e = { ...euskadi, rules: { sd: 'either' as const } };
    const d = describeDs(KQ5);
    const rs = grade(e, { a2: { value: fmt(d.s) } }).asks[1]!.items[0]!;
    const rg = grade(e, { a2: { value: fmt(d.sigma) } }).asks[1]!.items[0]!;
    expect([rs.status, rs.note, rg.status, rg.note]).toEqual(['correct', 's', 'correct', 'sigma']);
  });
  it('out-of-control set: any order, duplicates ignored; wrong set is wrong', () => {
    const sol = solveExercise(xr).oc as Extract<Expected, { kind: 'set' }>;
    expect(sol.value).toContain(8);
    expect(ok(xr, 'oc', { set: [...sol.value].reverse().join(' ') + ' ' + sol.value[0] })).toBe(true);
    expect(ok(xr, 'oc', { set: '1' })).toBe(false);
  });
  it('Pareto ties: every order within equal values is valid, others are not', () => {
    const tie = paretoEx([
      ['A', '4500'],
      ['B', '2800'],
      ['C', '1600'],
      ['D', '1600'],
      ['E', '500'],
    ]);
    const s = solveExercise(tie).pa as Extract<Expected, { kind: 'pareto' }>;
    const base = { cumPct: s.cumPct.map(fmt), classA: s.classA.join(',') };
    expect(ok(tie, 'pa', { ...base, order: 'A, B, C, D, E' })).toBe(true);
    expect(ok(tie, 'pa', { ...base, order: 'A, B, D, C, E' })).toBe(true);
    expect(ok(tie, 'pa', { ...base, order: 'B, A, C, D, E' })).toBe(false);
  });
  it('Pareto ties at the class-A boundary: either tied item completes class A', () => {
    // cumulative: A 40, B 70, C/D 85 → crossing 80 at the C/D tie
    const tie = paretoEx([
      ['A', '400'],
      ['B', '300'],
      ['C', '150'],
      ['D', '150'],
    ]);
    const s = solveExercise(tie).pa as Extract<Expected, { kind: 'pareto' }>;
    const base = { order: s.order.join(','), cumPct: s.cumPct.map(fmt) };
    expect(ok(tie, 'pa', { ...base, classA: 'A, B, C' })).toBe(true);
    expect(ok(tie, 'pa', { ...base, classA: 'A, B, D' })).toBe(true);
    expect(ok(tie, 'pa', { ...base, classA: 'A, C, D' })).toBe(false);
  });
});

describe('grader: diagnosis of each common mistake (spec §8.3)', () => {
  const d = describeDs(KQ5);

  it('1. n instead of n − 1 (and the reverse)', () => {
    expect(diag(euskadi, 'a2', { value: fmt(d.sigma) })).toBe('sd-n-vs-n1');
    const eSigma = { ...euskadi, rules: { sd: 'sigma' as const } };
    expect(diag(eSigma, 'a2', { value: fmt(d.s) })).toBe('sd-n-vs-n1');
  });
  it('2. variance instead of deviation', () => {
    expect(diag(euskadi, 'a2', { value: fmt(d.s * d.s) })).toBe('variance-for-sd');
  });
  it('3. % in the sample given when the population was asked (and the reverse)', () => {
    // no part of the sample lies outside 23,3…23,7 (< LSL or > USL): counting gives 0 %, the normal ≈ 6 %
    expect(diag(euskadi, 'c', { value: '0' })).toBe('sample-for-population');
    const pop = 100 * populationDefects(D.toNumber(d.mean), d.s, 23.3, undefined).total;
    const eb = { ...euskadi, asks: [{ id: 'b', type: 'pctSample' as const, bound: dec('23,3'), side: 'lt' as const }] };
    expect(diag(eb, 'b', { value: fmt(pop) })).toBe('population-for-sample');
    expect(diag(euskadi, 'b', { value: '0' })).toBe('bound-inclusive'); // "< 23,3" instead of "≤ 23,3"
  });
  it('4. wrong side of Φ(z), or only one tail of two', () => {
    const r = populationDefects(20.01, 0.015, 19.94, 20.06);
    expect(diag(kq1, 'pct', { value: fmt(100 * (1 - r.above!)) })).toBe('wrong-tail');
    expect(diag(kq1, 'pct', { value: fmt(100 * r.below!) })).toBe('one-tail-only');
  });
  it('5. Cp given for Cpk; USL and LSL mixed', () => {
    expect(diag(kq1, 'cpk', { value: '1,333' })).toBe('cp-for-cpk');
    expect(diag(kq1, 'cpu', { value: '1,556' })).toBe('usl-lsl-swapped');
    expect(diag(kq1, 'cpk', { value: '1,556' })).toBe('max-for-min');
  });
  it('6. 3σ instead of 6σ in Cp (and 6σ in Cpk)', () => {
    expect(diag(kq1, 'cp', { value: '2,667' })).toBe('cp-3sigma');
    expect(diag(kq1, 'cpk', { value: '0,556' })).toBe('cpk-6sigma');
  });
  it('7. σ̂ = R̄ (not divided by d₂); constant of the wrong n', () => {
    const rbar = D.toNumber(D.div(D.sum(groups.map((g) => D.sub([...g].sort(D.cmp)[4]!, [...g].sort(D.cmp)[0]!))), D.q(20)));
    expect(diag(xr, 'sh', { value: fmt(rbar) })).toBe('rbar-not-divided');
    expect(diag(xr, 'sh', { value: fmt(rbar / D.toNumber(constants(4).d2)) })).toBe('wrong-n-constant');
    const lim = solveExercise(xr).lx as Extract<Expected, { kind: 'limits' }>;
    const wrongA2 = lim.cl + (lim.ucl - lim.cl) * (D.toNumber(constants(4).A2) / D.toNumber(constants(5).A2));
    expect(diag(xr, 'lx', { cl: fmt(lim.cl), ucl: fmt(wrongA2), lcl: fmt(lim.lcl) }, 'ucl')).toBe('wrong-n-constant');
    const noSqrt = lim.cl + (lim.ucl - lim.cl) * Math.sqrt(5);
    expect(diag(xr, 'lx', { cl: fmt(lim.cl), ucl: fmt(noSqrt), lcl: fmt(lim.lcl) }, 'ucl')).toBe('limits-no-sqrt-n');
  });
  it('8. negative LCL not set to 0; p and np mixed', () => {
    const lim = solveExercise(pchart).lp as Extract<Expected, { kind: 'limits' }>;
    expect(lim.lcl).toBe(0);
    expect(diag(pchart, 'lp', { cl: fmt(lim.cl), ucl: fmt(lim.ucl), lcl: fmt(lim.lclRaw) }, 'lcl')).toBe('lcl-not-clipped');
    expect(diag(pchart, 'lp', { cl: fmt(lim.cl * 200), ucl: fmt(lim.ucl), lcl: '0' }, 'cl')).toBe('p-np-mixed');
    expect(diag(pchart, 'lp', { cl: fmt(lim.cl), ucl: fmt(lim.ucl * 200), lcl: '0' }, 'ucl')).toBe('p-np-mixed');
  });
  it('9. Pareto cumulative % from the unsorted list', () => {
    const unsorted = paretoEx([
      ['A', '1100'],
      ['B', '4500'],
      ['C', '400'],
      ['D', '2800'],
    ]);
    // input order: 1100, 4500, 400, 2800 (total 8800)
    const cum = [12.5, 63.636363, 68.181818, 100].map(fmt);
    expect(diag(unsorted, 'pa', { order: 'B, D, A, C', cumPct: cum, classA: 'B, D' }, 'cumPct')).toBe('pareto-unsorted');
  });
  it('a hypothesis equal to the correct answer is never reported; unknown errors say so', () => {
    // KQ5 mean: ignoring frequencies gives 23,5, inside the 0,1 % tolerance of 23,504 → it is simply correct
    expect(ok(euskadi, 'a1', { value: '23,5' })).toBe(true);
    expect(diag(kq1, 'cp', { value: '0,7' })).toBe('not-identified');
  });
  it('frequencies ignored in the mean (when distinguishable)', () => {
    const e = ex({ kind: 'freq', unit: 'mm', classes: [['10,0', 1], ['10,1', 2], ['10,2', 10]].map(([x, f]) => ({ x: dec(x as string), f: f as number })) }, [{ id: 'm', type: 'mean' }]);
    expect(diag(e, 'm', { value: '10,1' })).toBe('freq-ignored');
  });
});

describe('solve: data decimals', () => {
  it('counts decimals of any finite decimal (denominators 2^a·5^b)', async () => {
    const { dataDecimals } = await import('../src/core/solve');
    expect(dataDecimals({ kind: 'values', unit: '', values: [dec('40'), D.q(-1, 500), dec('0,25')] })).toBe(3);
    expect(dataDecimals({ kind: 'values', unit: '', values: [dec('23,5'), dec('1,0')] })).toBe(1);
  });
});

/**
 * Compares the TypeScript solvers (A and B) with the Python oracle output (spec §5.4).
 * Run `python tools/oracle/oracle.py tools/oracle/out/oracle.json tests/golden/golden.json` first.
 * Without the file the suite is skipped, unless ORACLE_REQUIRED=1 (CI), where it fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import { capability } from '../src/core/capability';
import { attributeChart, pLimits, xbarRChart, xbarRLimits } from '../src/core/charts';
import { attributeOutB, xbarROutB } from '../src/core/chartsAlt';
import * as D from '../src/core/decimal';
import { describe as describeDs } from '../src/core/descriptive';
import { shortcut, welford } from '../src/core/descriptiveAlt';
import type { ChartKind, Dataset } from '../src/core/model';
import { phi, phiB, populationDefects, upperTail, upperTailB } from '../src/core/normal';
import { pareto } from '../src/core/pareto';
import golden from './golden/golden.json';

const FILE = 'tools/oracle/out/oracle.json';
const required = process.env.ORACLE_REQUIRED === '1';
const present = existsSync(FILE);
if (required && !present) throw new Error(`ORACLE_REQUIRED=1 but ${FILE} is missing`);

/* eslint-disable @typescript-eslint/no-explicit-any */
const data: { golden: { id: string; kind: string; result: any }[]; random: { kind: string; input: any; result: any }[] } = present
  ? JSON.parse(readFileSync(FILE, 'utf8'))
  : { golden: [], random: [] };

const rel = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-300);
const S = D.toString;
const dec = D.dec;

function expectRel(a: number, b: number, tol: number, label: string): void {
  if (!rel(a, b, tol)) throw new Error(`${label}: TS ${a} vs oracle ${b}`);
}

describe.skipIf(!present)('oracle: golden cases', () => {
  const input = (id: string): any => golden.cases.find((c) => c.id === id)!.input;
  const res = (id: string): any => data.golden.find((g) => g.id === id)!.result;

  it('KQ1 capability', () => {
    const i = input('KQ1');
    const c = capability({ lsl: dec(i.lsl), usl: dec(i.usl) }, dec(i.mu), D.toNumber(dec(i.sigma)));
    for (const k of ['cp', 'cpu', 'cpl', 'cpk'] as const) expectRel(c[k]!, res('KQ1')[k], 1e-12, k);
  });
  it('KQ2 population defects (scipy)', () => {
    const i = input('KQ2');
    const r = populationDefects(D.toNumber(dec(i.mu)), D.toNumber(dec(i.sigma)), D.toNumber(dec(i.lsl)), D.toNumber(dec(i.usl)));
    const o = res('KQ2');
    expectRel(r.zU!, o.zU, 1e-12, 'zU');
    expectRel(r.zL!, o.zL, 1e-12, 'zL');
    expectRel(r.above!, o.above, 1e-9, 'above');
    expectRel(r.below!, o.below, 1e-9, 'below');
  });
  it('KQ3 X̄-R limits exact', () => {
    const i = input('KQ3');
    const L = xbarRLimits(dec(i.xbarbar), dec(i.rbar), i.n);
    const o = res('KQ3');
    expect([S(L.xbar.ucl), S(L.xbar.lcl), S(L.R.ucl), S(L.R.lcl), S(L.sigmaHat)]).toEqual([o.uclX, o.lclX, o.uclR, o.lclR, o.sigmaHat]);
  });
  it('KQ4 p limits', () => {
    const i = input('KQ4');
    const L = pLimits(dec(i.pbar), i.n);
    const o = res('KQ4');
    expectRel(L.sigma, o.sigmaP, 1e-14, 'σp');
    expectRel(L.ucl, o.ucl, 1e-14, 'UCL');
    expect(L.lcl).toBe(o.lcl);
  });
  it('KQ5 frequency table exact', () => {
    const i = input('KQ5');
    const r = describeDs({ kind: 'freq', unit: 'mm', classes: i.classes.map(([x, f]: [string, number]) => ({ x: dec(x), f })) });
    const o = res('KQ5');
    expect([S(r.mean), S(r.varPop), S(r.varSample!)]).toEqual([o.mean, o.varPop, o.varSample]);
    expectRel(r.sigma, o.sigma, 1e-15, 'σ');
    expectRel(r.s, o.s, 1e-15, 's');
  });
  it('KQ6 Pareto exact', () => {
    const i = input('KQ6');
    const r = pareto(i.items.map(([label, v]: [string, string]) => ({ label, value: dec(v) })), i.threshold, i.rule);
    const o = res('KQ6');
    expect(r.rows.map((x) => S(x.cumPct))).toEqual(o.rows.map((x: any) => x.cumPct));
    expect(r.classA).toEqual(o.classA);
  });
});

describe.skipIf(!present)('oracle: seeded random cases', () => {
  const of = (kind: string) => data.random.filter((c) => c.kind === kind);

  it('descriptive: exact mean and variances (A and B), deviations vs numpy', () => {
    for (const c of of('describe')) {
      const ds: Dataset = { kind: 'values', unit: '', values: c.input.values.map(dec) };
      const a = describeDs(ds);
      const w = welford(ds);
      const s = shortcut(ds);
      const n = a.n;
      expect([S(a.mean), S(a.varPop), S(a.varSample!)]).toEqual([c.result.mean, c.result.varPop, c.result.varSample]);
      expect([S(w.mean), S(D.div(w.ss, D.q(n))), S(D.div(s.ss, D.q(n - 1)))]).toEqual([c.result.mean, c.result.varPop, c.result.varSample]);
      expectRel(a.sigma, c.result.sigmaNumpy, 1e-12, 'σ numpy');
      expectRel(a.s, c.result.sNumpy, 1e-12, 's numpy');
    }
  });

  it('normal: Φ and Q vs scipy (A and B)', () => {
    const [c] = of('phi');
    c!.input.z.forEach((z: number, k: number) => {
      expect(Math.abs(phi(z) - c!.result.cdf[k])).toBeLessThan(1e-14);
      expect(Math.abs(phiB(z) - c!.result.cdf[k])).toBeLessThan(1e-10);
      expectRel(upperTail(z), c!.result.sf[k], 1e-13, `Q(${z})`);
      expectRel(upperTailB(z), c!.result.sf[k], 1e-8, `QB(${z})`);
    });
  });

  it('population defects vs scipy', () => {
    for (const c of of('defects')) {
      const { mu, sigma, lsl, usl } = c.input;
      const r = populationDefects(mu, sigma, lsl, usl);
      expectRel(r.below!, c.result.below, 1e-9, 'below');
      expectRel(r.above!, c.result.above, 1e-9, 'above');
    }
  });

  it('X̄-R: exact limits and out-of-control points (A and B)', () => {
    let shifted = 0;
    for (const c of of('xbarR')) {
      const groups = c.input.groups.map((g: string[]) => g.map(dec));
      const a = xbarRChart(groups);
      const b = xbarROutB(groups);
      const o = c.result;
      expect([S(a.xbarbar), S(a.rbar), S(a.xbar.ucl), S(a.xbar.lcl), S(a.R.ucl), S(a.R.lcl), S(a.sigmaHat)]).toEqual([
        o.xbarbar,
        o.rbar,
        o.uclX,
        o.lclX,
        o.uclR,
        o.lclR,
        o.sigmaHat,
      ]);
      expect([a.outXbar, a.outR]).toEqual([o.outXbar, o.outR]);
      expect([b.outXbar, b.outR]).toEqual([o.outXbar, o.outR]);
      if (o.outXbar.length) shifted++;
    }
    expect(shifted).toBeGreaterThan(3); // the data really exercise the out-of-control branch
  });

  it('attribute charts: limits and out-of-control points (A and B)', () => {
    let outs = 0;
    for (const c of of('attributes')) {
      const chart = c.input.chart as ChartKind;
      const a = attributeChart(chart, c.input.samples);
      a.limits.forEach((l, k) => {
        const o = c.result.limits[k];
        expectRel(l.cl, o.cl, 1e-14, 'CL');
        expectRel(l.ucl, o.ucl, 1e-13, 'UCL');
        expect(Math.abs(l.lcl - o.lcl)).toBeLessThan(1e-13);
      });
      expect(a.out).toEqual(c.result.out);
      expect(attributeOutB(chart, c.input.samples)).toEqual(c.result.out);
      outs += a.out.length;
    }
    expect(outs).toBeGreaterThan(5);
  });

  it('Pareto: exact cumulative % and class A', () => {
    for (const c of of('pareto')) {
      const r = pareto(c.input.items.map(([label, v]: [string, string]) => ({ label, value: dec(v) })), c.input.threshold, c.input.rule);
      expect(S(r.total)).toBe(c.result.total);
      expect(r.rows.map((x) => [x.label, S(x.cumPct)])).toEqual(c.result.rows.map((x: any) => [x.label, x.cumPct]));
      expect(r.classA).toEqual(c.result.classA);
    }
  });
});

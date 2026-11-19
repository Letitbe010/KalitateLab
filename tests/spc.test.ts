import fc from 'fast-check';
import { capability, capableVerdict, sigmaHat } from '../src/core/capability';
import { attributeChart, xbarRChart, xbarSChart } from '../src/core/charts';
import { attributeOutB, xbarROutB } from '../src/core/chartsAlt';
import { checkAttribute, checkCapability, checkDefects, checkPareto } from '../src/core/checks';
import * as D from '../src/core/decimal';
import type { ChartKind } from '../src/core/model';
import { populationDefects } from '../src/core/normal';
import { pareto } from '../src/core/pareto';

const dec = D.dec;

/** Subgroups: k groups of size n, values in µm around 40 mm. */
const groupsArb = fc.integer({ min: 2, max: 10 }).chain((n) =>
  fc.array(fc.array(fc.integer({ min: 39900, max: 40100 }), { minLength: n, maxLength: n }), { minLength: 3, maxLength: 30 }).map((gs) => gs.map((g) => g.map((v) => D.q(v, 1000)))),
);

/** A centred-or-not spec with μ inside a wide band and σ > 0. */
const specArb = fc.record({
  lslK: fc.integer({ min: 19800, max: 19990 }),
  width: fc.integer({ min: 10, max: 400 }),
  muK: fc.integer({ min: 19700, max: 20500 }),
  sigmaK: fc.integer({ min: 1, max: 200 }),
});

describe('capability', () => {
  it('global checks: Cpk ≤ Cp; Cp = Cpk ⇔ μ at the middle; (Cpu + Cpl)/2 = Cp', () => {
    fc.assert(
      fc.property(specArb, ({ lslK, width, muK, sigmaK }) => {
        const lsl = D.q(lslK, 1000);
        const usl = D.q(lslK + width, 1000);
        const c = capability({ lsl, usl }, D.q(muK, 1000), sigmaK / 1000);
        return checkCapability(c).length === 0;
      }),
    );
  });
  it('the exact middle gives Cp = Cpk and centered = yes', () => {
    const c = capability({ lsl: dec('9,98'), usl: dec('10,02') }, dec('10'), 0.005);
    expect(c.centered).toBe('yes');
    expect(c.cp).toBe(c.cpk);
    expect(checkCapability(c)).toEqual([]);
  });
  it('widening the spec symmetrically increases Cp', () => {
    fc.assert(
      fc.property(specArb, fc.integer({ min: 1, max: 100 }), ({ lslK, width, muK, sigmaK }, extra) => {
        const mu = D.q(muK, 1000);
        const a = capability({ lsl: D.q(lslK, 1000), usl: D.q(lslK + width, 1000) }, mu, sigmaK / 1000);
        const b = capability({ lsl: D.q(lslK - extra, 1000), usl: D.q(lslK + width + extra, 1000) }, mu, sigmaK / 1000);
        return b.cp! > a.cp!;
      }),
    );
  });
  it('one-sided specs give only the index of that side', () => {
    const c = capability({ usl: dec('20,06') }, dec('20,01'), 0.015);
    expect(c.cp).toBeUndefined();
    expect(c.cpl).toBeUndefined();
    expect(c.cpk).toBeCloseTo(1.1111111, 6);
  });
  it('verdicts with explicit thresholds', () => {
    expect(capableVerdict(0.99)).toBe('not');
    expect(capableVerdict(1)).toBe('marginal');
    expect(capableVerdict(1.329)).toBe('marginal');
    expect(capableVerdict(1.33)).toBe('capable');
    expect(capableVerdict(1.5, [1.33, 1.67])).toBe('marginal');
  });
  it('% defective is in [0, 1] and matches the tails', () => {
    fc.assert(
      fc.property(specArb, ({ lslK, width, muK, sigmaK }) => {
        const p = populationDefects(muK / 1000, sigmaK / 1000, lslK / 1000, (lslK + width) / 1000);
        return checkDefects(p).length === 0 && Math.abs(p.total - (p.below! + p.above!)) < 1e-15;
      }),
    );
  });
});

describe('σ̂ estimates', () => {
  it('R̄/d₂ uses the table d₂ and the exact R̄', () => {
    const groups = [
      ['10,02', '10,00', '9,99'],
      ['10,01', '9,98', '10,00'],
    ].map((g) => g.map(dec));
    const s = sigmaHat({ kind: 'subgroups', groups, unit: 'mm' }, 'Rbar/d2');
    // R = 0,03 and 0,03 → R̄ = 0,03; d₂(3) = 1,693
    expect(D.eq(s.rbar!, dec('0,03'))).toBe(true);
    expect(s.value).toBeCloseTo(0.03 / 1.693, 15);
  });
  it('unequal subgroups are refused', () => {
    expect(() => sigmaHat({ kind: 'subgroups', groups: [[dec('1'), dec('2')], [dec('1')]], unit: '' }, 'Rbar/d2')).toThrow();
  });
});

describe('control charts: solver A = solver B for out-of-control points', () => {
  it('X̄-R (exact limits)', () => {
    fc.assert(
      fc.property(groupsArb, (groups) => {
        const a = xbarRChart(groups);
        const b = xbarROutB(groups);
        return JSON.stringify([a.outXbar, a.outR]) === JSON.stringify([b.outXbar, b.outR]);
      }),
    );
  });
  it('a shifted subgroup is detected', () => {
    const base = Array.from({ length: 20 }, (_, i) => ['40,000', '40,004', '39,998', '40,002', '39,996'].map((v, j) => D.add(dec(v), D.q(((i + j) % 3) - 1, 1000))));
    base[7] = base[7]!.map((x) => D.add(x, dec('0,02')));
    const c = xbarRChart(base);
    expect(c.outXbar).toContain(8);
  });

  const attrArb = fc.constantFrom<ChartKind>('p', 'np', 'c', 'u').chain((chart) => {
    const constN = chart === 'np' || chart === 'c';
    const nArb = fc.integer({ min: 20, max: 300 });
    return fc.tuple(fc.constant(chart), nArb, fc.array(fc.tuple(nArb, fc.integer({ min: 0, max: 40 })), { minLength: 5, maxLength: 30 })).map(([ch, n0, raw]) => ({
      chart: ch,
      samples: raw.map(([n, d]) => {
        const nn = constN ? n0 : n;
        return { n: nn, defects: ch === 'p' || ch === 'np' ? Math.min(d, nn) : d };
      }),
    }));
  });
  it('p, np, c, u (A numeric, B exact without square roots)', () => {
    fc.assert(
      fc.property(attrArb, ({ chart, samples }) => {
        const a = attributeChart(chart, samples);
        if (checkAttribute(a).length) return false;
        return JSON.stringify(a.out) === JSON.stringify(attributeOutB(chart, samples));
      }),
      { numRuns: 500 },
    );
  });
  it('LCL negative → 0 (lclRaw kept)', () => {
    const c = attributeChart('c', [1, 2, 0, 3, 1].map((d) => ({ n: 1, defects: d })));
    expect(c.limits[0]!.lclRaw).toBeLessThan(0);
    expect(c.limits[0]!.lcl).toBe(0);
  });
  it('np and c need a constant n', () => {
    expect(() => attributeChart('np', [{ n: 10, defects: 1 }, { n: 20, defects: 1 }])).toThrow();
  });
  it('X̄-s limits use A₃, B₃, B₄ and σ̂ = s̄/c₄', () => {
    const groups = [
      ['5,0', '5,2', '4,9', '5,1'],
      ['5,1', '5,0', '5,0', '4,8'],
      ['4,9', '5,1', '5,2', '5,0'],
    ].map((g) => g.map(dec));
    const c = xbarSChart(groups);
    expect(c.xbar.ucl - c.xbar.cl).toBeCloseTo(1.628 * c.sbar, 14); // A₃(4)
    expect(c.s.ucl).toBeCloseTo(2.266 * c.sbar, 14); // B₄(4)
    expect(c.s.lcl).toBe(0); // B₃(4) = 0
    expect(c.sigmaHat).toBeCloseTo(c.sbar / 0.9213, 14);
  });
});

describe('pareto', () => {
  const itemsArb = fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 2, maxLength: 9 }).filter((v) => v.some((x) => x > 0)).map((vs) => vs.map((v, i) => ({ label: String.fromCharCode(65 + i), value: D.q(v) })));
  it('descending, cumulative ends at 100 (global checks)', () => {
    fc.assert(fc.property(itemsArb, (items) => checkPareto(pareto(items)).length === 0));
  });
  it('crossing rule includes the crossing item; within rule does not', () => {
    const items = [['A', '50'], ['B', '25'], ['C', '15'], ['D', '10']].map(([label, v]) => ({ label: label!, value: dec(v!) }));
    expect(pareto(items, 80, 'crossing').classA).toEqual(['A', 'B', 'C']);
    expect(pareto(items, 80, 'within').classA).toEqual(['A', 'B']);
    expect(pareto(items, 75, 'within').classA).toEqual(['A', 'B']); // exactly 75 is within
  });
});

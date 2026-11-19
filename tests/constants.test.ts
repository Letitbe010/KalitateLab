import table from '../src/data/constants.json';
import { CONST_NAMES, c4Exact, constantText, constants, d2Exact, d3Exact, firstPrinciples, N_MAX, N_MIN } from '../src/core/constants';
import * as D from '../src/core/decimal';

/** Round half up to `k` decimals (as printed tables do). */
const r = (x: number, k: number): number => Math.round(x * 10 ** k + 1e-9) / 10 ** k;

/**
 * Documented exceptions where the printed table differs from rounding the exact value.
 * n = 19: exact d₃ = 0.73348 (→ 0.733), but printed tables give 0.734 because they round the
 * 4-decimal 0.7335 again (SPC for Excel lists 0.7335). The printed value is kept because it is
 * what the student uses; the difference (0.0005) is far inside the 0.2 % grading tolerance.
 */
/** D₃/D₄ cells where the printed value is the exact value ± 0.001 (older tables). */
const PRINTED_D_EXCEPTIONS = ['D4(3)', 'D4(18)', 'D3(19)', 'D4(19)', 'D3(22)', 'D4(22)', 'D3(24)'];
const D3_PRINTED_EXCEPTIONS: Record<number, string> = { 19: '0.734' };

// Computing d₃ needs a 2-D integral; do it once per n for the whole file.
const FP = new Map<number, ReturnType<typeof firstPrinciples>>();
for (let n = N_MIN; n <= N_MAX; n++) FP.set(n, firstPrinciples(n, d2Exact(n), d3Exact(n)));

describe('SPC constants: table = first principles (spec §3, §5.2)', () => {
  it('has every n from 2 to 25 and every constant', () => {
    for (let n = N_MIN; n <= N_MAX; n++) for (const k of CONST_NAMES) expect(constantText(n, k)).toMatch(/^\d+(\.\d+)?$/);
    expect(() => constants(1)).toThrow();
    expect(() => constants(26)).toThrow();
  });

  it('d₂, d₃, A₂ (3 decimals) and c₄ (4 decimals) are the rounded first-principles values', () => {
    for (let n = N_MIN; n <= N_MAX; n++) {
      const t = constants(n);
      const fp = FP.get(n)!;
      expect([n, D.toNumber(t.d2)]).toEqual([n, r(fp.d2, 3)]);
      if (n in D3_PRINTED_EXCEPTIONS) {
        // printed value kept; it must still be within 0.0006 of the exact value
        expect(Math.abs(D.toNumber(t.d3) - fp.d3)).toBeLessThan(0.0006);
      } else {
        expect([n, D.toNumber(t.d3)]).toEqual([n, r(fp.d3, 3)]);
      }
      expect([n, D.toNumber(t.A2)]).toEqual([n, r(fp.A2, 3)]);
      expect([n, D.toNumber(t.c4)]).toEqual([n, r(fp.c4, 4)]);
    }
  });

  it('A₃, B₃ and B₄ are the rounded first-principles values', () => {
    for (let n = N_MIN; n <= N_MAX; n++) {
      const t = constants(n);
      const fp = FP.get(n)!;
      expect([n, 'A3', D.toNumber(t.A3)]).toEqual([n, 'A3', r(fp.A3, 3)]);
      expect([n, 'B3', D.toNumber(t.B3)]).toEqual([n, 'B3', r(fp.B3, 3)]);
      expect([n, 'B4', D.toNumber(t.B4)]).toEqual([n, 'B4', r(fp.B4, 3)]);
    }
  });

  it('D₃, D₄ (printed) are within 0.001 of the exact values (printed tables differ by 0.001 in a few cells)', () => {
    const offByOne: string[] = [];
    for (let n = N_MIN; n <= N_MAX; n++) {
      const t = constants(n);
      const fp = FP.get(n)!;
      for (const k of ['D3', 'D4'] as const) {
        const diff = Math.abs(D.toNumber(t[k]) - fp[k]);
        expect([n, k, diff <= 0.001 + 1e-9]).toEqual([n, k, true]);
        if (D.toNumber(t[k]) !== r(fp[k], 3)) offByOne.push(`${k}(${n})`);
      }
    }
    // Pin the list so a transcription change is noticed (see constants.json _source).
    expect(offByOne.join(",")).toEqual(PRINTED_D_EXCEPTIONS.join(","));
  });

  it('spec §3 reference for n = 5: A₂ = 0,577; D₃ = 0; D₄ = 2,114; d₂ = 2,326', () => {
    const t = constants(5);
    expect(D.toString(t.A2)).toBe(D.toString(D.dec('0,577')));
    expect(D.isZero(t.D3)).toBe(true);
    expect(D.toString(t.D4)).toBe(D.toString(D.dec('2,114')));
    expect(D.toString(t.d2)).toBe(D.toString(D.dec('2,326')));
  });

  it('first principles match known high-precision values', () => {
    expect(d2Exact(2)).toBeCloseTo(2 / Math.sqrt(Math.PI), 10); // d₂(2) = 2/√π
    expect(c4Exact(2)).toBeCloseTo(Math.sqrt(2 / Math.PI), 14); // c₄(2) = √(2/π)
    expect(d3Exact(2)).toBeCloseTo(Math.sqrt(2 - 4 / Math.PI), 6); // R = |X₁ − X₂| ~ σ√2·|Z|
  });

  it('records its source', () => {
    expect(table._source).toMatch(/spcforexcel/);
  });
});

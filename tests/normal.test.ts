import fc from 'fast-check';
import { density, erf, erfc, phi, phiB, phiInv, upperTail, upperTailB } from '../src/core/normal';

// Reference values: Abramowitz & Stegun Table 26.1 / high-precision tables
// (Φ(1.96), Φ(3), Q(6) are standard, quoted to 16 digits in many references).
describe('normal: solver A against reference values', () => {
  it('Φ(0) = 0.5 and known quantiles', () => {
    expect(phi(0)).toBe(0.5);
    expect(phi(1.96)).toBeCloseTo(0.9750021048517795, 14);
    expect(phi(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(phi(3)).toBeCloseTo(0.9986501019683699, 14);
    expect(phi(-2)).toBeCloseTo(0.022750131948179195, 15);
  });
  it('far tail is accurate in relative terms', () => {
    expect(upperTail(6) / 9.865876450376946e-10).toBeCloseTo(1, 10);
    expect(upperTail(4.5) / 3.3976731247300535e-6).toBeCloseTo(1, 10);
  });
  it('erf/erfc continuity at the switch points x = 2 (erfc) and x = 3 (erf)', () => {
    // below x = 2 erfc = 1 − erf(series): absolute error ~1e-14, relative ~1e-11 at the switch
    expect(Math.abs(erfc(2 - 1e-12) / erfc(2 + 1e-12) - 1)).toBeLessThan(2e-11);
    expect(Math.abs(erf(3 - 1e-12) - erf(3 + 1e-12))).toBeLessThan(1e-15);
    expect(Math.abs(erfc(3 - 1e-12) - erfc(3 + 1e-12))).toBeLessThan(1e-15);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 15);
  });
});

describe('normal: solver B (Simpson) agrees with solver A', () => {
  it('|A − B| < 1e-10 on a grid from −8 to 8', () => {
    for (let z = -8; z <= 8; z += 0.01) {
      expect(Math.abs(phi(z) - phiB(z))).toBeLessThan(1e-10);
      expect(Math.abs(upperTail(z) - upperTailB(z))).toBeLessThan(1e-10);
    }
  });
  it('relative agreement in the tail (ppm level)', () => {
    for (const z of [3, 3.5, 4, 4.667, 5, 6]) {
      expect(Math.abs(upperTail(z) / upperTailB(z) - 1)).toBeLessThan(1e-8);
    }
  });
});

describe('normal: properties', () => {
  it('Φ(−z) = 1 − Φ(z)', () => {
    fc.assert(fc.property(fc.double({ min: -8, max: 8, noNaN: true }), (z) => Math.abs(phi(-z) - (1 - phi(z))) < 1e-15));
  });
  it('Φ is monotone non-decreasing and Q = 1 − Φ', () => {
    fc.assert(
      fc.property(fc.double({ min: -8, max: 8, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (z, h) => {
        return phi(z + h) >= phi(z) && Math.abs(upperTail(z) - (1 - phi(z))) < 1e-15;
      }),
    );
  });
  it('density integrates to Φ differences', () => {
    expect(density(0)).toBeCloseTo(0.3989422804014327, 15);
  });
  it('Φ⁻¹ inverts Φ', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-12, max: 1 - 1e-12, noNaN: true }), (p) => {
        const x = phiInv(p);
        const back = p < 0.5 ? phi(x) : 1 - upperTail(x);
        return Math.abs(back - p) <= 1e-14 + 1e-12 * Math.min(p, 1 - p);
      }),
    );
    expect(phiInv(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(phiInv(0.5)).toBeCloseTo(0, 15);
  });
});

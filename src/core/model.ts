/**
 * Data model (spec §4). Every measured value is an exact Decimal; counts are integers.
 */
import type { Decimal } from './decimal';

/** One class of a frequency table: a point value x (class mark) or an interval [a, b). */
export interface FreqClass {
  x?: Decimal;
  a?: Decimal;
  b?: Decimal;
  f: number;
}

export type ChartKind = 'p' | 'np' | 'c' | 'u';

export type Dataset =
  | { kind: 'values'; values: Decimal[]; unit: string }
  | { kind: 'freq'; classes: FreqClass[]; unit: string }
  | { kind: 'subgroups'; groups: Decimal[][]; unit: string }
  | { kind: 'summary'; mean: Decimal; sd: Decimal; sdKind: 's' | 'sigma'; n?: number; unit: string }
  | { kind: 'attributes'; samples: { n: number; defects: number }[]; chart: ChartKind }
  | { kind: 'pareto'; items: { label: string; value: Decimal }[] };

/** Specification limits. An ISO designation (e.g. "40p6") is text only: limits are always given as numbers. */
export interface Spec {
  lsl?: Decimal;
  usl?: Decimal;
  nominal?: Decimal;
  designation?: string;
}

export type SdRule = 's' | 'sigma' | 'either';
export type SigmaHatRule = 's' | 'Rbar/d2' | 'sbar/c4';

/** Comparison of a value with a bound: strict (<, >) or inclusive (≤, ≥). Stated in the exercise. */
export type BoundSide = 'lt' | 'le' | 'gt' | 'ge';

export type AskType =
  | 'mean'
  | 'sd'
  | 'pctSample'
  | 'pctPopulation'
  | 'z'
  | 'cp'
  | 'cpk'
  | 'cpu'
  | 'cpl'
  | 'capable'
  | 'centered'
  | 'sigmaHat'
  | 'controlLimits'
  | 'outOfControl'
  | 'pareto';

export interface Ask {
  id: string;
  type: AskType;
  /** pctSample: the bound(s) and the comparison; pctPopulation: which tail(s). */
  bound?: Decimal;
  side?: BoundSide;
  tails?: 'below' | 'above' | 'outside';
  /** controlLimits / outOfControl: which chart. */
  chart?: 'xbar' | 'R' | 's' | ChartKind;
  /** capable: the index the verdict is based on (default Cp, spec §3). */
  index?: 'cp' | 'cpk';
}

export interface Rules {
  sd: SdRule;
  sigmaHat?: SigmaHatRule;
  /** [marginal, capable] thresholds on Cp; default [1, 1.33]. */
  capableThresholds?: [number, number];
  westernElectric?: boolean;
  /** Pareto: cumulative % that defines class A, and whether the crossing item is included. */
  paretoThreshold?: number;
  paretoRule?: 'crossing' | 'within';
}

export interface Exercise {
  id: string;
  origin: 'ope' | 'adapted' | 'generated';
  sourceNote?: string;
  sourceUrl?: string;
  seed?: number;
  difficulty: 1 | 2 | 3;
  dataset: Dataset;
  spec?: Spec;
  rules: Rules;
  asks: Ask[];
  weights: Record<string, number>;
  text: { eu: string; es: string };
}

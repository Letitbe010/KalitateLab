/**
 * Theory content model (spec §14). Texts are templates: numbers in examples come from the
 * solvers through {{…}} variables (src/ui/theoryTemplate.ts), computed on a verified pool
 * exercise. Formulas are LaTeX (KaTeX); a formula with `check` is tested against the
 * solvers on 1000 random cases (tests/theory.test.ts).
 *
 * Deviation from the spec (agreed): structured TypeScript data instead of MDX.
 */
export type FormulaId =
  | 'mean'
  | 'mean-freq'
  | 'var-sample'
  | 'var-pop'
  | 'z'
  | 'pct-population'
  | 'cp'
  | 'cpu'
  | 'cpl'
  | 'cpk'
  | 'cp-cpk-mean';

export type Bi = { eu: string; es: string };

export type Block =
  | ({ t: 'p' } & Bi)
  | { t: 'f'; tex: string; check?: FormulaId }
  | { t: 'list'; eu: string[]; es: string[] }
  | ({ t: 'note'; kind: 'careful' | 'ope' } & Bi)
  /** worked example on a pool exercise; {{…}} variables are filled from the solvers */
  | ({ t: 'example'; pool: string } & Bi)
  | { t: 'widget'; w: 'capability' | 'nvsn1' | 'control' | 'constants' }
  | { t: 'figure'; f: 'empirical' };

export interface Topic {
  id: string;
  title: Bi;
  status: 'draft' | 'reviewed';
  blocks: Block[];
}

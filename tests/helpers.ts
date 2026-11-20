import type { Answer } from '../src/core/grader';
import type { Exercise } from '../src/core/model';
import { solveExercise, type Expected } from '../src/core/solve';

const fmt = (x: number): string => x.toPrecision(12);

/** Answers built from the solver output at full precision (a perfect student). */
export function perfectAnswers(e: Exercise): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const [id, x] of Object.entries(solveExercise(e)) as [string, Expected][]) {
    if (x.kind === 'number') out[id] = { value: fmt(x.value) };
    if (x.kind === 'limits') out[id] = { cl: fmt(x.cl), ucl: fmt(x.ucl), lcl: fmt(x.lcl) };
    if (x.kind === 'choice') out[id] = { choice: x.value };
    if (x.kind === 'set') out[id] = { set: x.value.join(', ') };
    if (x.kind === 'pareto') out[id] = { order: x.order.join(', '), cumPct: x.cumPct.map(fmt), classA: x.classA.join(', ') };
  }
  return out;
}

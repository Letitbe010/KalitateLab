import { generate, LEVELS, rebuild, TEMPLATES, verifyExercise, type TemplateId } from '../src/core/generator';
import { grade } from '../src/core/grader';
import { exerciseFromJSON, exerciseToJSON } from '../src/core/serialize';
import { perfectAnswers } from './helpers';

const J = (e: Parameters<typeof exerciseToJSON>[0]): string => JSON.stringify(exerciseToJSON(e));

const N = Number(process.env.GEN_N ?? 10000);

describe(`generator: ${N} exercises verified (spec §12, phase 4)`, () => {
  it('every template and level produces verified exercises that a perfect answer grades 10/10', () => {
    const combos: [TemplateId, 1 | 2 | 3][] = TEMPLATES.flatMap((t) => LEVELS[t].map((l) => [t, l] as [TemplateId, 1 | 2 | 3]));
    const counts = new Map<string, number>();
    let maxAttempts = 0;
    for (let i = 0; i < N; i++) {
      const [t, lv] = combos[i % combos.length]!;
      const { exercise, attempts } = generate(t, 1000 + i, lv);
      maxAttempts = Math.max(maxAttempts, attempts);
      const v = verifyExercise(exercise);
      if (!v.ok) throw new Error(`${exercise.id}: ${v.reasons.join('; ')}`);
      const g = grade(exercise, perfectAnswers(exercise));
      if (g.score10 !== 10) throw new Error(`${exercise.id}: perfect answers scored ${g.score10}`);
      if (!exercise.text.eu || !exercise.text.es) throw new Error(`${exercise.id}: missing statement`);
      counts.set(`${t}-${lv}`, (counts.get(`${t}-${lv}`) ?? 0) + 1);
    }
    expect(counts.size).toBe(combos.length);
    expect(maxAttempts).toBeLessThan(60);
  }, 600_000);

  it('same seed → same exercise; the stored seed rebuilds it exactly', () => {
    for (const t of TEMPLATES) {
      const lv = LEVELS[t][0]!;
      const a = generate(t, 42, lv).exercise;
      const b = generate(t, 42, lv).exercise;
      expect(J(a)).toBe(J(b));
      expect(J(rebuild(t, a.seed!, lv))).toBe(J(a));
      // JSON round trip is lossless
      expect(J(exerciseFromJSON(JSON.parse(J(a))))).toBe(J(a));
    }
  });

  it('different seeds give different exercises', () => {
    const sigs = new Set<string>();
    for (let s = 0; s < 50; s++) sigs.add(J(generate('freqTable', s, 1).exercise));
    expect(sigs.size).toBeGreaterThan(45);
  });
});

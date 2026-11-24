/**
 * Scale a generated paper's marks to the total the teacher chose.
 *
 * Whole marks only, at least one per question — what a Jordanian paper prints —
 * shared in proportion to the marks the generator gave (1/2/3/4 by competency),
 * by largest remainder, so the competency weighting survives the scaling and a
 * harder question is never worth less than an easier one.
 */

/** `null` when it cannot be done: no questions, a total that is not a whole number, or fewer marks than questions. */
export function scaleMarks(weights: readonly number[], total: number): number[] | null {
  const n = weights.length;
  if (n === 0 || !Number.isInteger(total) || total < n) return null;
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const ideal = weights.map(w => (sum > 0 ? (total * Math.max(0, w)) / sum : total / n));
  const out = ideal.map(x => Math.max(1, Math.floor(x)));
  const rest = (i: number) => ideal[i]! - out[i]!;
  // Ties go to the heavier question, then to the earlier one.
  const byRest = (a: number, b: number) => rest(b) - rest(a) || weights[b]! - weights[a]! || a - b;

  let diff = total - out.reduce((a, b) => a + b, 0);
  while (diff > 0) {
    const order = out.map((_, i) => i).sort(byRest);
    for (const i of order) {
      if (diff === 0) break;
      out[i]! += 1;
      diff -= 1;
    }
  }
  while (diff < 0) {
    // Only where the floor of one mark lifted the sum above the total.
    const order = out.map((_, i) => i).filter(i => out[i]! > 1).sort(byRest).reverse();
    for (const i of order) {
      if (diff === 0) break;
      out[i]! -= 1;
      diff += 1;
    }
  }
  return out;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * A question's rubric, moved from `from` marks to `to`. The criteria and their
 * levels carry marks on the question's own scale (a teacher reads «٣ علامات»
 * beside a question now worth 6), so they move with it: criteria that added up
 * to the old marks add up to the new ones (whole marks where there are enough,
 * else shared in proportion), and each level keeps its share of its criterion.
 * Anything not shaped like that is returned as it was.
 */
export function scaleRubric(
  rubric: Record<string, unknown> | null,
  from: number,
  to: number,
): Record<string, unknown> | null {
  if (!rubric || from === to || !(from > 0) || !(to > 0)) return rubric;
  const criteria = rubric["criteria"];
  if (!Array.isArray(criteria) || criteria.length === 0) return rubric;
  const old = criteria.map(c => Number((c as Record<string, unknown>)?.["marks"]));
  if (old.some(m => !Number.isFinite(m) || m < 0)) return rubric;

  const oldSum = old.reduce((a, b) => a + b, 0);
  const whole = Math.abs(oldSum - from) < 0.01 && Number.isInteger(to) ? scaleMarks(old, to) : null;
  const next = whole ?? old.map(m => round2((m * to) / from));

  return {
    ...rubric,
    criteria: criteria.map((c, i) => {
      const crit = c as Record<string, unknown>;
      const was = old[i]!;
      const now = next[i]!;
      const levels = crit["levels"];
      return {
        ...crit,
        marks: now,
        ...(Array.isArray(levels)
          ? {
            levels: levels.map(l => {
              const level = l as Record<string, unknown>;
              const m = Number(level?.["marks"]);
              if (!Number.isFinite(m) || was <= 0) return level;
              // Halves, as a teacher writes a partial mark; never above the criterion.
              return { ...level, marks: Math.min(now, Math.round(((m * now) / was) * 2) / 2) };
            }),
          }
          : {}),
      };
    }),
  };
}

/**
 * The generated questions' marks for a paper whose teacher asked for `target`
 * in all. `kept` is what the teacher's own questions (which survive a
 * regeneration) already carry; the generated ones share the rest. Without a
 * target, or when the rest is too small for one whole mark each, the marks are
 * returned as given and `note` says why the total was not met.
 */
export function fitToTotal(
  marks: readonly number[],
  kept: number,
  target: number | null | undefined,
): { marks: number[]; note?: string } {
  if (target === null || target === undefined || marks.length === 0) return { marks: [...marks] };
  const scaled = scaleMarks(marks, target - kept);
  if (scaled) return { marks: scaled };
  return {
    marks: [...marks],
    note:
      `The paper could not be brought to the ${target} marks asked for: `
      + `${marks.length} generated question${marks.length === 1 ? "" : "s"} need at least one mark each`
      + (kept > 0 ? `, and your own questions already carry ${kept}` : "")
      + ". The generator's own marks were kept.",
  };
}

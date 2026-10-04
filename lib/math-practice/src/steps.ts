/**
 * Worked solutions for the bank items that have one.
 *
 * Not every item has steps, and that is the point of `stepsFor` returning
 * `undefined`: a paper offers a worked example or a worked key line only where
 * a person wrote and checked the working. It never derives or invents one.
 */
import type { SolutionSteps } from './steps-types.ts';
import { MATH_A_STEPS } from './steps-math-a.ts';
import { MATH_B_STEPS } from './steps-math-b.ts';
import { MATH_C_STEPS } from './steps-math-c.ts';
import { CHEM_A_STEPS } from './steps-chem-a.ts';
import { CHEM_B_STEPS } from './steps-chem-b.ts';

export type { SolutionSteps } from './steps-types.ts';

const STEPS: Readonly<Record<string, SolutionSteps>> = {
  ...MATH_A_STEPS,
  ...MATH_B_STEPS,
  ...MATH_C_STEPS,
  ...CHEM_A_STEPS,
  ...CHEM_B_STEPS,
};

/** The authored working for a bank item, or `undefined` when it has none. */
export function stepsFor(itemId: string): SolutionSteps | undefined {
  return STEPS[itemId];
}

/** Every item id that has working — for tests and coverage reports. */
export function solvedItemIds(): string[] {
  return Object.keys(STEPS);
}

/**
 * Split worked steps into the lines a half-solved question shows and the ones
 * the student must supply.
 *
 * Half, rounded down, with at least one given — and always the last line,
 * which states the result, left for the student. Two steps give one, three
 * give one, six give three. The student is finishing the method, so the line
 * that holds the answer is never handed over.
 */
export function completionSplit(steps: readonly string[]): { given: string[]; remaining: number } {
  const given = Math.max(1, Math.min(steps.length - 1, Math.floor(steps.length / 2)));
  return { given: steps.slice(0, given), remaining: steps.length - given };
}

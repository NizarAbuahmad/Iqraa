/** Timings for the answer boards' feedback, and the streak rule. Pure, so node --test can read it. */
export const ANSWER_MOTION = {
  /** translateX keyframes of a wrong pick's shake, ending at rest. */
  shake: [-6, 6, -4, 4, 0],
  shakeStepMs: 45,
  /** How far the right option swells, and how long each half takes. */
  popScale: 1.05,
  popMs: 120,
} as const;

export const STREAK_SHOW_AT = 2;
export const nextStreak = (current: number, correct: boolean): number => (correct ? current + 1 : 0);
export const showStreak = (streak: number): boolean => streak >= STREAK_SHOW_AT;

/**
 * When a chip in `ChipGroup` cannot be switched off. Pure, so the rule is tested
 * on its own (the component imports react-native and cannot be loaded by
 * `node --test`).
 *
 * - A single-choice group never locks a chip: pressing the chosen one is a no-op,
 *   not a refusal, so it is not announced as disabled.
 * - A disabled option never counts and is never "the last one".
 * - In a multi-select, the last `min` enabled selected chips are locked. With
 *   `min` 0 (the default) nothing is ever locked, so every chip can be cleared.
 */
export function chipLocked(opts: {
  single: boolean;
  /** This chip is selected. */
  on: boolean;
  /** This chip is disabled. */
  off: boolean;
  /** How many enabled chips are selected, this one included. */
  counted: number;
  min: number;
}): boolean {
  return !opts.single && opts.min > 0 && opts.on && !opts.off && opts.counted <= opts.min;
}

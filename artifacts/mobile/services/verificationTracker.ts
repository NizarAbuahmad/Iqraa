/**
 * Ties a background verification run to the output it was started for.
 *
 * Verification runs after a paper is on screen, against a service that may
 * be asleep. Its result is positional (one outcome per question), so a result
 * that lands after the paper changed — a regenerate, a level switch, a
 * question deleted — would badge the wrong paper, or the wrong question. The
 * screen begins a run with the exact output it sends, and accepts a result
 * only while that output is still the one it is showing.
 */
export type VerificationTracker<T extends object> = {
  /** Mark `out` as the output a result may land on. */
  begin(out: T): void;
  /** Is `out` still the output on screen? */
  accepts(out: T): boolean;
  /** Nothing may land until the next `begin` — e.g. after a delete reshaped the list. */
  drop(): void;
};

export function createVerificationTracker<T extends object>(): VerificationTracker<T> {
  let current: T | null = null;
  return {
    begin(out) { current = out; },
    accepts(out) { return current !== null && current === out; },
    drop() { current = null; },
  };
}

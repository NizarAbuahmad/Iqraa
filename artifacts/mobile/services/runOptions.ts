/**
 * What a generator run was asked for, so Retry can repeat exactly that.
 *
 * `GenerationStatus` hands its Retry button's press event to `onRetry`, and a
 * screen that wrote `onRetry={generate}` passed that event to `generate` as its
 * options. `runOptions` is the one place that reads options defensively: only a
 * literal `true` counts, so an event (or anything else) can never switch a mode
 * on, and a mode that was on is carried across by passing the stored options back.
 */
export interface RunOptions {
  /** The teacher asked for a replacement of what is on screen, not another copy. */
  regenerate: boolean;
  /** The worksheet's «ثلاثة مستويات»: the same paper at each difficulty. */
  levels: boolean;
}

export function runOptions(raw: unknown): RunOptions {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { regenerate?: unknown; levels?: unknown };
  return { regenerate: o.regenerate === true, levels: o.levels === true };
}

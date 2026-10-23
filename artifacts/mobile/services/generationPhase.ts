/**
 * Which state the generator's status block (`GenerationStatus`) is in. One
 * expression for all five generator screens, so the precedence is stated, and
 * tested, once.
 *
 * Precedence: a run in flight beats everything; then a cancel; then a failure.
 * `cancelled` is therefore sticky, which is why every screen's `generate` clears
 * it FIRST, before any refusal can return: a Cancel followed by a refused press
 * (no curriculum for this scope, a topic from another subject) would otherwise
 * keep saying «أُلغي» over the refusal's own message.
 *
 * `failed` is whether there is a generation failure to show; a screen whose
 * empty-topic refusal is drawn beside the field passes false for it.
 */
export type GenerationPhase = 'loading' | 'cancelled' | 'error' | 'idle';

export function generationPhase(s: { loading: boolean; cancelled: boolean; failed: boolean }): GenerationPhase {
  return s.loading ? 'loading' : s.cancelled ? 'cancelled' : s.failed ? 'error' : 'idle';
}

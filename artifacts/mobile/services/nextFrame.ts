/**
 * Resolves after the next frame, so state set just before it (a spinner, a
 * disabled button) paints before synchronous work — KB grounding — blocks the
 * JS thread. `await` this right after `setLoading(true)` in a tap handler.
 */
export const nextFrame = (): Promise<void> =>
  new Promise(resolve => requestAnimationFrame(() => resolve()));

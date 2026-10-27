/**
 * Where the tour finds the element a step points at. A screen registers a
 * handle under a target id (`useTourTarget` / `TourTarget`) while the element is
 * mounted, and the overlay asks for its rectangle when it reaches the step.
 *
 * An id can have several registrants: on desktop the bottom tab bar is
 * `display: none` but still mounted, so its buttons register next to the
 * sidebar's rows and measure 0×0. The one that is actually on screen has a
 * rectangle with an area; `measureTarget` returns that one.
 *
 * Pure (no React Native import) so `node --test` can pin it — the handle is
 * whatever the caller wraps `measureInWindow` in.
 */
export type Rect = { x: number; y: number; width: number; height: number };

export type TourTargetHandle = {
  /** The element's rectangle in window coordinates, or `null` when it cannot be measured. */
  measure: () => Promise<Rect | null>;
  /** Brings the element on screen first (a scroll view scrolling to it), when it may be off it. */
  reveal?: () => Promise<void> | void;
};

const targets = new Map<string, TourTargetHandle[]>();

/** Registers a handle under `id`; call the returned function when the element unmounts. */
export function registerTarget(id: string, handle: TourTargetHandle): () => void {
  targets.set(id, [...(targets.get(id) ?? []), handle]);
  return () => {
    const rest = (targets.get(id) ?? []).filter(h => h !== handle);
    if (rest.length > 0) targets.set(id, rest);
    else targets.delete(id);
  };
}

export function hasTarget(id: string): boolean {
  return targets.has(id);
}

export async function revealTarget(id: string): Promise<void> {
  for (const handle of targets.get(id) ?? []) {
    try {
      await handle.reveal?.();
    } catch {
      // A reveal that fails only means the element may stay where it was.
    }
  }
}

/** The first registrant, in registration order, whose rectangle has an area. */
export async function measureTarget(id: string): Promise<Rect | null> {
  for (const handle of targets.get(id) ?? []) {
    try {
      const rect = await handle.measure();
      if (rect && rect.width > 0 && rect.height > 0) return rect;
    } catch {
      // An element that unmounted mid-measure is simply not visible.
    }
  }
  return null;
}

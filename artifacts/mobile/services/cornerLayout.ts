// artifacts/mobile/services/cornerLayout.ts
/**
 * Columns for a corner hub's card grid. The same breaks as `libraryColumns`
 * (services/libraryLayout.ts) today, kept as its own function so the two can
 * drift on purpose. `trackWidth` is the content track, i.e. the viewport
 * capped at CONTENT_MAX_WIDTH — not the window.
 */
export function cornerColumns(trackWidth: number): 1 | 2 | 3 {
  if (trackWidth >= 960) return 3;
  if (trackWidth >= 600) return 2;
  return 1;
}

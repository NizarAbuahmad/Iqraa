/**
 * The geometry of the tour overlay: the hole cut in the dim layer, where the
 * card sits relative to it, and the line joining them. Pure numbers, so
 * `node --test` can pin it (services/__tests__/tourPlacement.test.ts).
 *
 * Everything is in the overlay's own coordinates. The overlay measures its own
 * origin and subtracts it from the target's window rectangle, which absorbs an
 * Android status bar or an edge-to-edge offset without knowing about either.
 *
 * Physical left/right, not start/end: the app pins the layout direction to LTR
 * on every platform and flips rows per component (`LanguageContext`), so a
 * rectangle measured in the window is a rectangle in this space. If the app ever
 * moves to a document-level RTL this is the file that must learn about it.
 */
import type { Rect } from './tourRegistry.ts';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/** Breathing room between the target and the ring. */
export const HOLE_PAD = 8;
const MAX_RADIUS = 16;
const CARD_GAP = 16;
const EDGE_MARGIN = 16;
const CONNECTOR_INSET = 16;

/** The target grown by the padding and trimmed to the screen. */
export function holeFor(rect: Rect, size: Size, pad: number = HOLE_PAD): Rect {
  const x0 = Math.max(0, rect.x - pad);
  const y0 = Math.max(0, rect.y - pad);
  const x1 = Math.min(size.width, rect.x + rect.width + pad);
  const y1 = Math.min(size.height, rect.y + rect.height + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function holeRadius(hole: Rect): number {
  return Math.min(MAX_RADIUS, hole.width / 2, hole.height / 2);
}

/**
 * The dim layer as one path: the whole screen, then the hole. Drawn with
 * `fillRule="evenodd"` the inner rectangle is subtracted, so one shape does what
 * four edge-rectangles would, with no seam at the corners.
 */
export function scrimPath(size: Size, hole: Rect, r: number): string {
  const { x, y, width: w, height: h } = hole;
  return [
    `M0 0H${size.width}V${size.height}H0Z`,
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`,
  ].join('');
}

export type CardSide = 'below' | 'above' | 'right' | 'left' | 'dock';
export type CardPlacement = { top: number; left: number; side: CardSide };

/** A target within this of a vertical screen edge counts as "at the edge". */
const SIDE_EDGE_ZONE = 24;
/** And is narrow when it takes no more than this share of the screen's width. */
const NARROW_SHARE = 0.4;
/**
 * Only on a screen this wide. The sidebar it exists for appears at 900 (the
 * app's DESKTOP_BREAKPOINT); no phone is anywhere near this, and there a card
 * beside a tab would be a sliver of screen.
 */
const MIN_BESIDE_WIDTH = 720;

/**
 * Beside the hole when it is a narrow target on a side edge and not on the
 * bottom one — a desktop sidebar row. The card below it would cover the very
 * rows the next steps point at, and a card beside it sits over the content.
 */
function placeBeside(hole: Rect, size: Size, card: Size): CardPlacement | null {
  if (size.width < MIN_BESIDE_WIDTH) return null;
  const atSideEdge = hole.x <= SIDE_EDGE_ZONE || hole.x + hole.width >= size.width - SIDE_EDGE_ZONE;
  const atBottom = hole.y + hole.height >= size.height - SIDE_EDGE_ZONE;
  if (hole.width > size.width * NARROW_SHARE || !atSideEdge || atBottom) return null;
  const top = clamp(hole.y + hole.height / 2 - card.height / 2, EDGE_MARGIN, size.height - EDGE_MARGIN - card.height);
  const rightLeft = hole.x + hole.width + CARD_GAP;
  if (rightLeft + card.width <= size.width - EDGE_MARGIN) return { top, left: rightLeft, side: 'right' };
  const leftLeft = hole.x - CARD_GAP - card.width;
  if (leftLeft >= EDGE_MARGIN) return { top, left: leftLeft, side: 'left' };
  return null;
}

/**
 * Beside a narrow target at a side edge; else below the hole if the card fits
 * there, else above it, else docked at the edge farthest from it (a target as
 * tall as the prep board leaves no room on either side, and the card then
 * overlaps it rather than sitting off-screen).
 */
export function placeCard(hole: Rect, size: Size, card: Size): CardPlacement {
  const beside = placeBeside(hole, size, card);
  if (beside) return beside;
  const centreX = hole.x + hole.width / 2;
  const left = clamp(centreX - card.width / 2, EDGE_MARGIN, size.width - EDGE_MARGIN - card.width);
  const belowTop = hole.y + hole.height + CARD_GAP;
  if (belowTop + card.height <= size.height - EDGE_MARGIN) return { top: belowTop, left, side: 'below' };
  const aboveTop = hole.y - CARD_GAP - card.height;
  if (aboveTop >= EDGE_MARGIN) return { top: aboveTop, left, side: 'above' };
  const holeCentreY = hole.y + hole.height / 2;
  const top = holeCentreY < size.height / 2 ? size.height - EDGE_MARGIN - card.height : EDGE_MARGIN;
  return { top, left, side: 'dock' };
}

/** The welcome step has no target: its card sits in the middle. */
export function centerCard(size: Size, card: Size): { top: number; left: number } {
  return { top: (size.height - card.height) / 2, left: (size.width - card.width) / 2 };
}

/** From the hole edge facing the card to the card's own edge; none when the card overlaps the hole. */
export function connectorFor(
  hole: Rect,
  placement: CardPlacement,
  card: Size,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (placement.side === 'dock') return null;
  if (placement.side === 'right' || placement.side === 'left') {
    const y1 = hole.y + hole.height / 2;
    const y2 = clamp(y1, placement.top + CONNECTOR_INSET, placement.top + card.height - CONNECTOR_INSET);
    return placement.side === 'right'
      ? { x1: hole.x + hole.width, y1, x2: placement.left, y2 }
      : { x1: hole.x, y1, x2: placement.left + card.width, y2 };
  }
  const x1 = hole.x + hole.width / 2;
  const x2 = clamp(x1, placement.left + CONNECTOR_INSET, placement.left + card.width - CONNECTOR_INSET);
  return placement.side === 'below'
    ? { x1, y1: hole.y + hole.height, x2, y2: placement.top }
    : { x1, y1: hole.y, x2, y2: placement.top + card.height };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

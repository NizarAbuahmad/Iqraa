/**
 * Pure utility functions for PresentationScreen.
 *
 * Extracted from presentation.tsx so they can be tested without importing
 * React Native (which cannot run in Node's test runner).
 */

// The timer colours are the deck palette's, not a private copy: this file used
// to re-declare them "mirrored from presentation.tsx", which is how the
// PDF/PPTX palette once drifted from the projected one (see deckTheme.ts).
import { TIMER_AMBER, TIMER_GREEN, TIMER_RED } from './deckTheme.ts';
import { isEnglishSlideContent } from './deckText.ts';

/**
 * Returns the appropriate timer colour based on the fraction of time remaining.
 *
 * @param pct – ratio remaining in [0, 1]. >0.5 → green, >0.2 → amber, else red.
 */
export function timerColor(pct: number): string {
  if (pct > 0.5) return TIMER_GREEN;
  if (pct > 0.2) return TIMER_AMBER;
  return TIMER_RED;
}

/**
 * Compute the timer percentage for a slide.
 * Returns 0 when the slide has no timer (durationSeconds === 0).
 *
 * The screen calls this and `tickTimer` rather than repeating the arithmetic
 * inline — it used to, so these tests covered a copy nobody ran.
 */
export function calcTimerPct(timerSec: number, timerTotal: number): number {
  if (timerTotal === 0) return 0;
  return timerSec / timerTotal;
}

/**
 * Simulate one tick of the countdown timer.
 * Returns the new second count (never below 0).
 */
export function tickTimer(currentSec: number): number {
  return Math.max(0, currentSec - 1);
}

/**
 * Whether a slide should show a timer at all.
 *
 * Type-aware: a duration on a read-out slide type is not a timer.
 * See `timerSecondsForSlide` below.
 */
export function slideHasTimer(slide: { type: string; durationSeconds: number }): boolean {
  return timerSecondsForSlide(slide) > 0;
}

/**
 * Slide types the class reads rather than works through.
 *
 * The generation prompts already ask for `durationSeconds: 0` on these
 * (see artifacts/api-server/src/routes/generate.ts) but nothing enforced it, so
 * a model that emitted a duration anyway put a live countdown on the mission
 * slide — a clock ticking against a paragraph that asks the class to do
 * nothing yet, and a red bar by the time the teacher finishes reading it out.
 */
export const UNTIMED_SLIDE_TYPES = [
  'intro', 'reveal', 'summary', 'divider', 'scoreboard', 'podium',
] as const;

/**
 * How many seconds this slide should actually count down.
 *
 * Refused at display time rather than rewritten into the deck: the value the
 * model produced stays intact for saves and exports, and every surface that
 * shows a timer asks this instead of reading `durationSeconds` raw.
 */
export function timerSecondsForSlide(slide: { type: string; durationSeconds: number }): number {
  if ((UNTIMED_SLIDE_TYPES as readonly string[]).includes(slide.type)) return 0;
  return Math.max(0, slide.durationSeconds || 0);
}

// ─── Projector fullscreen (web only) ───────────────────────────────────────
// Used by presentation.tsx, which projects onto a screen and needs the
// browser chrome out of the way. `document` alone (rather
// than also checking `Platform.OS`) keeps this file free of a react-native
// import, since node --test cannot load that module — a native app is
// already fullscreen, and `document` is simply undefined there.
export const canFullscreen = typeof document !== 'undefined';

/** The slice of `document` the fullscreen helpers touch — injectable for tests. */
type FullscreenDoc = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
};

const globalDoc = (): FullscreenDoc | undefined =>
  typeof document !== 'undefined' ? (document as FullscreenDoc) : undefined;

/**
 * Whether the page is fullscreen, under either API.
 *
 * `toggleFullscreen` already knew about the webkit-prefixed pair, but the
 * screen read back only `document.fullscreenElement`: on older Safari the
 * toggle worked, the icon never flipped, and Escape — which asks this — went
 * on to leave the deck instead of leaving fullscreen.
 */
export function isFullscreen(doc: FullscreenDoc | undefined = globalDoc()): boolean {
  if (!doc) return false;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Subscribe to fullscreen changes under both event names; returns the
 * unsubscribe. Same bug as `isFullscreen`: only `fullscreenchange` was heard,
 * so leaving fullscreen with the browser's own Esc/F11 on webkit left the
 * button showing the wrong state.
 */
export function onFullscreenChange(cb: () => void, doc: FullscreenDoc | undefined = globalDoc()): () => void {
  if (!doc) return () => {};
  doc.addEventListener('fullscreenchange', cb);
  doc.addEventListener('webkitfullscreenchange', cb);
  return () => {
    doc.removeEventListener('fullscreenchange', cb);
    doc.removeEventListener('webkitfullscreenchange', cb);
  };
}

export function toggleFullscreen(): void {
  if (!canFullscreen) return;
  const el = document.documentElement;
  // Older Safari only has the webkit-prefixed pair; if neither exists there is
  // nothing to do but stay windowed.
  const req = el.requestFullscreen ?? (el as any).webkitRequestFullscreen;
  const exit = document.exitFullscreen ?? (document as any).webkitExitFullscreen;
  const run = isFullscreen() ? exit?.call(document) : req?.call(el);
  if (run && typeof run.catch === 'function') run.catch(() => {});
}

// ─── Keyboard / presentation clicker ───────────────────────────────────────

export type DeckKeyAction = 'next' | 'prev' | 'toggleFullscreen' | 'exitFullscreen' | 'back';

export interface DeckKeyEvent {
  key: string;
  /** Physical key — `KeyF` whatever an Arabic layout prints for it ('ب'). */
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  targetTag?: string;
  targetRole?: string | null;
  targetEditable?: boolean;
}

export interface DeckKeyContext {
  /** Arrows follow the on-screen buttons, which mirror in RTL. */
  isRTL: boolean;
  fullscreen: boolean;
  /** A modal (the zoomed figure) owns the keyboard while it is up. */
  modalOpen: boolean;
}

const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const MEDIA_TAGS = new Set(['AUDIO', 'VIDEO']);
const CONTROL_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);
const CONTROL_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option', 'slider',
]);

/**
 * What a key press means to the projected deck, or `null` to leave it alone.
 *
 * Pulled out of the screen's handler, which grabbed every key it recognised
 * wherever it came from:
 *  - no modifier check, so Ctrl/Cmd+F toggled fullscreen instead of opening
 *    the browser's find bar, and Alt/Cmd+Arrow (history) changed slides;
 *  - no target check, so Enter/Space on the focused reveal button both
 *    revealed the answer AND advanced past it, and the `<audio>` player's
 *    own Space/arrows paused the clip and changed the slide;
 *  - Escape on a zoomed figure closed the figure (the Modal's own handling)
 *    and then left the whole deck, because the zoom state lived inside
 *    `MediaView` where the handler could not see it.
 */
export function keyboardAction(e: DeckKeyEvent, ctx: DeckKeyContext): DeckKeyAction | null {
  if (ctx.modalOpen) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const tag = e.targetTag?.toUpperCase();
  const role = e.targetRole?.toLowerCase();
  // A text field takes every printable key, arrows included.
  if (e.targetEditable || (tag && FIELD_TAGS.has(tag))) return null;
  const onMedia = !!tag && MEDIA_TAGS.has(tag);
  const onControl = onMedia || (!!tag && CONTROL_TAGS.has(tag)) || (!!role && CONTROL_ROLES.has(role));

  const forward = e.key === (ctx.isRTL ? 'ArrowLeft' : 'ArrowRight');
  const backward = e.key === (ctx.isRTL ? 'ArrowRight' : 'ArrowLeft');
  const activates = e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';

  // Enter/Space press whatever control has focus; a player also seeks on arrows.
  if (onControl && activates) return null;
  if (onMedia && (forward || backward)) return null;

  if (e.key === 'PageDown' || activates || forward) return 'next';
  if (e.key === 'PageUp' || backward) return 'prev';
  if (e.code === 'KeyF') return 'toggleFullscreen';
  // Esc mid-class must not dump the deck just because the teacher wanted the
  // browser chrome back.
  if (e.key === 'Escape') return ctx.fullscreen ? 'exitFullscreen' : 'back';
  return null;
}

/** The parts of a key event's target `keyboardAction` needs, read defensively. */
export function describeKeyTarget(
  target: EventTarget | null | undefined,
): Pick<DeckKeyEvent, 'targetTag' | 'targetRole' | 'targetEditable'> {
  const el = target as Partial<HTMLElement> | null | undefined;
  return {
    targetTag: typeof el?.tagName === 'string' ? el.tagName : undefined,
    targetRole: typeof el?.getAttribute === 'function' ? el.getAttribute('role') : undefined,
    targetEditable: el?.isContentEditable === true,
  };
}

// ─── Slide content direction ───────────────────────────────────────────────

/**
 * Whether this slide's own content reads right-to-left.
 *
 * A slide's question/options can be English regardless of the app's UI
 * language: the deck's chrome is picked once at build time from that UI
 * language, but an English-subject check comes back from the model in English
 * no matter what. Laying it out right-to-left with the reading edge on the
 * right is asking the class to read it backwards — so direction follows the
 * slide's payload (its body and options, not its title, which is deliberately
 * bilingual and would always read as Arabic).
 *
 * One function for every block on the slide. SlideView and QuestionOptions
 * each derived this, and the hint and answer boxes beneath them used the
 * app's direction — an English answer right-aligned under a left-aligned
 * question.
 */
export function slideIsRTL(slide: { content: string; options?: string[] }, appIsRTL: boolean): boolean {
  return isEnglishSlideContent(slide.content, ...(slide.options ?? [])) ? false : appIsRTL;
}

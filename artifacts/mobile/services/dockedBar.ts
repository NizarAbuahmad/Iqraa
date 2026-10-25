/**
 * The generator screens' docked generate bar: its height, and how far a toast
 * must lift to clear it. Pure (no react-native), so `node --test` can load it;
 * `DockedAction` re-exports the height so existing imports keep working.
 */

/** What the docked bar adds to the bottom of the screen (excluding the safe-area inset). */
export const DOCKED_BAR_HEIGHT = 108;

/**
 * How far to lift a toast so the docked generate bar does not sit on it: the
 * bar's height while the bar is actually on screen, else 0. The bar is not on
 * screen on desktop (the action is inline under the preview), while the screen's
 * own `hidden` condition holds (an unsaved result's save bar, or an unsaved deck,
 * takes its spot), and while the soft keyboard is open (`DockedAction` hides it).
 */
export function toastLift(s: { isDesktop: boolean; barHidden: boolean; keyboardOpen: boolean }): number {
  return s.isDesktop || s.barHidden || s.keyboardOpen ? 0 : DOCKED_BAR_HEIGHT;
}

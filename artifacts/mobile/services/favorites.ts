/**
 * What the UI should show after a favourite toggle.
 *
 * Deliberately dependency-free (no react-native, no fetch, no storage) so the
 * rule "a lit star means the server agreed" is testable under `node:test`
 * rather than only observable by reloading the app.
 */

/** Toast keys, resolved through `i18n` by whoever renders them. */
export type FavoriteMessage =
  | 'addedToFavorites'
  | 'removedFromFavorites'
  | 'favoriteFailed';

export interface FavoriteFeedback {
  /** The star state to render now. */
  isFavorite: boolean;
  /** What to tell the teacher. */
  message: FavoriteMessage;
}

/** The result shape `workspace.toggleFavorite` reports. */
export interface FavoriteResult {
  ok: boolean;
  isFavorite: boolean;
}

/**
 * Reconcile the optimistic star with what actually persisted.
 *
 * On failure the star goes back to `previous` — not to the optimistic value,
 * and not to whatever `result.isFavorite` happens to hold, because a write
 * that did not land says nothing about the stored state.
 */
export function favoriteFeedback(
  previous: boolean,
  result: FavoriteResult,
): FavoriteFeedback {
  if (!result.ok) return { isFavorite: previous, message: 'favoriteFailed' };
  return {
    isFavorite: result.isFavorite,
    message: result.isFavorite ? 'addedToFavorites' : 'removedFromFavorites',
  };
}

import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { favoriteFeedback, type FavoriteMessage } from '@/services/favorites';
import { toggleFavorite } from '@/services/workspace';

/**
 * The favourite star for one saved material.
 *
 * Five screens had grown their own copy of this handler — the four generator
 * screens plus the workspace viewer — and every copy flipped the star, toasted
 * «أضفتها إلى المفضلة», and never asked whether the write had landed. Keeping
 * the rule in one place is the point: the star answers the tap immediately,
 * then settles on whatever `toggleFavorite` reports actually persisted, and
 * the message follows the settled state rather than the intent.
 *
 * A second tap is never dropped — "add it, then change my mind" is the whole
 * interaction. It is sequenced instead: only the newest tap's answer is
 * allowed to settle the star, so a slow first response cannot arrive after a
 * fast second one and undo it.
 *
 * `onMessage` gets a translation key, not a sentence — the caller owns the
 * toast and the language.
 */
export function useFavorite(
  savedId: string | undefined,
  onMessage: (key: FavoriteMessage) => void,
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) {
  const [favorited, setFavoritedState] = useState(false);
  /** The star's value as of *now*, readable inside an in-flight toggle. */
  const shown = useRef(false);
  /** Which tap owns the star. Anything older settles nothing. */
  const tap = useRef(0);
  const notify = useRef(onMessage);
  notify.current = onMessage;

  const setFavorited = useCallback((value: boolean) => {
    shown.current = value;
    setFavoritedState(value);
  }, []);

  const toggle = useCallback(async () => {
    if (!savedId) return;
    Haptics.impactAsync(style);
    const previous = shown.current;
    const next = !previous;
    const mine = ++tap.current;
    setFavorited(next); // optimistic — the star answers the tap immediately
    try {
      const feedback = favoriteFeedback(previous, await toggleFavorite(savedId, next));
      if (mine !== tap.current) return;
      setFavorited(feedback.isFavorite);
      notify.current(feedback.message);
    } catch {
      if (mine !== tap.current) return;
      setFavorited(previous);
      notify.current('favoriteFailed');
    }
  }, [savedId, setFavorited, style]);

  return { favorited, setFavorited, toggle };
}

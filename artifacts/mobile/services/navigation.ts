import { router } from 'expo-router';

/**
 * Back that always goes somewhere. A bare `router.back()` is a no-op when there
 * is no history — a refreshed web tab, a deep link, a shared URL — which left
 * every back arrow in the app dead on arrival there. Falls back to `/`, which
 * forwards each role to its own landing tab.
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

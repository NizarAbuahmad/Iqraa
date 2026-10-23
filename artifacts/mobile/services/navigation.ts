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

/**
 * Back to the public games hub (`/play`). `replace` alone left the hub twice in
 * the history (hub → game became hub → hub), so the browser's Back then seemed
 * to do nothing. With history, `dismissTo` pops to the hub already in it, or
 * pushes one if the game was reached from elsewhere; with none (a shared link,
 * a refreshed tab) there is nothing to pop, so it replaces.
 */
export function goToGames() {
  // Cast: '/play' isn't in the generated typed-routes union until the dev
  // server regenerates it, as elsewhere in this app (see app/_layout.tsx).
  if (router.canGoBack()) router.dismissTo('/play' as any);
  else router.replace('/play' as any);
}

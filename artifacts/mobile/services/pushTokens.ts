/**
 * Push token registration. Web is a silent no-op — same shape as every other
 * "no key" gap in this app (see CLAUDE.md), and matches the plan: web users
 * get in-app polling only, not push, for v1. Every failure here is
 * best-effort — a push-registration problem must never block sign-in.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiJson } from '@/services/apiClient';
import { threadIdFromNotificationData } from '@/services/notificationDeepLink';

// Without a handler, a notification that arrives while the app is
// foregrounded is silently swallowed rather than shown. Skipped on web —
// expo-notifications' web support needs its own service-worker setup, which
// this app doesn't have (see file header: web is push-free for v1).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await apiJson('/messaging/device-tokens', {
      method: 'POST',
      body: JSON.stringify({ expoPushToken, platform: Platform.OS }),
    });
  } catch {
    // Best-effort — see file header.
  }
}

function navigateFromNotificationResponse(response: Notifications.NotificationResponse): void {
  const threadId = threadIdFromNotificationData(response.notification.request.content.data);
  if (threadId) router.push(`/messaging/${threadId}`);
}

/**
 * Whether this app launch has already consumed its cold-start tap.
 *
 * Module scope, not per-registration: `getLastNotificationResponseAsync`
 * keeps answering with the same tap for the life of the process, so a second
 * registration would replay it. Sign out and back in a week later and the app
 * would drag you into a thread you opened once, on a notification long gone.
 * Once per launch is the only reading of "last response" that isn't a bug.
 */
let coldStartTapHandled = false;

/**
 * Tapping a delivered push must open the thread it is about, not just launch
 * the app to whatever the boot flow would have shown anyway. Covers both a tap
 * while the app is running and one that cold-starts it — the latter via
 * `getLastNotificationResponseAsync`, since that tap happened before any
 * listener existed to catch it. Skipped on web — see file header.
 *
 * Call this only while signed in. `/messaging/*` is not a public route
 * (services/routeGating.ts), so a tap handled while signed out is a tap that
 * route gating bounces to the login screen, losing the thread it named.
 */
export function registerNotificationTapHandler(): () => void {
  if (Platform.OS === 'web') return () => {};

  if (!coldStartTapHandled) {
    coldStartTapHandled = true;
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) navigateFromNotificationResponse(response);
    });
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(
    navigateFromNotificationResponse,
  );
  return () => subscription.remove();
}

export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await apiJson(`/messaging/device-tokens/${encodeURIComponent(expoPushToken)}`, { method: 'DELETE' });
  } catch {
    // Best-effort — see file header.
  }
}

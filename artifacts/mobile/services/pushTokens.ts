/**
 * Push token registration. Web is a silent no-op — same shape as every other
 * "no key" gap in this app (see CLAUDE.md), and matches the plan: web users
 * get in-app polling only, not push, for v1. Every failure here is
 * best-effort — a push-registration problem must never block sign-in.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiJson } from '@/services/apiClient';

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

export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await apiJson(`/messaging/device-tokens/${encodeURIComponent(expoPushToken)}`, { method: 'DELETE' });
  } catch {
    // Best-effort — see file header.
  }
}

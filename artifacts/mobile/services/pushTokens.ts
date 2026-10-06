/**
 * Push token registration, Android notification channels, the permission
 * prompt and the app-icon badge. Web is a silent no-op — same shape as every
 * other "no key" gap in this app (see CLAUDE.md), and matches the plan: web
 * users get in-app polling only, not push, for v1. Every failure here is
 * best-effort — a push problem must never block sign-in or a send.
 *
 * Signing in no longer asks for permission. It used to, on every sign-in,
 * before the user had any reason to say yes — and Android 13+ stops showing
 * the OS prompt after a refusal or two, so a cold "no" was usually final.
 * Sign-in now only registers a token when permission is already granted;
 * the prompt comes from `askForPushPermission`, after a moment where push
 * plainly helps (see pushPolicy.ts for when).
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { routeFromNotificationData } from '@/services/notificationDeepLink';
import { channelsFor, pushPromptDecision } from '@/services/pushPolicy';

/** Set once our explanation has been shown on this device, accepted or not. */
const EXPLAINED_KEY = 'push.permissionExplained';

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
      // A chat push carries the recipient's unread total as its badge
      // (routes/messaging.ts); let it through while the app is open too.
      shouldSetBadge: true,
    }),
  });
}

let channelsReady: Promise<unknown> = Promise.resolve();

/**
 * Creates (or renames, on a language change) one Android channel per kind of
 * push — see PUSH_CHANNELS. Safe to call repeatedly: Android keeps the
 * user's own choices for a channel and only updates its name/description.
 * Creating a channel does not show the permission prompt on this app's
 * target SDK; it does have to exist before the prompt is shown, so
 * `askForPushPermission` waits for it.
 */
export function ensureNotificationChannels(lang: 'ar' | 'en', isAdmin: boolean): Promise<unknown> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelsReady = Promise.all(
    channelsFor(isAdmin).map(c =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: lang === 'ar' ? c.nameAr : c.nameEn,
        description: lang === 'ar' ? c.descriptionAr : c.descriptionEn,
        importance:
          c.importance === 'high'
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
      }),
    ),
  ).catch(err => console.warn('[push] creating notification channels failed', err));
  return channelsReady;
}

async function sendTokenToServer(): Promise<void> {
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  await apiJson('/messaging/device-tokens', {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform: Platform.OS }),
  });
}

/**
 * Called on sign-in. Registers this device only if the user has already
 * granted permission — never prompts (see file header).
 */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') await sendTokenToServer();
  } catch (err) {
    // Best-effort — see file header. Logged, not silent: a broken permission
    // grant or missing FCM config used to look identical to a working setup.
    console.warn('[push] registerPushToken failed', err);
  }
}

export type PushPermissionState = 'granted' | 'off';

/** For the settings row. Null on web, which has no push to turn on. */
export async function getPushPermissionState(): Promise<PushPermissionState | null> {
  if (Platform.OS === 'web') return null;
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted' ? 'granted' : 'off';
  } catch {
    return 'off';
  }
}

export interface PushAskCopy {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

/** The explanation shown before the OS prompt, in the app's language. */
export function pushAskCopy(
  t: (key: 'pushAskTitle' | 'pushAskBody' | 'pushAskConfirm' | 'pushAskLater') => string,
): PushAskCopy {
  return {
    title: t('pushAskTitle'),
    message: t('pushAskBody'),
    confirmLabel: t('pushAskConfirm'),
    cancelLabel: t('pushAskLater'),
  };
}

/**
 * Offer push at a moment where it plainly helps. Shows our own explanation
 * first, and only on "yes" the OS prompt; see `pushPromptDecision` for when
 * it stays quiet. `explicit` is the settings row — the user asked — which
 * may also open system settings when Android will no longer prompt.
 */
export async function askForPushPermission(opts: { explicit: boolean; copy: PushAskCopy }): Promise<PushPermissionState | null> {
  if (Platform.OS === 'web') return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    const decision = pushPromptDecision({
      web: false,
      status: current.status,
      canAskAgain: current.canAskAgain,
      askedBefore: (await AsyncStorage.getItem(EXPLAINED_KEY)) === 'true',
      explicit: opts.explicit,
    });

    if (decision === 'register') {
      await sendTokenToServer();
      return 'granted';
    }
    if (decision === 'open-settings') {
      await Linking.openSettings();
      return 'off';
    }
    if (decision === 'skip') return 'off';

    await AsyncStorage.setItem(EXPLAINED_KEY, 'true');
    const yes = await confirm(opts.copy);
    if (!yes) return 'off';

    await channelsReady;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return 'off';
    await sendTokenToServer();
    return 'granted';
  } catch (err) {
    console.warn('[push] askForPushPermission failed', err);
    return 'off';
  }
}

/**
 * Mirrors the unread-message count onto the app icon, and clears it on sign
 * out. iOS shows the number; on Android it depends on the launcher (a
 * number on Samsung and some others, a dot elsewhere).
 */
export function syncAppBadge(count: number): void {
  if (Platform.OS === 'web') return;
  Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
}

function navigateFromNotificationResponse(response: Notifications.NotificationResponse): void {
  const route = routeFromNotificationData(response.notification.request.content.data);
  if (route) router.push(route as never);
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
  // The count belongs to the account leaving; don't leave it on the icon.
  syncAppBadge(0);
  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await apiJson(`/messaging/device-tokens/${encodeURIComponent(expoPushToken)}`, { method: 'DELETE' });
  } catch (err) {
    // Best-effort — see file header.
    console.warn('[push] unregisterPushToken failed', err);
  }
}

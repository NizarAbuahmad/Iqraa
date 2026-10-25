import { useCallback } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createBarStyleRequests } from '@/services/statusBarRequests';

const requests = createBarStyleRequests(style => StatusBar.setBarStyle(style));

/**
 * Light status-bar icons while this screen is focused. For a screen whose dark
 * band or accent header sits under the status bar: the system default is dark
 * icons in light mode, which vanish on it. Screens hold a request rather than
 * set the style, so pushing one dark screen over another keeps the icons light
 * (`services/statusBarRequests.ts` says why). `enabled` is for a screen whose
 * top is dark only some of the time (the library, under the status bar as a
 * page but not as a tab). No-op on web.
 */
export function useLightStatusBar(enabled = true): void {
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web' || !enabled) return;
    return requests.request();
  }, [enabled]));
}

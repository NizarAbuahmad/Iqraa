/**
 * Opening a URL outside the app — in-app browser on native, new tab on web.
 *
 * This dance lived twice inside `geogebra.ts`, in two copies that had already
 * drifted apart (one guarded `typeof window` in the same condition, the other
 * in a nested `if` that fell through to WebBrowser on a web build with no
 * window). A third copy was about to land, so it moved here instead.
 *
 * `window.open` on web, never `Linking.openURL`: on react-native-web the
 * latter replaces the running app in the same tab, which throws away whatever
 * the teacher had open in a generator screen. `WebBrowser` on native so they
 * come back with a back gesture rather than an app switch.
 */
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export async function openExternal(url: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      enableBarCollapsing: true,
      showTitle: true,
    });
  } catch {
    await Linking.openURL(url);
  }
}

/**
 * GeoGebra integration — Phase 1: open Graphing in the system / in-app browser.
 * Math teachers only (call sites should not surface this for chemistry).
 */

import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/** Official GeoGebra Graphing Calculator (best default for Grade 10). */
export const GEOGEBRA_GRAPHING_URL = 'https://www.geogebra.org/graphing';

export const GEOGEBRA_HUB_URL = 'https://www.geogebra.org/';

/**
 * Open GeoGebra Graphing. Uses in-app browser on native; falls back to Linking.
 */
export async function openGeogebraGraphing(): Promise<void> {
  const url = GEOGEBRA_GRAPHING_URL;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
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

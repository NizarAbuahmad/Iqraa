/**
 * GeoGebra integration — Phase 1: open Graphing in the system / in-app browser.
 * Math teachers only (call sites should not surface this for chemistry).
 */

import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { GEOGEBRA_GRAPHING_URL, geogebraCommandUrl } from './classMedia';

/** Official GeoGebra Graphing Calculator (best default for Grade 10). */
export { GEOGEBRA_GRAPHING_URL, geogebraCommandUrl };

export const GEOGEBRA_HUB_URL = 'https://www.geogebra.org/';

/** Open GeoGebra with the given commands preloaded. */
export async function openGeogebraWithCommands(commands: string[]): Promise<void> {
  const url = geogebraCommandUrl(commands);
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

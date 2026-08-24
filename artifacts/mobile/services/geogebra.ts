/**
 * GeoGebra integration — Phase 1: open Graphing in the system / in-app browser.
 * Math teachers only (call sites should not surface this for chemistry).
 */

import { GEOGEBRA_GRAPHING_URL, geogebraCommandUrl } from './classMedia';
import { openExternal } from './externalLinks.ts';

/** Official GeoGebra Graphing Calculator (best default for Grade 10). */
export { GEOGEBRA_GRAPHING_URL, geogebraCommandUrl };

export const GEOGEBRA_HUB_URL = 'https://www.geogebra.org/';

/** Open GeoGebra with the given commands preloaded. */
export function openGeogebraWithCommands(commands: string[]): Promise<void> {
  return openExternal(geogebraCommandUrl(commands));
}

/**
 * Open GeoGebra Graphing. Uses in-app browser on native; falls back to Linking.
 */
export function openGeogebraGraphing(): Promise<void> {
  return openExternal(GEOGEBRA_GRAPHING_URL);
}

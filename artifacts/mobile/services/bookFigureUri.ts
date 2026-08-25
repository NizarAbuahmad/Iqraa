/**
 * Turns a `BookFigure` into a URI the render surfaces can actually load.
 *
 * Kept apart from `bookFigures.ts` on purpose: this module imports
 * `react-native`, and `bookFigures.ts` is pulled into `node --test` suites
 * that have no React Native runtime. Splitting the lookup (pure, testable)
 * from the asset handle (platform) keeps those suites runnable.
 *
 * The figures are bundled rather than served, so they need no network and no
 * API: `require()`d by `bookFigureAssets.ts` at build time, resolved to a URI
 * here. On web that is a URL under the static export; on native, the packaged
 * asset. Either way `<Image>`, the print HTML and the PPTX export all take a
 * plain string, which is why nothing downstream had to learn about figures.
 */
import { Image } from 'react-native';

import { BOOK_FIGURE_ASSETS } from './bookFigureAssets';
import type { BookFigure } from './bookFigures';

/**
 * `null` when the figure was never bundled — a figure extracted after the last
 * `gen_book_figure_assets.mjs` run, say. Callers drop the slide rather than
 * render a broken image; the drift test is what stops it reaching a build.
 */
export function bookFigureUri(figure: BookFigure): string | null {
  const asset = BOOK_FIGURE_ASSETS[`${figure.sourceId}/${figure.file}`];
  if (asset === undefined) return null;
  // Metro's web output makes the asset a module that already exports its URL
  // (`/assets/__knowledge-base/.../p021.<hash>.png`); only native hands back
  // an id needing the registry. Reading the object directly rather than
  // relying on resolveAssetSource to pass it through keeps the web path — the
  // one that actually ships — independent of that function's behaviour.
  if (typeof asset === 'object') return asset.uri || null;
  return Image.resolveAssetSource(asset)?.uri ?? null;
}

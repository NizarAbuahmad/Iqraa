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
import { figuresForLesson, type BookFigure } from './bookFigures';
import { lessonIdsForObjectiveIds } from '@workspace/curriculum';
import { bookFigureCaption } from './lessonSlides';
import { EXPORT_FIGURE_MAX, type BookFigureRef } from './exportHtml.ts';

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

/**
 * A lesson's figures, ready for `buildWorksheetHTML` / `buildQuizHTML` /
 * `buildLessonPlanHTML` / `buildActivityHTML`'s reference-appendix param.
 *
 * The one place that turns `figuresForLesson()` into `BookFigureRef[]` — the
 * same three-step lookup `lessonSlides.ts` does inline for slides
 * (`figuresForLesson` → `bookFigureUri` → `bookFigureCaption`), pulled out so
 * the four document exports do not each grow their own copy. A figure that
 * was extracted after the last `gen_book_figure_assets.mjs` run resolves to no
 * URI and is dropped here, same as it is on a slide.
 */
export function bookFigureRefsForLesson(
  kbLessonId: string | null | undefined,
  isAr: boolean,
): BookFigureRef[] {
  const out: BookFigureRef[] = [];
  for (const figure of figuresForLesson(kbLessonId)) {
    const uri = bookFigureUri(figure);
    if (!uri) continue;
    out.push({ uri, page: figure.pdfPage, caption: bookFigureCaption(figure, isAr) });
  }
  return out;
}

/**
 * The same, for several lessons at once — an evaluation is scoped by
 * objectives that can span more than one, unlike every other figure caller in
 * the app, which holds exactly one lesson.
 *
 * Round-robins across the lessons instead of concatenating them, because the
 * cap is what a reader can look at rather than what exists: a two-lesson exam
 * whose first lesson carries 25 figures (the circle-chords lesson really
 * does) would otherwise show six from lesson one and nothing from lesson two,
 * which reads as "the second half of this exam has no diagrams" rather than
 * "the cap was reached".
 *
 */
export function bookFigureRefsForLessons(
  kbLessonIds: readonly string[],
  isAr: boolean,
  max = EXPORT_FIGURE_MAX,
): BookFigureRef[] {
  const perLesson = kbLessonIds
    .map(id => bookFigureRefsForLesson(id, isAr))
    .filter(refs => refs.length > 0);
  if (perLesson.length === 0) return [];

  const out: BookFigureRef[] = [];
  const deepest = Math.max(...perLesson.map(r => r.length));
  for (let i = 0; i < deepest && out.length < max; i++) {
    for (const refs of perLesson) {
      if (out.length >= max) break;
      const ref = refs[i];
      if (ref) out.push(ref);
    }
  }
  return out;
}

/**
 * The same, starting from the objective ids an evaluation is scoped by — the
 * shape the teacher's review screen holds, since an exam has objectives and
 * never a lesson (see `lessonIdsForObjectiveIds`).
 */
export function bookFigureRefsForObjectives(
  objectiveIds: readonly string[] | null | undefined,
  isAr: boolean,
  max = EXPORT_FIGURE_MAX,
): BookFigureRef[] {
  return bookFigureRefsForLessons(lessonIdsForObjectiveIds(objectiveIds), isAr, max);
}

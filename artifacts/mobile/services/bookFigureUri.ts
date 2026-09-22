/**
 * Turns a `BookFigure` into a URI the render surfaces can actually load.
 *
 * Kept apart from `bookFigures.ts` for what used to be a hard reason — this
 * module imported `react-native` for `Image.resolveAssetSource`, and
 * `bookFigures.ts` is pulled into `node --test` suites with no React Native
 * runtime. Serving the figures removed that import, so the split is now only
 * about layering: the lesson→figure lookup stays independent of where the
 * bytes live.
 *
 * The figures are served from R2's anonymous-read bucket, not bundled. They
 * were bundled until 2026-09-22: 2,572 static `require()`s put every reachable
 * PNG — 425 MB on disk — into the binary, the store `.aab` reached 267 MB, and
 * Play installs were killed on the first launches. Serving them costs a
 * network fetch per figure and takes essentially all of that weight out.
 *
 * `<Image>`, the print HTML and the PPTX export all take a plain string, so
 * nothing downstream changed — the string is just an https URL now. Two
 * consequences that are real: a figure needs connectivity the first time it is
 * shown (it was offline-safe before), and the PPTX export fetches it over the
 * wire, which it already tolerates failing (see `fetchAsDataUrl`).
 */
import { BOOK_FIGURE_KEYS } from './bookFigureAssets';
import { figuresForLesson, type BookFigure } from './bookFigures';
import { lessonIdsForObjectiveIds } from '@workspace/curriculum';
import { bookFigureCaption } from './lessonSlides';
import { EXPORT_FIGURE_MAX, type BookFigureRef } from './exportHtml.ts';

/**
 * Where the figures are served from: `iqraa-public`'s anonymous-read origin,
 * the same bucket `docs/adding-a-book.md` describes and that already hosts
 * book PDFs and avatars. A constant rather than an env var on purpose — the
 * public bucket's URL is already pasted verbatim into `catalog.ts` rows, and
 * an unset variable at build time would silently ship an app whose every
 * figure is a broken image.
 */
export const FIGURE_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/figures';

/**
 * `null` when the figure is not one the app knows about — a figure extracted
 * after the last `gen_book_figure_assets.mjs` run, say. Callers drop the slide
 * rather than render a broken image; the drift test is what stops it reaching
 * a build.
 *
 * Checked against the generated key set rather than just building a URL from
 * the figure, so an unknown figure is still refused locally instead of
 * becoming a 404 the UI would have to discover by trying to render it.
 */
export function bookFigureUri(figure: BookFigure): string | null {
  const key = `${figure.sourceId}/${figure.file}`;
  if (!BOOK_FIGURE_KEYS.has(key)) return null;
  return `${FIGURE_BASE_URL}/${key}`;
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

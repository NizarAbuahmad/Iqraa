import { useCallback, useState } from 'react';
import type { BookFigureRef } from '@/services/exportHtml';
import { bookFigureRefsForLesson } from '@/services/bookFigureUri';
import { resolveGeneratorGrounding } from '@/services/kbContext';
import { copyToClipboard, exportAsPDF, exportAsWord, shareAsText } from '@/services/share';
import type { Lang, TranslationKey } from '@/services/i18n';

export type GeneratorExportMeta = { subject: string; grade: string; duration?: number };

/**
 * Share/copy/PDF/Word/Slides export for one generated result.
 *
 * Lesson Plan, Worksheet, Quiz and Activity had each grown byte-for-byte
 * identical `getExportFigures` and structurally identical `handlePDF`/
 * `handleWord`/`handleSlides` — the same shape of risk `GeneratorResultActions`
 * fixed for the Save/Favourite/Export row: a fix (or a bug) in one copy has no
 * reason to reach the other three, and nothing before this caught that it
 * hadn't. The only real per-type difference is which `buildXHTML`/
 * `formatXText`/`buildXSlidesHTML` function to call — callers pass those in.
 *
 * Figures are re-resolved from `topic` at export time rather than carried in
 * state, matching the pattern already used elsewhere on these screens; the
 * appendix/panel is simply empty for an ungrounded topic.
 */
export function useGeneratorExport<TResult, TMeta extends GeneratorExportMeta>(config: {
  result: TResult | null;
  topic: string;
  lang: Lang;
  getTitle: () => string;
  getMeta: () => TMeta;
  formatText: (result: TResult, title: string, meta: TMeta, isAr: boolean) => string;
  buildHTML: (result: TResult, title: string, meta: TMeta, isAr: boolean, figures: readonly BookFigureRef[]) => string;
  buildSlidesHTML: (result: TResult, title: string, meta: TMeta, isAr: boolean) => string;
  onError: (key: TranslationKey) => void;
  onCopied: (key: TranslationKey) => void;
}) {
  const { result, topic, lang, getTitle, getMeta, formatText, buildHTML, buildSlidesHTML, onError, onCopied } = config;
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const isAr = lang === 'ar';

  const getExportFigures = useCallback((): BookFigureRef[] => {
    return bookFigureRefsForLesson(resolveGeneratorGrounding(topic.trim(), lang).lesson?.id, isAr);
  }, [topic, lang, isAr]);

  const filenameOf = (title: string, suffix = '') =>
    (title + suffix).replace(suffix ? /[^\w\s-]/g : /[^\w\s]/g, '').trim();

  const handleShareText = useCallback(async () => {
    if (!result) return;
    const title = getTitle();
    await shareAsText(formatText(result, title, getMeta(), isAr), title);
  }, [result, getTitle, getMeta, formatText, isAr]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await copyToClipboard(formatText(result, getTitle(), getMeta(), isAr));
    onCopied('copiedToClipboard');
  }, [result, getTitle, getMeta, formatText, isAr, onCopied]);

  const handlePDF = useCallback(async () => {
    if (!result) return;
    setLoadingPDF(true);
    try {
      const title = getTitle();
      const html = buildHTML(result, title, getMeta(), isAr, getExportFigures());
      await exportAsPDF(html, filenameOf(title));
    } catch {
      onError('generationFailed');
    } finally {
      setLoadingPDF(false);
    }
  }, [result, getTitle, getMeta, buildHTML, isAr, getExportFigures, onError]);

  const handleWord = useCallback(async () => {
    if (!result) return;
    setLoadingWord(true);
    try {
      const title = getTitle();
      const text = formatText(result, title, getMeta(), isAr);
      await exportAsWord(text, filenameOf(title), isAr);
    } catch {
      onError('generationFailed');
    } finally {
      setLoadingWord(false);
    }
  }, [result, getTitle, getMeta, formatText, isAr, onError]);

  const handleSlides = useCallback(async () => {
    if (!result) return;
    setLoadingSlides(true);
    try {
      const title = getTitle();
      const html = buildSlidesHTML(result, title, getMeta(), isAr);
      await exportAsPDF(html, filenameOf(title, '-slides'));
    } catch {
      onError('generationFailed');
    } finally {
      setLoadingSlides(false);
    }
  }, [result, getTitle, getMeta, buildSlidesHTML, isAr, onError]);

  return {
    getExportFigures,
    handleShareText,
    handleCopy,
    handlePDF,
    handleWord,
    handleSlides,
    loadingPDF,
    loadingWord,
    loadingSlides,
  };
}

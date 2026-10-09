/**
 * The file name an export is saved under, built from the material's title.
 *
 * The old call sites each stripped `/[^\w\s]/g`, and JS `\w` is ASCII-only, so
 * an Arabic title lost every letter: «خطة درس: الأعداد (10)» became `10`, and a
 * title with no digits became an empty name (`.docx`). Letters and digits of
 * any script are kept; only what a file system rejects is dropped.
 */
export function exportFilename(title: string, suffix = '', fallback = 'iqra'): string {
  const name = (title + suffix)
    // `[^\p{L}\p{N}\p{M}\s-]` rather than listing illegal characters: it also
    // removes emoji and the bidi marks the formatters add around Latin terms.
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return name || fallback;
}

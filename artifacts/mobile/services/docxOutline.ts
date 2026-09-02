/**
 * Which structural role each line of an exported plain-text material plays.
 *
 * Split out of `share.ts` because that file imports `react-native` at module
 * scope, which `node:test` cannot parse — the same reason `deckSlidesHtml.ts`
 * was split out of the PDF path. The Word export's outline was previously
 * decided inline and could only be checked by unzipping a generated `.docx`
 * by hand.
 *
 * **Why not letter case.** The old rule was `line === line.toUpperCase()`.
 * Arabic is caseless, so that predicate is `true` for every Arabic line, and
 * the Word export promoted essentially the whole document to Heading 2 — a
 * 145-character paragraph of teacher instructions, the assessment notes, the
 * homework, and the "أُنشئ بواسطة اقرأ" footer all rendered as bold headings.
 * In an Arabic-first product a case heuristic cannot work; it silently did
 * nothing useful in English either, since these formatters never upper-case
 * their section labels.
 *
 * The formatters already mark headings unambiguously: `H(label)` writes the
 * label and then a `─` rule as long as it. That structural signal is what is
 * read here, so the outline follows what the text actually declares.
 */

export type DocLineKind =
  /** Nothing on the line. */
  | 'blank'
  /** A `═` separator or the `─` underline belonging to the heading above. */
  | 'rule'
  /** The material's title — always the first line. */
  | 'title'
  /** A section label, recognised by the rule written beneath it. */
  | 'heading'
  /** A `•`/`○` list item. */
  | 'bullet'
  /** Ordinary prose. */
  | 'body';

/** A separator or underline: `═══…` or `───…`. */
const RULE = /^[═─]{5,}$/;
/** Only a dash rule underlines a heading; `═` separates sections instead. */
const HEADING_UNDERLINE = /^─{5,}$/;

export function classifyDocLines(lines: readonly string[]): DocLineKind[] {
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return 'blank';
    if (RULE.test(trimmed)) return 'rule';
    if (i === 0) return 'title';
    if (/^[•○]/.test(trimmed)) return 'bullet';
    // Look ahead, not at the line's own characters: the underline is the
    // formatter's own declaration that this line is a section label.
    return HEADING_UNDERLINE.test((lines[i + 1] ?? '').trim()) ? 'heading' : 'body';
  });
}

/** The text a line contributes, with its bullet marker removed. */
export function docLineText(line: string, kind: DocLineKind): string {
  const trimmed = line.trim();
  return kind === 'bullet' ? trimmed.replace(/^[•○]\s*/, '') : trimmed;
}

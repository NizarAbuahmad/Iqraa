/**
 * Which edition of a book the "download" chip actually opens.
 *
 * The line under the chips used to print the book's `academicYear`, but that
 * records the year the catalog was *built from* (often a PDF a teacher
 * supplied), not the year of the file the link serves. NCCD reprints and
 * re-folders yearly, so the two drift: a 2024-2025 row linking the
 * "2026-2027 book" folder told teachers the wrong edition.
 *
 * The only reliable evidence of a linked file's edition is the link itself, and
 * only some say it ("…/2026-2027%20book/…"). Folders like `/Math/2025/` could
 * be a publication year or a school year, so they give no answer — and no
 * answer is better than a confident wrong one.
 */
export function linkedEditionYear(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = /(\d{4}-\d{4})(?:%20|\s|\+)book\b/i.exec(url);
  return m ? m[1] : undefined;
}

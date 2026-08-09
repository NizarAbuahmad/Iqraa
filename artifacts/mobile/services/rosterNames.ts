/**
 * Turning a pasted register into student names.
 *
 * Kept separate from `roster.ts` so it stays free of the API client: this is
 * pure text handling, it is the step where a teacher's list becomes permanent
 * records, and it deserves to be testable on its own.
 */

/**
 * Split pasted text into student names — one per line, or comma-separated.
 *
 * Teachers have their register in a WhatsApp message or a spreadsheet column;
 * typing thirty names into thirty inputs is the difference between using the
 * feature and abandoning it halfway. Blank lines and stray numbering
 * ("1. ليان", "٣- سارة") are stripped, and duplicates within one paste are
 * collapsed — a doubled line would otherwise create two students with the same
 * name, splitting that child's results across both with nothing to show for it.
 */
export function parseStudentNames(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/[\n,،]/)
    .map(part => part.replace(/^\s*[\d٠-٩]+[.)\-\s]+/, '').trim())
    .filter(name => {
      if (!name) return false;
      const key = name.replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

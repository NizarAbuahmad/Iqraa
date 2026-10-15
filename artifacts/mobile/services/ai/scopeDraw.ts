/**
 * Draw a question from a lesson, and move on when that lesson has nothing left.
 *
 * The offline generators build a question from ONE lesson's bank at a time. For
 * a wide scope each question slot names a lesson (`planCoverage`); when that
 * lesson's bank is spent for the question type being drawn, the share goes to
 * the next lesson in the scope instead of ending the paper — the same rule the
 * single-lesson generators already follow for a spent type (`quizCount.test.ts`).
 *
 * "Spent" is remembered per (lesson, bank key), so a lesson out of
 * multiple-choice can still write true/false. The error type is injected
 * because `BankSpentError` is private to generators.ts.
 *
 * Free of react-native so `node --test` can load it.
 */
export class ScopeDrawer<L extends { id: string }> {
  private readonly spentFor = new Set<string>();
  private readonly slots: readonly L[];
  private readonly all: readonly L[];
  private readonly spent: { isSpent: (e: unknown) => boolean; error: () => unknown };

  // Explicit fields, not parameter properties: node's strip-only TypeScript
  // mode (the mobile test runner) rejects parameter properties.
  constructor(
    slots: readonly L[],
    all: readonly L[],
    spent: { isSpent: (e: unknown) => boolean; error: () => unknown },
  ) {
    if (slots.length === 0) throw new Error('ScopeDrawer: no slots');
    this.slots = slots;
    this.all = all;
    this.spent = spent;
  }

  /** The lesson question `slot` belongs to; slots wrap when a paper is longer than its plan. */
  lessonAt(slot: number): L {
    const n = this.slots.length;
    return this.slots[((slot % n) + n) % n]!;
  }

  draw<T>(slot: number, bankKey: string, make: (lesson: L) => T): { value: T; lesson: L } {
    const first = this.lessonAt(slot);
    const start = Math.max(0, this.all.findIndex(l => l.id === first.id));
    for (let k = 0; k < this.all.length; k++) {
      const lesson = this.all[(start + k) % this.all.length]!;
      const key = `${lesson.id}\u0000${bankKey}`;
      if (this.spentFor.has(key)) continue;
      try {
        return { value: make(lesson), lesson };
      } catch (e) {
        if (!this.spent.isSpent(e)) throw e;
        this.spentFor.add(key);
      }
    }
    throw this.spent.error();
  }
}

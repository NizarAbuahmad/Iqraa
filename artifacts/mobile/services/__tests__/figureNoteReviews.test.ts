/**
 * Writing a reviewer's verdicts into the notes files.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteReviews.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyFigureReviews, serializeNotesFile, type FigureReview } from '../figureNoteReviews.ts';
import type { NotesFile } from '../bookFigureNotes.ts';

const S1 = 'phys-s1-student-book';
const FIGS = new Map<string, string[]>([[S1, ['p010-v2.png', 'p011.png', 'p012.png']]]);
const draft = (tag: string) => ({
  status: 'draft' as const,
  ar: { caption: `مسودة ${tag}`, teacher: `ملاحظة ${tag}` },
  en: { caption: `Draft ${tag}`, teacher: `Note ${tag}` },
});
const FILES: NotesFile[] = [{ sourceId: S1, notes: { 'p011.png': draft('b'), 'p010-v2.png': draft('a') } }];

const review = (over: Partial<FigureReview>): FigureReview => ({
  sourceId: S1, file: 'p011.png', verdict: 'approve',
  ar: { caption: 'شرح معدّل', teacher: 'ملاحظة معدّلة' },
  en: { caption: 'Edited caption', teacher: 'Edited note' },
  reviewer: 'معلم الفيزياء', reviewedAt: '2026-12-01',
  ...over,
});

describe('applyFigureReviews', () => {
  it('approves with the reviewer\'s text, name and day', () => {
    const { files, changed, refused } = applyFigureReviews(FILES, FIGS, [review({})]);
    assert.deepEqual(refused, []);
    assert.equal(changed, 1);
    assert.deepEqual(files[0]!.notes['p011.png'], {
      status: 'approved',
      ar: { caption: 'شرح معدّل', teacher: 'ملاحظة معدّلة' },
      en: { caption: 'Edited caption', teacher: 'Edited note' },
      reviewedBy: 'معلم الفيزياء', reviewedAt: '2026-12-01',
    });
    // untouched entries stay as they were
    assert.deepEqual(files[0]!.notes['p010-v2.png'], draft('a'));
  });

  it('records a needs-fix with its comment', () => {
    const { files } = applyFigureReviews(FILES, FIGS, [review({ verdict: 'needs-fix', comment: 'المصطلح خطأ' })]);
    const e = files[0]!.notes['p011.png']!;
    assert.equal(e.status, 'needs-fix');
    assert.equal(e.comment, 'المصطلح خطأ');
    assert.equal(e.reviewedBy, 'معلم الفيزياء');
  });

  it('orders entries as the book\'s figure list does, so output is stable', () => {
    const { files } = applyFigureReviews(FILES, FIGS, [review({})]);
    assert.deepEqual(Object.keys(files[0]!.notes), ['p010-v2.png', 'p011.png']);
  });

  it('accepts a figure that had no entry yet', () => {
    const { files, refused } = applyFigureReviews(FILES, FIGS, [review({ file: 'p012.png' })]);
    assert.deepEqual(refused, []);
    assert.equal(files[0]!.notes['p012.png']!.status, 'approved');
  });

  it('refuses a figure not in the book, a book with no notes file, and a duplicate', () => {
    for (const bad of [
      [review({ file: 'p999.png' })],
      [review({ sourceId: 'chem-s1-student-book' })],
      [review({}), review({})],
    ]) {
      const out = applyFigureReviews(FILES, FIGS, bad);
      assert.ok(out.refused.length > 0, JSON.stringify(bad.map(r => r.file)));
    }
  });

  it('refuses an approval with an empty field, no reviewer, a bad day or a long caption', () => {
    for (const bad of [
      review({ en: { caption: '', teacher: 'x' } }),
      review({ ar: { caption: 'x', teacher: '  ' } }),
      review({ reviewer: '' }),
      review({ reviewedAt: '2026-13-01' }),
      review({ ar: { caption: 'ب'.repeat(141), teacher: 'x' } }),
      review({ ar: { caption: 'في الصورة متجه', teacher: 'x' } }),
    ]) {
      assert.ok(applyFigureReviews(FILES, FIGS, [bad]).refused.length > 0, JSON.stringify(bad));
    }
  });

  it('refuses an approval whose text still starts with the drafters\' [تحقّق] marker', () => {
    const out = applyFigureReviews(FILES, FIGS, [review({ ar: { caption: 'شرح', teacher: '[تحقّق] ملاحظة' } })]);
    assert.ok(out.refused.some(x => /reviewer marker/.test(x)), JSON.stringify(out.refused));
    assert.equal(out.changed, 0);
  });

  it('a needs-fix with empty text keeps the draft\'s text and records the comment', () => {
    const empty = { caption: '', teacher: '' };
    const { files, refused } = applyFigureReviews(FILES, FIGS, [
      review({ verdict: 'needs-fix', ar: empty, en: { caption: 'Edited', teacher: '' }, comment: 'أعد الصياغة' }),
    ]);
    assert.deepEqual(refused, []);
    const e = files[0]!.notes['p011.png']!;
    assert.equal(e.status, 'needs-fix');
    assert.deepEqual(e.ar, { caption: 'مسودة b', teacher: 'ملاحظة b' });
    assert.deepEqual(e.en, { caption: 'Edited', teacher: 'Note b' });
    assert.equal(e.comment, 'أعد الصياغة');
  });

  it('writes nothing at all when any review is refused', () => {
    const out = applyFigureReviews(FILES, FIGS, [review({}), review({ file: 'p999.png' })]);
    assert.ok(out.refused.length > 0);
    assert.equal(out.changed, 0);
    assert.deepEqual(out.files, FILES);
  });

  it('is idempotent: applying the same export twice changes nothing the second time', () => {
    const reviews = [review({}), review({ file: 'p010-v2.png', verdict: 'needs-fix', comment: 'c' })];
    const once = applyFigureReviews(FILES, FIGS, reviews);
    const twice = applyFigureReviews(once.files, FIGS, reviews);
    assert.equal(twice.changed, 0);
    assert.equal(serializeNotesFile(twice.files[0]!), serializeNotesFile(once.files[0]!));
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(FILES);
    applyFigureReviews(FILES, FIGS, [review({})]);
    assert.equal(JSON.stringify(FILES), before);
  });
});

describe('serializeNotesFile', () => {
  it('is two-space JSON with a trailing newline, Arabic kept as characters', () => {
    const text = serializeNotesFile(FILES[0]!);
    assert.ok(text.endsWith('}\n'));
    assert.match(text, /مسودة/);
    assert.deepEqual(JSON.parse(text), FILES[0]);
  });
});

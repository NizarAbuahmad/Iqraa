# English corner: Grade 2 reading — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grade 2 reading in the English corner: the three Grade 1 word activities on the Grade 2 words, plus «Read the sentence», all hidden until a teacher signs the unit's page of a printed form.

**Architecture:** The Grade 1 reading engine (`lib/curriculum/src/englishReading.ts`) gains nine Grade 2 rows, a per-grade accessor, and the sentence pool/partner/gate functions, which the form and the app share. The form renderer takes a grade, as the grammar form does. The app gets one round builder, one screen, one lesson card. «Read the sentence» is gated three ways (reading signed, grammar signed, Grade 2) and needs ≥ 6 distinct picture words.

**Tech Stack:** TypeScript, node:test (`node --experimental-strip-types --test`), Expo / React Native (+ web build), Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-20-english-corner-reading-g2-design.md` (approved 2026-10-20).

## Global Constraints

- Every Grade 2 reading row ships `reviewedBy: null`. **Never commit a sign-off**; a local one for the browser check is restored immediately (`grep -c LOCAL` must be 0).
- The Grade 1 reading form (`docs/english-reading-g1-review.html`), the Grade 1 grammar sheet and form, and the Grade 2 grammar sheet and form must stay **byte-identical**.
- The Grade 1 reading tests keep passing; where a test counted `READING_UNITS`, it is scoped to Grade 1 (`readingUnitsForGrade(1)`), not weakened.
- «Read the sentence» is **Grade 2 only**, needs reading **and** grammar signed, and needs `MIN_SENTENCE_WORDS = 6` distinct picture words. No hand-kept lesson list.
- Compute in latin; Arabic UI strings only. The brand is «إقرأ»; `i18nTerminology.test.ts` bans «اقرأ» in UI strings, so the activity is spelled «اقرَأ …» (with the fatha), as «اقرَأ واختر الصورة» already is.
- Font sizes come from `TYPE` in `artifacts/mobile/constants/theme.ts` (the design-scale test fails otherwise); pictures are artwork constants.
- The form's English runs are wrapped by `ltr()` without escaping entities: strings that go through it must contain no `"`, `&`, `<`, `>`.
- Commits end with the two trailer lines (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`). No model id anywhere else. Push only to `ccr-d9db5f6c-mgwkuo`.
- Mobile tests live only in `artifacts/mobile/services/__tests__/` and may not import react-native/expo.
- Test commands: curriculum `pnpm --filter @workspace/curriculum test` (one file: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/<file>`); mobile `cd artifacts/mobile && pnpm test` (one file: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>`); typecheck `pnpm run typecheck`; regenerate docs `pnpm --filter @workspace/curriculum run grammar-sheet`.

---

### Task 1: Curriculum engine — Grade 2 rows, the sentence pool, partners, the gate

**Files:**
- Modify: `lib/curriculum/src/englishReading.ts`
- Modify: `lib/curriculum/src/__tests__/englishReading.test.ts` (scope the two Grade 1 tests that count units)
- Create: `lib/curriculum/src/__tests__/englishReadingG2.test.ts`

**Interfaces:**
- Produces (exports of `englishReading.ts`):
  - `READING_UNITS` now holds Grade 1 **and** Grade 2 rows (19 in all)
  - `readingUnitsForGrade(grade: number): ReadingUnit[]`
  - `MIN_SENTENCE_WORDS = 6`
  - `distinctPictureWords(sentences: readonly GrammarSentence[]): number`
  - `readSentencePool(lessonId: string): GrammarSentence[]` — Grade 2 grammar sentences with a picture and no `yesNo`; `[]` for another grade, no grammar unit, or fewer than 6 distinct picture words
  - `sentencePartner(s: GrammarSentence, pool: readonly GrammarSentence[]): GrammarSentence | null`
  - `offeredReadingSentences(lessonId: string, signed?: { reading: boolean; grammar: boolean }): GrammarSentence[] | null`
  - `READING_NOT_COVERED_G2: Record<string, string[]>`

- [ ] **Step 1: Write the failing test** — create `lib/curriculum/src/__tests__/englishReadingG2.test.ts`:

```ts
/**
 * Grade 2 reading (spec: docs/superpowers/specs/2026-10-20-english-corner-reading-g2-design.md):
 * the unit rows, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  MIN_SENTENCE_WORDS, READING_NOT_COVERED_G2, READING_UNITS, distinctPictureWords, firstSound,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G2 = hubLessonsForGrade(2);
const L = (sem: number, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 0), L(1, 1), L(1, 2), L(1, 4), L(2, 5), L(2, 6), L(2, 7)];

test('every Grade 2 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(2).map(u => u.lessonId).sort(), G2.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(2).length, 9);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(2)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('the Grade 1 first-sound rule needs no new exception on Grade 2 words', () => {
  const out = new Set(G2.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en)));
  assert.equal(out.size, 22);
  assert.deepEqual([...out].sort(), [
    'action figure', 'apple', 'arms', 'aunt', 'chair', 'cheese', 'chicken', 'eggs', 'ears', 'eight', 'eraser',
    'eyes', 'knees', 'one', 'orange', 'shell', 'shelf', 'shoes', 'short', 'shorts', 'three', 'uncle',
  ].sort());
});

test('the sentence pool exists for exactly seven lessons: S1 U3 and S2 U8 have none', () => {
  const withPool = G2.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.equal(readSentencePool(L(1, 3)).length, 0);
  assert.equal(readSentencePool(L(2, 8)).length, 0);
  assert.equal(MIN_SENTENCE_WORDS, 6);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.deepEqual(readSentencePool('nope'), []);
});

test('the pool holds only pictured sentences that are not Yes or No, and measures as the spec says', () => {
  const counts = new Map(ELIGIBLE.map(id => [id, readSentencePool(id).length]));
  assert.deepEqual([...counts], [
    [L(1, 0), 16], [L(1, 1), 12], [L(1, 2), 15], [L(1, 4), 10], [L(2, 5), 20], [L(2, 6), 28], [L(2, 7), 11],
  ]);
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      assert.ok(s.picture, s.key);
      assert.equal(s.yesNo, null, s.key);
    }
    assert.ok(distinctPictureWords(pool) >= MIN_SENTENCE_WORDS, id);
  }
  assert.equal(distinctPictureWords(readSentencePool(L(1, 2))), 8);
  assert.equal(distinctPictureWords(readSentencePool(L(1, 4))), 7);
});

test('a partner is the same picture word with another count or marker; the counts match the spec', () => {
  const withPartner = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool)).length;
  };
  assert.equal(withPartner(L(1, 2)), 14);
  assert.equal(withPartner(L(1, 4)), 6);
  assert.equal(withPartner(L(2, 5)), 20);
  assert.equal(withPartner(L(2, 6)), 28);
  for (const id of [L(1, 0), L(1, 1), L(2, 7)]) assert.equal(withPartner(id), 0, id);
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      const p = sentencePartner(s, pool);
      if (!p) continue;
      assert.equal(p.picture!.word, s.picture!.word, s.key);
      assert.ok(p.picture!.count !== s.picture!.count || p.marker !== s.marker, s.key);
      assert.equal(sentencePartner(p, pool)?.key, s.key, `${s.key}: a partner's partner is the sentence`);
    }
  }
  // «I like cheese.» (✅) against «I don't like cheese.» (❌); «scissors» has no singular.
  const food = readSentencePool(L(2, 6));
  const like = food.find(s => s.text === 'I like cheese.')!;
  assert.equal(sentencePartner(like, food)!.text, "I don't like cheese.");
  const school = readSentencePool(L(1, 2));
  assert.equal(sentencePartner(school.find(s => s.text === 'These are my scissors.')!, school), null);
});

test('the sentence activity needs reading, grammar and a Grade 2 lesson, all three', () => {
  const id = L(2, 5);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  // Both signed, but no pool: S1 U3 and S2 U8, and every Grade 1 lesson.
  assert.equal(offeredReadingSentences(L(2, 8), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences(L(1, 3), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the lessons with no sentence activity, in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G2).sort(), [L(1, 1), L(1, 3), L(2, 6), L(2, 8)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G2)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
```

- [ ] **Step 2: Run to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReadingG2.test.ts`
Expected: FAIL (`readingUnitsForGrade` is not exported).

- [ ] **Step 3: Implement** in `lib/curriculum/src/englishReading.ts`.

(a) Replace the import line `import { hubLesson, type HubWord } from './englishHub.ts';` with:

```ts
import { grammarUnit, unitSentences, type GrammarSentence } from './englishGrammar.ts';
import { hubLesson, type HubWord } from './englishHub.ts';
```

(b) After the Grade 1 rows (before the closing `];` of `READING_UNITS`) add the Grade 2 rows:

```ts
  // Grade 2 (spec: 2026-10-20-english-corner-reading-g2-design.md). The hub has no S2 Unit 0.
  { lessonId: 'kbl-g2-eng-s1-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u1_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u2_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u3_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u4_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u5_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u6_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u7_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u8_l1', reviewedBy: null },
```

(c) After `offeredReading` append:

```ts
/** The rows of one grade, in hub order. */
export function readingUnitsForGrade(grade: number): ReadingUnit[] {
  return READING_UNITS.filter(u => hubLesson(u.lessonId)?.grade === grade);
}

// ─── Read the sentence (Grade 2) ────────────────────────────────────────────

/** A lesson offers «Read the sentence» only with this many distinct picture words: a round never asks one twice. */
export const MIN_SENTENCE_WORDS = 6;

export function distinctPictureWords(sentences: readonly GrammarSentence[]): number {
  return new Set(sentences.flatMap(s => (s.picture ? [s.picture.word] : []))).size;
}

/**
 * The Grade 2 grammar sentences a child may be asked to read: pictured, and not Yes or No (which has
 * its own activity). Empty for another grade, a lesson with no grammar unit, or a pool too thin to
 * make a round (S1 U3, S2 U8). Not gated on review: `offeredReadingSentences` is.
 */
export function readSentencePool(lessonId: string): GrammarSentence[] {
  if (hubLesson(lessonId)?.grade !== 2) return [];
  const unit = grammarUnit(lessonId);
  if (!unit) return [];
  const pool = unitSentences(unit).filter(s => s.picture !== null && s.yesNo === null);
  return distinctPictureWords(pool) >= MIN_SENTENCE_WORDS ? pool : [];
}

/**
 * The sentence one word away: the same picture word with another count (this / these) or marker
 * (like / don't like, he / she). Its picture is shown as a wrong answer, so the child has to read
 * the small word. Null when the pattern has no such pair. The form and the app both ask this.
 */
export function sentencePartner(s: GrammarSentence, pool: readonly GrammarSentence[]): GrammarSentence | null {
  const own = s.picture;
  if (!own) return null;
  return pool.find(t => t.picture !== null && t.picture.word === own.word && (t.picture.count !== own.count || t.marker !== s.marker)) ?? null;
}

/**
 * The pool once the unit's reading AND its grammar are signed off; null before, for a lesson with no
 * pool, and for any Grade 1 lesson. `signed` is injectable so the gate can be tested without ever
 * committing a sign-off.
 */
export function offeredReadingSentences(
  lessonId: string,
  signed: { reading: boolean; grammar: boolean } = {
    reading: Boolean(readingUnit(lessonId)?.reviewedBy),
    grammar: Boolean(grammarUnit(lessonId)?.reviewedBy),
  },
): GrammarSentence[] | null {
  if (!signed.reading || !signed.grammar) return null;
  const pool = readSentencePool(lessonId);
  return pool.length > 0 ? pool : null;
}

/**
 * Why a Grade 2 lesson has no «Read the sentence» for some or all of its sentences — printed on the
 * form. Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const READING_NOT_COVERED_G2: Record<string, string[]> = {
  'kbl-g2-eng-s1-nccd-u1_l1': [
    'جمل «Is it a car? Yes, it is.» وأخواتها لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
    'action figure وbuilding set بلا صورة، فلا تظهر جملتاهما في «اقرَأ الجملة».',
  ],
  'kbl-g2-eng-s1-nccd-u3_l1': [
    'لا جمل لهذه الوحدة لأنها بلا أنشطة قواعد (لا صور لكلماتها)، فتبقى أنشطة الكلمات الثلاثة فقط.',
  ],
  'kbl-g2-eng-s2-nccd-u6_l1': [
    'جمل «Do you like cheese? Yes, I do.» وأخواتها لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
  ],
  'kbl-g2-eng-s2-nccd-u8_l1': [
    'جمل الوحدة تختلف باسم الشخص (dad وmum وgrandad وgranny) والصورة هي الغرفة فقط، أي أربع صور لا غير، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة.',
  ],
};
```

- [ ] **Step 4: Scope the two Grade 1 tests** in `lib/curriculum/src/__tests__/englishReading.test.ts`.

Change the import to `import { READING_UNITS, firstSound, firstSoundSkip, offeredReading, readingUnit, readingUnitsForGrade } from '../englishReading.ts';` and the test 'every Grade 1 hub lesson has one reading record, and nothing else does':

```ts
test('every Grade 1 hub lesson has one reading record, and nothing else does', () => {
  const ids = hubLessonsForGrade(1).map(l => l.id).sort();
  const g1 = readingUnitsForGrade(1);
  assert.deepEqual(g1.map(u => u.lessonId).sort(), ids);
  assert.equal(new Set(g1.map(u => u.lessonId)).size, g1.length);
});
```

and, in the form test, `READING_UNITS.length` → `readingUnitsForGrade(1).length` (the `<section class="unit"` count line).

- [ ] **Step 5: Run the curriculum suite and typecheck**

Run: `pnpm --filter @workspace/curriculum test` — all pass (the Grade 1 form test must still pass: the form code is untouched, so `READING_UNITS` including Grade 2 rows would change it — **if it fails here, that is Task 2's first change; do Step 1 of Task 2 now and re-run**). Then `pnpm --filter @workspace/curriculum run typecheck`.

> Note: the Grade 1 form renderer still maps over all of `READING_UNITS`, so after Step 3 the Grade 1 form test fails until `renderReadingReviewHtml` filters by grade. That filter is Task 2 Step 3; run Tasks 1 and 2 before committing, or commit them together.

- [ ] **Step 6: Commit** (together with Task 2 if Step 5 shows the Grade 1 form failing; otherwise on its own)

```bash
git add lib/curriculum/src/englishReading.ts lib/curriculum/src/__tests__/englishReading.test.ts lib/curriculum/src/__tests__/englishReadingG2.test.ts
git commit -m "feat(curriculum): Grade 2 reading rows, the sentence pool and its partner rule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 2: The teacher's form per grade

**Files:**
- Modify: `lib/curriculum/src/englishGrammarReview.ts` (export three helpers)
- Modify: `lib/curriculum/src/englishReadingReview.ts`
- Modify: `lib/curriculum/scripts/grammar-sheet.ts`
- Modify: `lib/curriculum/src/__tests__/englishReadingG2.test.ts` (append the form tests)
- Create (generated): `docs/english-reading-g2-review.html`

**Interfaces:**
- Consumes: Task 1's `readingUnitsForGrade`, `readSentencePool`, `sentencePartner`, `READING_NOT_COVERED_G2`.
- Produces: `renderReadingReviewHtml(grade = 1): string`; the Grade 1 output byte-identical.

- [ ] **Step 1: Append the failing form tests** to `englishReadingG2.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { unitSentences, grammarUnitsForGrade } from '../englishGrammar.ts';

const docs = new URL('../../../../docs/', import.meta.url);

test("the Grade 2 reading form lists every word and every pool sentence once, with a not-covered block per gap", async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(2);
  const words = G2.flatMap(l => l.words);
  assert.equal(words.length, 154);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 154);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, words.filter(w => firstSound(w.en)).length);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, words.filter(w => !firstSound(w.en)).length);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 9);
  // One row per sentence of the seven pools: 16 + 12 + 15 + 10 + 20 + 28 + 11.
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 112);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 4);
  assert.ok(html.includes('مراجعة قراءة الصف الثاني'));
  assert.ok(html.includes('اقرَأ الجملة'));
  // Partner rows name the picture the app will show against the sentence.
  assert.ok(html.includes('<td class="sentence" dir="ltr">I like cheese.</td>'));
  assert.ok(html.includes('كلمتان أخريان من القائمة'), 'a sentence with no partner says its wrong pictures come from the list');
  for (const u of grammarUnitsForGrade(2)) assert.ok(unitSentences(u).length > 0);
});

test('the committed Grade 2 reading form is exactly what the generator produces; Grade 1 is untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  assert.equal(readFileSync(new URL('english-reading-g2-review.html', docs), 'utf8'), renderReadingReviewHtml(2), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(new URL('english-reading-g1-review.html', docs), 'utf8'), renderReadingReviewHtml(1), 'Grade 1 form changed');
  assert.equal(renderReadingReviewHtml(), renderReadingReviewHtml(1));
});
```

- [ ] **Step 2: Run to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReadingG2.test.ts`
Expected: FAIL (`renderReadingReviewHtml(2)` renders Grade 1 copy and every unit; the G2 file is missing).

- [ ] **Step 3: Export the helpers** in `englishGrammarReview.ts`: change `const ltr =` to `export const ltr =`, `function notCoveredList(` to `export function notCoveredList(`, and `function picture(` to `export function picture(`.

- [ ] **Step 4: Rework `englishReadingReview.ts`.**

(a) Imports — replace the first import and the `unitLabelAr` import with:

```ts
import {
  READING_NOT_COVERED_G2, firstSound, firstSoundSkip, readSentencePool, readingUnitsForGrade, sentencePartner,
  type ReadingUnit, type SoundSkip,
} from './englishReading.ts';
import { ltr as _ltrUnused, notCoveredList, picture, unitLabelAr } from './englishGrammarReview.ts';
import type { GrammarSentence } from './englishGrammar.ts';
```

(drop the `_ltrUnused` import if the linter or tsc complains of an unused import: only `notCoveredList`, `picture`, `unitLabelAr` are used.)

(b) Replace `function renderUnit(u: ReadingUnit): string {` with `function renderUnit(u: ReadingUnit, grade: number): string {`. After the closing `</div>` of `.table-wrap` (the one wrapping the word table) and before `<div class="signoff">`, insert `${grade === 2 ? sentenceSection(u.lessonId) : ''}` so the template reads:

```ts
    </div>${grade === 2 ? sentenceSection(u.lessonId) : ''}
    <div class="signoff">
```

(c) Add above `renderUnit`:

```ts
/** A sentence's picture, partner included — the same markup as the grammar form. */
function pictureOf(s: GrammarSentence): string {
  return picture(s.picture!.word, s.picture!.count, s.marker);
}

/** Grade 2: the «Read the sentence» pool of a unit, with the wrong picture each is shown against; then why anything is left out. */
function sentenceSection(lessonId: string): string {
  const pool = readSentencePool(lessonId);
  const rows = pool.map((s, i) => {
    const partner = sentencePartner(s, pool);
    const against = partner
      ? `${pictureOf(partner)} <span class="none">+ كلمة أخرى من القائمة</span>`
      : '<span class="none">كلمتان أخريان من القائمة</span>';
    return `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="sentence" dir="ltr">${esc(s.text)}</td>
          <td>${pictureOf(s)}</td>
          <td>${against}</td>
          <td class="tick"><span class="box" aria-hidden="true"></span></td>
          <td class="note"></td>
        </tr>`;
  }).join('');
  const table = pool.length
    ? `
    <h3 class="sub-h">جمل «اقرَأ الجملة» <span class="meta-line">(${AR_DIGITS(pool.length)})</span></h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الجملة</th>
            <th>الصورة</th>
            <th>صورة خاطئة تظهر معها<small>تُختار الأخرى عشوائيًا</small></th>
            <th class="tick">✓</th>
            <th class="note">ملاحظات</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>`
    : '';
  return `${table}${notCoveredList(READING_NOT_COVERED_G2[lessonId])}`;
}
```

(d) Grade copy. Above `export function renderReadingReviewHtml`, add (the Grade 1 strings are **verbatim** from the current template — copy them exactly, do not retype):

```ts
interface GradeCopy {
  title: string;
  eyebrow: string;
  lead: (words: number, units: number, sentences: number, sentenceUnits: number) => string;
  acts: string;
  checks: string[];
  meta: string;
  extraCss: string;
}

const ACT_FIND = '<div class="act"><b>اقرَأ واختر الصورة</b>تظهر الكلمة مكتوبة دون صوت، ويختار الطالب صورتها من ثلاث صور. تُسمع الكلمة بعد الإجابة.</div>';
const ACT_LETTER = '<div class="act"><b>الحرف الأول</b>يسمع الطالب الكلمة ويرى صورتها، ويختار حرفها الأول من ثلاثة أحرف. لا تُكتب الكلمة قبل الإجابة.</div>';
const ACT_STARTS = '<div class="act"><b>يبدأ بهذا الحرف</b>يظهر حرف، ويختار الطالب الصورة التي يبدأ اسمها بصوته من ثلاث صور.</div>';
const CHECKS_WORD = [
  'هل الحرف المكتوب هو فعلًا أول صوت يسمعه الطالب في الكلمة؟',
  'هل الصورة تدل على الكلمة دون لبس؟',
  'هل توافقون على استبعاد الكلمات المستبعدة، أم تريدون إضافة إحداها؟',
];

const GRADE_COPY: Record<number, GradeCopy> = {
  1: {
    title: 'مراجعة قراءة الصف الأول',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الأول',
    lead: (words, units) => `أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة قراءة مبنية على كلمات كل وحدة وصورها وتسجيلاتها، وعلى هدف الكتاب: تمييز الصوت الأول في الكلمة. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل كلمة في ${AR_DIGITS(units)} وحدات، ${wordCountAr(words)}.`,
    acts: ACT_FIND + '\n      ' + ACT_LETTER + '\n      ' + ACT_STARTS,
    checks: CHECKS_WORD,
    meta: '«بلا صورة» تعني أن الكلمة لا تظهر في نشاطَي الصور، وتظهر في «الحرف الأول» بالصوت وحده. الصور هي الرموز التي تظهر في التطبيق نفسه.',
    extraCss: '',
  },
  2: {
    title: 'مراجعة قراءة الصف الثاني',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثاني',
    lead: (words, units, sentences, sentenceUnits) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثاني أربعة أنشطة قراءة: ثلاثة على كلمات كل وحدة كما في الصف الأول، ونشاط رابع لقراءة جملة كاملة. الجمل هي جمل القواعد نفسها، وتُسمع بعد الإجابة فقط، ولا يظهر هذا النشاط لوحدة قبل موافقتكم على قواعدها أيضًا. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل كلمة في ${AR_DIGITS(units)} وحدات، ${wordCountAr(words)}، وجمل النشاط الرابع في ${AR_DIGITS(sentenceUnits)} وحدات، ${AR_DIGITS(sentences)} جملة.`,
    acts: ACT_FIND + '\n      ' + ACT_LETTER + '\n      ' + ACT_STARTS +
      '\n      <div class="act"><b>اقرَأ الجملة</b>تظهر جملة مكتوبة دون صوت، ويختار الطالب صورتها من ثلاث صور. إحدى الصورتين الخاطئتين هي صورة الجملة المقابلة إن وُجدت (🐭 مقابل 🐭🐭، أو ✅ مقابل ❌، أو 👦 مقابل 👧) ليقرأ الطالب الكلمة الصغيرة.</div>',
    checks: [
      ...CHECKS_WORD,
      'في «اقرَأ الجملة»: هل يستطيع طالب الصف الثاني قراءة الجملة كاملة؟ وهل جملتا السؤال والجواب معًا أطول مما يُحتمل في هذه المرحلة، أم يكفي عرض الجواب وحده؟',
      'هل تُقرأ ✅ و❌ والصورة الواحدة مقابل الصورتين بوضوح على أنها «don\'t» و«these are»؟',
      'هل تسبب صورة pink (القلب الوردي) أو orange (الدائرة 🟠) أو لون العينين لبسًا؟',
    ],
    meta: '«بلا صورة» تعني أن الكلمة لا تظهر في نشاطَي الصور، وتظهر في «الحرف الأول» بالصوت وحده. لا يشمل التطبيق الصوت الأوسط أو الأخير في الكلمة. الصور هي الرموز التي تظهر في التطبيق نفسه.',
    extraCss: `
  td.sentence { font-family: var(--latin); font-size: 1.02rem; font-weight: 500; text-align: left; white-space: nowrap; }
  .pic { display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .pic-word { font-family: var(--latin); font-size: .72rem; color: var(--muted); }
  .sub-h { font-family: var(--display); font-size: 1.05rem; margin: 6px 0 0; }
  .unit-note { margin: 0; }
  .not-covered { margin: 0; padding-inline-start: 1.3em; display: grid; gap: 4px; font-size: .92rem; color: var(--muted); }
  .not-covered [dir="ltr"] { font-family: var(--latin); }`,
  },
};
```

(e) In `renderReadingReviewHtml`, replace the head of the function and the template literals:

```ts
export function renderReadingReviewHtml(grade = 1): string {
  const copy = GRADE_COPY[grade]!;
  const unitRows = readingUnitsForGrade(grade);
  const words = unitRows.reduce((n, u) => n + (hubLesson(u.lessonId)?.words.length ?? 0), 0);
  const pools = unitRows.map(u => readSentencePool(u.lessonId)).filter(p => p.length > 0);
  const sentences = pools.reduce((n, p) => n + p.length, 0);
  const units = unitRows.map(u => renderUnit(u, grade)).join('');
```

and in the template: `<title>مراجعة قراءة الصف الأول</title>` → `<title>${copy.title}</title>`; the eyebrow `<div class="eyebrow">…</div>` → `<div class="eyebrow">${copy.eyebrow}</div>`; the whole `<p class="lead">…</p>` → `<p class="lead">${copy.lead(words, unitRows.length, sentences, pools.length)}</p>`; the `<div class="acts">` body → `${copy.acts}` (inside the same `<div class="acts">`/`</div>`); the three `<li>` items of the first `.card` `<ol>` → `${copy.checks.map(c => `<li>${esc(c)}</li>`).join('\n        ')}`; the `<p class="meta-line">…</p>` → `<p class="meta-line">${copy.meta}</p>`; and after the last CSS rule, just before `</style>`, add `${copy.extraCss}` (the line `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  }` stays; put `${copy.extraCss}` after the closing `}` of the `@media print` block).

Grade 1 must render exactly as before: `esc()` on a `check` changes `'`/`"`/`&`/`<`/`>` — the three Grade 1 checks contain none. The Grade 2 checks contain `'` in `don't` — `esc` turns `'`? It does not (it escapes `&<>"` only), so the output keeps `don't`. Keep the quotes in the Grade 2 checks to `'`, never `"`.

- [ ] **Step 5: Generate the files and confirm Grade 1 is untouched**

In `scripts/grammar-sheet.ts` add `renderReadingReviewHtml(2)` and update the header comment and the list:

```ts
files.push(['english-reading-g1-review.html', renderReadingReviewHtml(1)]);
files.push(['english-reading-g2-review.html', renderReadingReviewHtml(2)]);
```

(replacing the single `files.push(['english-reading-g1-review.html', renderReadingReviewHtml()])` line; add a sentence to the file's doc comment: «and the Grade 2 reading form to docs/english-reading-g2-review.html»).

Run: `pnpm --filter @workspace/curriculum run grammar-sheet && git status --short docs/ && git diff --stat docs/`
Expected: `docs/english-reading-g2-review.html` is new; **no** other file under `docs/` changed.

- [ ] **Step 6: Run the suite and typecheck**

Run: `pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run typecheck` — all pass, including the Grade 1 reading form test.

- [ ] **Step 7: Look at it** (never committed output): open `docs/english-reading-g2-review.html` with Playwright (`/opt/pw-browsers/chromium`, scratchpad script) at 1123×794 and at 390 px wide; screenshot the intro, a unit with sentence rows and a partner column (S2 U6), and S1 U3 (a unit with a not-covered block); check `scrollWidth <= innerWidth` at 390 px and print to PDF. Fix anything that overflows or reads backwards.

- [ ] **Step 8: Commit**

```bash
git add lib/curriculum docs/english-reading-g2-review.html
git status --short   # nothing else; docs/english-reading-g1-review.html unchanged
git commit -m "feat(curriculum): Grade 2 reading form, and the reading rows behind it

The reading form now renders per grade. Grade 2 adds a sentence table with
the wrong picture each sentence is shown against, and a not-covered block
for S1 U1, U3, S2 U6, U8. The Grade 1 reading form is byte-identical.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

(If Task 1 was not committed on its own, `git add` its three files here as well and use one message that names both.)

---

### Task 3: The round builder

**Files:**
- Modify: `artifacts/mobile/services/englishHub/games.ts`
- Create: `artifacts/mobile/services/__tests__/englishReadingG2Games.test.ts`

**Interfaces:**
- Consumes: Task 1's `sentencePartner`, `distinctPictureWords`, `MIN_SENTENCE_WORDS`, `readSentencePool`; existing `sample`, `shuffle`, `ROUND_LENGTH`, `READING_OPTIONS`.
- Produces (exports of `games.ts`):
  - `HubActivity` gains `'read-sentence'`; `SCORED_ACTIVITIES` includes it (it is **not** in `READING_ACTIVITIES`)
  - `interface SentencePictureOption { word: string; count: 1 | 2; marker: GrammarMarker | null }`
  - `interface ReadSentenceQuestion { sentence: GrammarSentence; options: SentencePictureOption[]; answerIndex: number }`
  - `buildReadSentenceRound(pool: readonly GrammarSentence[], rng?: () => number): ReadSentenceQuestion[]`
  - `readSentenceAvailable(pool: readonly GrammarSentence[]): boolean`

- [ ] **Step 1: Write the failing test** — create `artifacts/mobile/services/__tests__/englishReadingG2Games.test.ts`:

```ts
/**
 * «Read the sentence» (Grade 2). The builder does not gate on review — the lesson screen's
 * `offeredReadingSentences` does — so it is tested over every lesson that has a pool.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken } from '@workspace/curriculum/englishGrammar';
import { hubLessonsForGrade } from '@workspace/curriculum/englishHub';
import { MIN_SENTENCE_WORDS, distinctPictureWords, readSentencePool, sentencePartner } from '@workspace/curriculum/englishReading';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  READING_ACTIVITIES,
  READING_OPTIONS,
  ROUND_LENGTH,
  buildReadSentenceRound,
  lessonStars,
  readSentenceAvailable,
  recordResult,
  type SentencePictureOption,
} from '../englishHub/games.ts';

const POOLS = hubLessonsForGrade(2).map(l => ({ id: l.id, pool: readSentencePool(l.id) })).filter(p => p.pool.length > 0);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const spoken = new Set(allGrammarSpoken());
const key = (o: SentencePictureOption) => `${o.word}|${o.count}|${o.marker ?? ''}`;
const own = (q: { sentence: { picture: { word: string; count: 1 | 2 } | null; marker: SentencePictureOption['marker'] } }): string =>
  key({ word: q.sentence.picture!.word, count: q.sentence.picture!.count, marker: q.sentence.marker });

describe('Read the sentence', () => {
  it('seven lessons have a pool, and it is offered on exactly those', () => {
    assert.equal(POOLS.length, 7);
    for (const l of hubLessonsForGrade(2)) {
      assert.equal(readSentenceAvailable(readSentencePool(l.id)), POOLS.some(p => p.id === l.id), l.id);
    }
    assert.equal(readSentenceAvailable([]), false);
  });

  it('is not one of the word activities, so it never shows on a lesson by words alone', () => {
    assert.ok(!READING_ACTIVITIES.includes('read-sentence'));
  });

  it('a round is at most eight questions, three distinct pictures, the sentence\'s own at answerIndex', () => {
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      const round = buildReadSentenceRound(pool, makeRng(seed));
      assert.equal(round.length, Math.min(ROUND_LENGTH, distinctPictureWords(pool)), id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS, `${id} ${q.sentence.text}`);
        assert.equal(new Set(q.options.map(key)).size, READING_OPTIONS, `${id} ${q.sentence.text}`);
        assert.equal(key(q.options[q.answerIndex]), own(q), q.sentence.text);
        assert.equal(q.sentence.yesNo, null, q.sentence.text);
        assert.ok(spoken.has(q.sentence.text), `${q.sentence.text} has no recording`);
      }
    }
  });

  it('never asks one picture word twice in a round', () => {
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      const words = buildReadSentenceRound(pool, makeRng(seed)).map(q => q.sentence.picture!.word);
      assert.equal(new Set(words).size, words.length, id);
    }
  });

  it('shows the partner among the wrong pictures whenever one exists, and no other picture of the answer\'s word', () => {
    let withPartner = 0;
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      for (const q of buildReadSentenceRound(pool, makeRng(seed))) {
        const partner = sentencePartner(q.sentence, pool);
        const wrong = q.options.filter((_, k) => k !== q.answerIndex);
        if (partner) {
          withPartner += 1;
          const want = key({ word: partner.picture!.word, count: partner.picture!.count, marker: partner.marker });
          assert.ok(wrong.some(o => key(o) === want), `${id}: ${q.sentence.text} lacks its partner`);
          // The other wrong picture is some other word.
          assert.equal(wrong.filter(o => o.word === q.sentence.picture!.word).length, 1, q.sentence.text);
        } else {
          assert.ok(wrong.every(o => o.word !== q.sentence.picture!.word), `${id}: ${q.sentence.text}`);
        }
      }
    }
    assert.ok(withPartner > 0);
  });

  it('is unavailable one picture word short of the floor', () => {
    const pool = readSentencePool('kbl-g2-eng-s2-nccd-u6_l1');
    const words = [...new Set(pool.map(s => s.picture!.word))].slice(0, MIN_SENTENCE_WORDS - 1);
    assert.equal(readSentenceAvailable(pool.filter(s => words.includes(s.picture!.word))), false);
    assert.equal(readSentenceAvailable(pool.filter(s => [...new Set(pool.map(t => t.picture!.word))].slice(0, MIN_SENTENCE_WORDS).includes(s.picture!.word))), true);
  });

  it('stars for it count toward the lesson', () => {
    const id = 'kbl-g2-eng-s2-nccd-u5_l1';
    const p = recordResult(EMPTY_PROGRESS, id, 'read-sentence', 3, '2026-10-20');
    assert.equal(lessonStars(p, id), 3);
  });
});
```

- [ ] **Step 2: Run to make sure it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishReadingG2Games.test.ts`
Expected: FAIL (`buildReadSentenceRound` is not exported).

- [ ] **Step 3: Implement in `games.ts`.**

(a) Imports: change `import { firstSound } from '@workspace/curriculum/englishReading';` to
`import { MIN_SENTENCE_WORDS, distinctPictureWords, firstSound, sentencePartner } from '@workspace/curriculum/englishReading';`.

(b) `HubActivity`: change `| 'read-find' | 'first-letter' | 'starts-with';` to `| 'read-find' | 'first-letter' | 'starts-with' | 'read-sentence';`. Leave `READING_ACTIVITIES` as it is. In `SCORED_ACTIVITIES` change `'read-find', 'first-letter', 'starts-with',` to `'read-find', 'first-letter', 'starts-with', 'read-sentence',`.

(c) After `readingActivityAvailable` add:

```ts
// ─── Read the sentence (Grade 2) ────────────────────────────────────────────

/** A picture as a child sees it: the word's emoji, doubled for a plural, with a ✅ / ❌ / 👦 / 👧 beside it. */
export interface SentencePictureOption {
  word: string;
  count: 1 | 2;
  marker: GrammarMarker | null;
}

export interface ReadSentenceQuestion {
  sentence: GrammarSentence;
  /** Three pictures; the sentence's own is at `answerIndex`. */
  options: SentencePictureOption[];
  answerIndex: number;
}

const optionOf = (s: GrammarSentence): SentencePictureOption => ({ word: s.picture!.word, count: s.picture!.count, marker: s.marker });
const optionKey = (o: SentencePictureOption) => `${o.word}|${o.count}|${o.marker ?? ''}`;

/**
 * Read the printed sentence, tap its picture. One question per picture word, so a round cannot be
 * passed by remembering a picture. The first wrong picture is the sentence's partner when it has one
 * (the same word, another count or marker: the child must read the small word); the rest are other
 * words of the same pattern, then of the unit. `pool` is `readSentencePool(lessonId)`.
 */
export function buildReadSentenceRound(pool: readonly GrammarSentence[], rng: () => number = Math.random): ReadSentenceQuestion[] {
  const usable = pool.filter(s => s.picture !== null && s.yesNo === null);
  const byWord = new Map<string, GrammarSentence[]>();
  for (const s of usable) byWord.set(s.picture!.word, [...(byWord.get(s.picture!.word) ?? []), s]);
  const asked = sample([...byWord.keys()], ROUND_LENGTH, rng).map(w => sample(byWord.get(w)!, 1, rng)[0]);
  return asked.map(sentence => {
    const answer = optionOf(sentence);
    const partner = sentencePartner(sentence, usable);
    const wrong: SentencePictureOption[] = partner ? [optionOf(partner)] : [];
    const taken = new Set([answer.word, ...wrong.map(o => o.word)]);
    // Same pattern first, so the wrong picture looks like the right one (a ✅ beside a ✅); then the rest of the unit.
    for (const same of [true, false]) {
      for (const w of shuffle([...byWord.keys()], rng)) {
        if (wrong.length === READING_OPTIONS - 1) break;
        if (taken.has(w)) continue;
        const other = byWord.get(w)!.find(t => !same || t.patternId === sentence.patternId);
        if (!other) continue;
        wrong.push(optionOf(other));
        taken.add(w);
      }
    }
    const options = shuffle([answer, ...wrong], rng);
    return { sentence, options, answerIndex: options.findIndex(o => optionKey(o) === optionKey(answer)) };
  });
}

/** Offered when the pool has the floor of distinct picture words, so a round never repeats one. */
export function readSentenceAvailable(pool: readonly GrammarSentence[]): boolean {
  return distinctPictureWords(pool) >= MIN_SENTENCE_WORDS;
}
```

- [ ] **Step 4: Run the new test, then the whole mobile suite and typecheck**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishReadingG2Games.test.ts services/__tests__/englishReadingGames.test.ts` — all pass. Then `pnpm test` in `artifacts/mobile` (run it in the background: it takes ~4 minutes) and `pnpm run typecheck` from the root. **Expected typecheck failure here and only here:** `app/curriculum/english/[lessonId].tsx` — `META` is a `Record<HubActivity, …>` and lacks `'read-sentence'`; Task 4 fixes it. Anything else is a real error.

- [ ] **Step 5: Commit** (typecheck is red on `META` alone, so do not commit until Task 4 Step 3 if the repo's hooks run typecheck; here they do not — commit, and say so in the message body)

```bash
git add artifacts/mobile/services/englishHub/games.ts artifacts/mobile/services/__tests__/englishReadingG2Games.test.ts
git commit -m "feat(english-hub): the Read the sentence round builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 4: The screen, the card, the strings, and the browser check

**Files:**
- Modify: `artifacts/mobile/components/englishHub/GrammarActivities.tsx` (a `small` option on `GrammarPicture`)
- Modify: `artifacts/mobile/components/englishHub/ReadingActivities.tsx`
- Modify: `artifacts/mobile/app/curriculum/english/[lessonId].tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: Task 3's `buildReadSentenceRound`, `readSentenceAvailable`, `ReadSentenceQuestion`, `SentencePictureOption`; Task 1's `offeredReadingSentences`.
- Produces: `ReadSentence({ pool, onFinish })`; `GrammarPicture` accepts `small?: boolean`.

- [ ] **Step 1: Strings.** In `services/i18n.ts`, after `hubRStartsDesc: 'أيّ صورة تبدأ بصوت هذا الحرف؟',` add:

```ts
    hubRSentence: 'اقرَأ الجملة',
    hubRSentenceDesc: 'اقرَأ الجملة ثم اختر صورتها',
```
and after `hubRStartsDesc: 'Which picture starts with this sound?',` add:

```ts
    hubRSentence: 'Read the sentence',
    hubRSentenceDesc: 'Read the sentence, then tap its picture',
```

- [ ] **Step 2: A small picture.** In `GrammarActivities.tsx` add constants beside `PICTURE_SIZE`/`MARKER_SIZE`:

```ts
/** The three option cards of «Read the sentence» hold a marker and up to two pictures: smaller artwork, stacked. */
const SMALL_PICTURE_SIZE = 40;
const SMALL_MARKER_SIZE = 28;
```
Change the signature and body of `GrammarPicture`:

```tsx
export function GrammarPicture({ word, count, marker, small = false }: { word: string; count: 1 | 2; marker: GrammarMarker | null; small?: boolean }) {
  const pic = wordPicture(word);
  const glyph = marker ? MARKER_GLYPH[marker] : undefined;
  if (!pic && !glyph) return null;
  return (
    <View style={small ? styles.pictureStack : styles.pictureRow} accessible={false}>
      {glyph ? <Text style={small ? styles.markerSmall : styles.marker}>{glyph}</Text> : null}
      {pic ? <Text style={small ? styles.pictureSmall : styles.picture}>{count === 2 ? `${pic}${pic}` : pic}</Text> : null}
    </View>
  );
}
```
and to `styles` add:

```ts
  pictureStack: { alignItems: 'center', gap: 2 },
  pictureSmall: { fontSize: SMALL_PICTURE_SIZE, lineHeight: SMALL_PICTURE_SIZE + 8, textAlign: 'center' },
  markerSmall: { fontSize: SMALL_MARKER_SIZE, lineHeight: SMALL_MARKER_SIZE + 6 },
```

- [ ] **Step 3: The screen.** In `ReadingActivities.tsx` change the imports:

```tsx
import type { GrammarSentence } from '@workspace/curriculum/englishGrammar';
import { buildFirstLetterRound, buildReadFindRound, buildReadSentenceRound, buildStartsWithRound, wordPicture } from '@/services/englishHub/games';
import { Feedback, GrammarPicture } from './GrammarActivities';
```
(replace the existing `import { Feedback } from './GrammarActivities';` and the existing `games` import), and after `StartsWith` add:

```tsx
// ─── Read the sentence (Grade 2) ────────────────────────────────────────────

export function ReadSentence({ pool, onFinish }: { pool: readonly GrammarSentence[]; onFinish: Finish }) {
  const colors = useColors();
  const tint = useTint();
  const round = useMemo(() => buildReadSentenceRound(pool), [pool]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      <Text style={[styles.sentenceText, { color: colors.foreground }]}>{q.sentence.text}</Text>
      {/* Heard only once answered: before, the sound would do the reading. */}
      <View style={styles.choiceRow}>
        {q.options.map((o, k) => (
          <Pressable
            key={`${o.word}|${o.count}|${o.marker ?? ''}`}
            onPress={() => pick(k, () => void playWord(q.sentence.text))}
            accessibilityRole="button"
            // The picture would read the answer out to a screen reader: number the cards instead.
            accessibilityLabel={String(k + 1)}
            style={[styles.sentenceCard, tint(picked, k, q.answerIndex)]}
          >
            <GrammarPicture word={o.word} count={o.count} marker={o.marker} small />
          </Pressable>
        ))}
      </View>
      {picked !== null ? <Feedback ok={picked === q.answerIndex} answer={q.sentence.text} onNext={() => next()} sentence={q.sentence.text} /> : null}
    </View>
  );
}
```
and to `styles` add:

```ts
  // Up to a marker and two pictures per card: three of them must fit a 390 px screen.
  sentenceCard: { flex: 1, maxWidth: 112, minHeight: 104, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  sentenceText: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.headline, lineHeight: TYPE.headline + 8, textAlign: 'center', writingDirection: 'ltr' },
```
Update the file's top comment from «three Grade 1 reading activities» to «the Grade 1 reading activities and Grade 2's Read the sentence».

- [ ] **Step 4: The lesson screen.** In `app/curriculum/english/[lessonId].tsx`:

(a) imports: `import { offeredReading, offeredReadingSentences } from '@workspace/curriculum/englishReading';`; add `readSentenceAvailable` to the `@/services/englishHub/games` import; `import { FirstLetter, ReadFind, ReadSentence, StartsWith } from '@/components/englishHub/ReadingActivities';`.

(b) after `const reading = useMemo(...)` add `const readingSentences = useMemo(() => offeredReadingSentences(lessonId ?? ''), [lessonId]);`.

(c) `META`: after the `'starts-with'` line add `'read-sentence': { icon: 'document-text-outline', title: 'hubRSentence', desc: 'hubRSentenceDesc' },`.

(d) route: after the `starts-with` line add
`if (readingSentences && activity === 'read-sentence') return <ReadSentence key={round} pool={readingSentences} onFinish={finish} />;`

(e) cards: replace `const readingCards = reading ? READING_ACTIVITIES.filter(a => readingActivityAvailable(a, reading)) : [];` with

```ts
    const readingCards: HubActivity[] = [
      ...(reading ? READING_ACTIVITIES.filter(a => readingActivityAvailable(a, reading)) : []),
      ...(readingSentences && readSentenceAvailable(readingSentences) ? (['read-sentence'] as HubActivity[]) : []),
    ];
```

- [ ] **Step 5: Typecheck and the suites**

Run: `pnpm run typecheck` (root) — no errors. `cd artifacts/mobile && pnpm test` (background, ~4 min) — all pass (the design-scale and terminology tests included).

- [ ] **Step 6: Browser check** (never committed). Sign off, **in the working tree only**, reading **and** grammar for S2 U6 (food: partners ✅/❌) and S1 U2 (school: this/these), and reading only for S2 U5 (animals): in `lib/curriculum/src/englishReading.ts` set `reviewedBy: { name: 'LOCAL', date: 'x' }` on those three rows and in `lib/curriculum/src/englishGrammarG2.ts` on S2 U6 and S1 U2. Build (`cd artifacts/mobile && EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), **restore both files immediately** (`git checkout lib/curriculum/src/englishReading.ts lib/curriculum/src/englishGrammarG2.ts`, then `grep -c LOCAL` on both = 0), serve with `WEB_PORT=8098 node e2e/serve.mjs` (note its PID) and drive `/curriculum/english/<id>` with Playwright (Chromium at `/opt/pw-browsers/chromium`; `localStorage` `@iqra_intro_seen_v1` = `1`, `@iqra_language` = `ar` then `en`; 4.5 s splash wait; viewport 390×844). Check, for each language:
  - S2 U6: a «اقرَأ الجملة» / «Read the sentence» card under the reading heading; open it: the sentence is shown with no sound, three picture cards in one row, the same food appears with ✅ and ❌ among the options when the sentence is asked; tap one; the feedback shows and the card tint is right/wrong; `scrollWidth <= innerWidth`;
  - S1 U2: «These are my pencils.» options include one pencil and two pencils;
  - S2 U5 (reading signed, grammar not): the three word cards and **no** sentence card;
  - an unsigned unit (S2 U7): no reading section at all;
  - the longest sentence of the pool wraps to two lines without clipping (S2 U7 is unsigned; check S2 U5's «What are these? They're tortoises.» and S1 U0's colour sentence instead), and the sentence stays left to right inside the Arabic page.
  Stop the server with `kill <PID>` (not `pkill -f`).

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/englishHub/GrammarActivities.tsx artifacts/mobile/components/englishHub/ReadingActivities.tsx "artifacts/mobile/app/curriculum/english/[lessonId].tsx" artifacts/mobile/services/i18n.ts
git status --short   # nothing else, and no sign-off in englishReading.ts or englishGrammarG2.ts
git commit -m "feat(english-hub): the Read the sentence screen, shown per unit once signed off

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 5: STATUS.md and wrap-up

**Files:**
- Modify: `STATUS.md`, `docs/superpowers/specs/2026-10-20-english-corner-reading-g2-design.md`

- [ ] **Step 1: STATUS.md.** After the «Grade 2 grammar in the English corner» section add «Grade 2 reading in the English corner — built, shown to nobody yet, 2026-10-20»: what it is (the three Grade 1 word activities on Grade 2 words, plus «Read the sentence»; 9 rows in `READING_UNITS`, all `reviewedBy: null`; seven lessons have the sentence activity, S1 U3 and S2 U8 do not and why); the three gates (reading, grammar, Grade 2) and the 6-distinct-words floor; the partner rule (counts 14, 6, 20, 28) and that the form and the app share `sentencePartner`; the 22 left-out words; the form `docs/english-reading-g2-review.html` (regenerate with `pnpm --filter @workspace/curriculum run grammar-sheet`; tests pin it; Grade 1 reading form unchanged) and its open points for the teacher; that the sentence recording comes from the pending `english-audio` run; and **To switch a unit on**: grammar signed and audio recorded, teacher signs the reading page, set `reviewedBy` in `englishReading.ts`. Also change the existing Grade 1 reading section's `READING_UNITS` mention only if it became untrue (it did not).

- [ ] **Step 2: Spec status.** Change the spec's **Status** line to «implemented (PR #1158)» (keep «Scope» as is).

- [ ] **Step 3: Full verification** — run and read the output: `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test`; `git status --short`; `git diff origin/main --stat -- docs/english-grammar-g1-sheet.md docs/english-grammar-g1-review.html docs/english-reading-g1-review.html docs/english-grammar-g2-sheet.md docs/english-grammar-g2-review.html` (empty); `grep -c LOCAL lib/curriculum/src/englishReading.ts lib/curriculum/src/englishGrammarG2.ts` (both 0).

- [ ] **Step 4: Commit, merge `main`, push**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-20-english-corner-reading-g2-design.md docs/superpowers/plans/2026-10-20-english-corner-reading-g2.md
git commit -m "docs: Grade 2 reading in STATUS.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
git fetch origin main && git merge origin/main
```
Re-run Step 3's checks if the merge brought code changes, then `git push -u origin ccr-d9db5f6c-mgwkuo`, update PR #1158's title and body so it covers grammar **and** reading, and mark it ready only when the user asks.

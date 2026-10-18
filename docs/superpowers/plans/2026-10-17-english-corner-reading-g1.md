# English corner: Grade 1 reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three reading activities (Read and find, First letter, Starts with) on the English corner's 10 Grade 1 lessons, hidden per unit until a teacher signs a printed form.

**Architecture:** A react-native-free module in `lib/curriculum` decides each word's first sound (rule + `SOFT_G`) and holds the per-unit sign-off (`READING_UNITS`). Pure round builders in `artifacts/mobile/services/englishHub/games.ts` make every choice with a right answer; a new component file only renders and counts; the lesson screen shows a «القراءة» section when `offeredReading` returns words. A generated HTML form, pinned by a test, is what the teacher signs.

**Tech Stack:** TypeScript, React Native / Expo (web build too), `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-10-17-english-corner-reading-g1-design.md`

## Global Constraints

- Grade 1 English only: the 10 lessons `hubLessonsForGrade(1)` returns (`kbl-g1-eng-s{1,2}-nccd-u*_l1`).
- No new audio, no server, schema or migration change. A letter is only ever shown, never played.
- First sound: first letter lower-cased, except a vowel letter start, a `ch`/`sh`/`th`/`ph`/`kn`/`wr` start, `c` before `e`/`i`/`y`, or a word in `SOFT_G` (`giraffe`) → no first sound.
- Every `READING_UNITS` record ships `reviewedBy: null`. Never commit a sign-off made for local testing.
- `ROUND_LENGTH` (8) questions per round; three options per question.
- First letter: never `b` beside `d`, or `p` beside `q`. Padding letters: `b d f h l m n p r s t`.
- Floors: Read and find ≥ 4 picturable words; First letter ≥ 4 words with a first sound; Starts with ≥ 3 distinct first letters among picturable words with a first sound.
- English text and letters are laid out LTR whatever the UI language; an English answer inside an Arabic line is wrapped in LRI…PDI (`⁦…⁩`).
- Audio starts only from a tap (browsers refuse `play()` without a gesture): the first question's word plays from the big «hear» button, later ones from «Next».
- `lib/curriculum` tests run as `pnpm --filter @workspace/curriculum test`; mobile tests must live in `artifacts/mobile/services/__tests__/` and import no `react-native`/`expo-*`.
- Commits end with the session's `Co-Authored-By` / `Claude-Session` lines.

## File map

| File | Responsibility |
| --- | --- |
| `lib/curriculum/src/englishReading.ts` (new) | `firstSound`, `firstSoundSkip`, `SOFT_G`, `READING_UNITS`, `readingUnit`, `offeredReading` |
| `lib/curriculum/src/englishReadingReview.ts` (new) | `renderReadingReviewHtml()` — the teacher's form (beside `englishGrammarReview.ts`, the same split as grammar) |
| `lib/curriculum/package.json` | export `./englishReading` |
| `lib/curriculum/scripts/grammar-sheet.ts` | also writes `docs/english-reading-g1-review.html` |
| `docs/english-reading-g1-review.html` (generated) | what the teacher signs |
| `lib/curriculum/src/__tests__/englishReading.test.ts` (new) | rule, unit coverage, gate, committed form |
| `artifacts/mobile/services/englishHub/games.ts` | three activity ids, builders, availability, scoring |
| `artifacts/mobile/services/__tests__/englishReadingGames.test.ts` (new) | builder properties over all 10 lessons |
| `artifacts/mobile/components/englishHub/ReadingActivities.tsx` (new) | the three screens |
| `artifacts/mobile/app/curriculum/english/[lessonId].tsx` | «القراءة» section and routing |
| `artifacts/mobile/services/i18n.ts` | Arabic + English strings |
| `STATUS.md` | new section + sign-off step |

---

### Task 1: First sounds and the per-unit gate

**Files:**
- Create: `lib/curriculum/src/englishReading.ts`
- Modify: `lib/curriculum/package.json` (exports)
- Test: `lib/curriculum/src/__tests__/englishReading.test.ts`

**Interfaces:**
- Produces:
  - `type SoundSkip = 'vowel' | 'digraph' | 'soft-c' | 'soft-g'`
  - `firstSoundSkip(word: string): SoundSkip | null`
  - `firstSound(word: string): string | null` — one lower-case letter, or null
  - `SOFT_G: ReadonlySet<string>`
  - `interface ReadingUnit { lessonId: string; reviewedBy: { name: string; date: string } | null }`
  - `READING_UNITS: ReadingUnit[]`, `readingUnit(lessonId: string): ReadingUnit | undefined`
  - `offeredReading(lessonId: string): HubWord[] | null`
  - package subpath `@workspace/curriculum/englishReading`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Grade 1 reading: which words have a first sound the app may ask about, and
 * the per-unit sign-off that keeps the activities hidden until a teacher has
 * read the list (docs/english-reading-g1-review.html).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonsForGrade } from '../englishHub.ts';
import { READING_UNITS, firstSound, firstSoundSkip, offeredReading, readingUnit } from '../englishReading.ts';

test('a first sound is the first letter, except where the letter is not the sound', () => {
  const cases: [string, string | null][] = [
    ['girl', 'g'], ['green', 'g'], ['giraffe', null], ['chair', null], ['three', null],
    ['apples', null], ['eraser', null], ['one', null], ['orange', null],
    ['T-shirt', 't'], ['pencil case', 'p'], ['yoyo', 'y'], ['cat', 'c'], ['whiteboard', 'w'],
  ];
  for (const [word, letter] of cases) assert.equal(firstSound(word), letter, word);
  assert.equal(firstSoundSkip('giraffe'), 'soft-g');
  assert.equal(firstSoundSkip('chair'), 'digraph');
  assert.equal(firstSoundSkip('apples'), 'vowel');
  assert.equal(firstSoundSkip('cereal'), 'soft-c');
  assert.equal(firstSoundSkip('girl'), null);
});

test('over the 10 lessons, exactly the words the spec names are left out', () => {
  const out = new Set(hubLessonsForGrade(1).flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en)));
  assert.deepEqual([...out].sort(), ['apples', 'arms', 'chair', 'eight', 'eraser', 'giraffe', 'one', 'orange', 'three']);
});

test('every Grade 1 hub lesson has one reading record, and nothing else does', () => {
  const ids = hubLessonsForGrade(1).map(l => l.id).sort();
  assert.deepEqual(READING_UNITS.map(u => u.lessonId).sort(), ids);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
});

test('every unit ships unreviewed, so nothing is offered', () => {
  for (const u of READING_UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
  }
  assert.equal(offeredReading('kbl-g2-eng-s1-nccd-u1_l1'), null);
  assert.equal(readingUnit('nope'), undefined);
});

test('a signed-off unit offers its lesson words', () => {
  const u = READING_UNITS[1];
  const saved = u.reviewedBy;
  u.reviewedBy = { name: 'test', date: '2026-10-17' };
  try {
    assert.deepEqual(offeredReading(u.lessonId)?.map(w => w.en), hubLessonsForGrade(1).find(l => l.id === u.lessonId)!.words.map(w => w.en));
  } finally {
    u.reviewedBy = saved;
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReading.test.ts`
Expected: FAIL — `Cannot find module '../englishReading.ts'`.

- [ ] **Step 3: Implement**

```ts
/**
 * Grade 1 reading for the English corner: a word's first sound, and the
 * per-unit sign-off that keeps the reading activities hidden.
 *
 * Spec: docs/superpowers/specs/2026-10-17-english-corner-reading-g1-design.md.
 * The book's Listening objectives ask for "the initial sound in simple words";
 * the activities ask which letter a word starts with, so a word may only be
 * asked about where its first letter IS its first sound. A rule decides that,
 * and `SOFT_G` lists by hand what the spelling cannot: «girl» and «giraffe» are
 * both g + i. A teacher reads the result (docs/english-reading-g1-review.html)
 * and a unit is offered to nobody until `reviewedBy` is set — the only switch.
 *
 * Free of react-native.
 */
import { hubLesson, type HubWord } from './englishHub.ts';

export type SoundSkip = 'vowel' | 'digraph' | 'soft-c' | 'soft-g';

/** Soft-g words, by hand: a `g` word not listed here is read as hard. */
export const SOFT_G: ReadonlySet<string> = new Set(['giraffe']);

/** Why a word has no first sound to ask about, or null when it has one. */
export function firstSoundSkip(word: string): SoundSkip | null {
  const w = word.trim().toLowerCase();
  // A vowel letter has too many sounds for "starts with": apples, arms, eraser, eight, one.
  if (/^[aeiou]/.test(w)) return 'vowel';
  if (/^(ch|sh|th|ph|kn|wr)/.test(w)) return 'digraph';
  if (/^c[eiy]/.test(w)) return 'soft-c';
  if (SOFT_G.has(w)) return 'soft-g';
  return null;
}

/** The letter a word starts with when that letter is its first sound, lower-case; otherwise null. */
export function firstSound(word: string): string | null {
  if (firstSoundSkip(word)) return null;
  const c = word.trim().toLowerCase()[0] ?? '';
  return /[a-z]/.test(c) ? c : null;
}

export interface ReadingUnit {
  lessonId: string;
  /** A teacher's sign-off of the printed form. `null` → the unit is offered to nobody. */
  reviewedBy: { name: string; date: string } | null;
}

export const READING_UNITS: ReadingUnit[] = [
  { lessonId: 'kbl-g1-eng-s1-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u1_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u2_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u3_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u4_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u5_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u6_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u7_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u8_l1', reviewedBy: null },
];

export function readingUnit(lessonId: string): ReadingUnit | undefined {
  return READING_UNITS.find(u => u.lessonId === lessonId);
}

/** The lesson's words once a teacher has signed the unit off; null before, and for any other lesson. */
export function offeredReading(lessonId: string): HubWord[] | null {
  const unit = readingUnit(lessonId);
  return unit?.reviewedBy ? hubLesson(lessonId)?.words ?? null : null;
}
```

Add to `lib/curriculum/package.json` exports, after `./englishGrammar`:

```json
    "./englishReading": "./src/englishReading.ts",
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReading.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/curriculum/src/englishReading.ts lib/curriculum/src/__tests__/englishReading.test.ts lib/curriculum/package.json
git commit -m "feat(curriculum): first sounds for Grade 1 reading, hidden per unit until signed off"
```

---

### Task 2: The teacher's reading review form

**Files:**
- Create: `lib/curriculum/src/englishReadingReview.ts`
- Modify: `lib/curriculum/scripts/grammar-sheet.ts`
- Create (generated): `docs/english-reading-g1-review.html`
- Test: `lib/curriculum/src/__tests__/englishReading.test.ts` (append)

**Interfaces:**
- Consumes: `READING_UNITS`, `firstSound`, `firstSoundSkip` (Task 1); `hubLesson` (`englishHub.ts`); `wordPicture` (`englishPictures.ts`).
- Produces: `renderReadingReviewHtml(): string` — a complete standalone HTML document.

- [ ] **Step 1: Write the failing test** (append to `englishReading.test.ts`)

```ts
test("the teacher's reading form lists every word once per unit, and the committed copy is current", async () => {
  const { readFileSync } = await import('node:fs');
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml();
  const lessons = hubLessonsForGrade(1);
  const words = lessons.flatMap(l => l.words);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, words.length);
  // Every word the app may ask about shows its letter; every left-out word shows why.
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, words.filter(w => firstSound(w.en)).length);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, words.filter(w => !firstSound(w.en)).length);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, READING_UNITS.length);
  const committed = readFileSync(new URL('../../../../docs/english-reading-g1-review.html', import.meta.url), 'utf8');
  assert.equal(committed, html, 'stale: run pnpm --filter @workspace/curriculum run grammar-sheet');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReading.test.ts`
Expected: FAIL — `Cannot find module '../englishReadingReview.ts'`.

- [ ] **Step 3: Implement `englishReadingReview.ts`**

Same page shell, tokens and print rules as `englishGrammarReview.ts` (copy its `<style>` block verbatim, then replace the table-specific rules shown below); the per-unit table has columns: #, الكلمة, الصورة, الحرف الأول, ✓, ملاحظات.

```ts
/**
 * The teacher's printable review form for the Grade 1 reading activities: per
 * unit, every word with its picture and the letter the app will call its
 * first sound, the words left out with the reason, a tick box and notes per
 * word, and a sign-off strip. A4 landscape, one unit per page.
 *
 * Built from the same data as the app (`firstSound`, `wordPicture`), so it
 * cannot drift from what children see. `scripts/grammar-sheet.ts` writes it to
 * docs/english-reading-g1-review.html, and a test fails when that copy is stale.
 */
import { READING_UNITS, firstSound, firstSoundSkip, type ReadingUnit, type SoundSkip } from './englishReading.ts';
import { hubLesson } from './englishHub.ts';
import { wordPicture } from './englishPictures.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AR_DIGITS = (n: number) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** «٨ كلمات», «١٦ كلمة»: Arabic counts 3–10 with the plural. */
const wordCountAr = (n: number) => `${AR_DIGITS(n)} ${n >= 3 && n <= 10 ? 'كلمات' : 'كلمة'}`;

const SKIP_AR: Record<SoundSkip, string> = {
  vowel: 'لا تُستعمل: تبدأ بحرف علّة، وله أكثر من صوت',
  digraph: 'لا تُستعمل: أول حرفين صوت واحد (ch / sh / th)',
  'soft-c': 'لا تُستعمل: c تُلفظ s هنا',
  'soft-g': 'لا تُستعمل: g تُلفظ j هنا',
};

function renderUnit(u: ReadingUnit): string {
  const lesson = hubLesson(u.lessonId)!;
  const rows = lesson.words.map((w, i) => {
    const pic = wordPicture(w.en);
    const letter = firstSound(w.en);
    const skip = firstSoundSkip(w.en);
    const third = letter
      ? `<td class="letter" dir="ltr">${letter}</td>`
      : `<td class="skip">${skip ? SKIP_AR[skip] : 'لا تُستعمل'}</td>`;
    return `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="word" dir="ltr">${esc(w.en)}</td>
          <td>${pic ? `<span class="pic-art">${pic}</span>` : '<span class="none">بلا صورة</span>'}</td>
          ${third}
          <td class="tick"><span class="box" aria-hidden="true"></span></td>
          <td class="note"></td>
        </tr>`;
  }).join('');
  const sem = lesson.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  return `
  <section class="unit" id="${esc(u.lessonId)}">
    <header class="unit-head">
      <div class="unit-meta"><span>${sem}</span><span>الوحدة ${AR_DIGITS(lesson.unitNumber)}</span><span>${wordCountAr(lesson.words.length)}</span></div>
      <h2><span dir="ltr">${esc(lesson.unitTitle)}</span> <span class="unit-ar">${esc(lesson.unitTitleAr)}</span></h2>
    </header>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الكلمة</th>
            <th>الصورة</th>
            <th>الحرف الأول<small>كما يظهر للطالب</small></th>
            <th class="tick">✓</th>
            <th class="note">ملاحظات</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>
    <div class="signoff">
      <div class="verdict">
        <span><span class="box" aria-hidden="true"></span> موافق كما هي</span>
        <span><span class="box" aria-hidden="true"></span> موافق بعد التعديلات المكتوبة</span>
        <span><span class="box" aria-hidden="true"></span> غير موافق</span>
      </div>
      <div class="lines">
        <span>الاسم: <i></i></span>
        <span>التاريخ: <i></i></span>
        <span>التوقيع: <i></i></span>
      </div>
    </div>
  </section>`;
}
```

`renderReadingReviewHtml()` builds the page exactly like `renderGrammarReviewHtml()` (same `<!doctype html>` wrapper, `<title>مراجعة قراءة الصف الأول</title>`, fonts, `:root` tokens, dark-mode blocks, `@page A4 landscape`, print rules), with these intro texts:

- eyebrow «اقرأ · ركن اللغة الإنجليزية · الصف الأول»; h1 «مراجعة أنشطة القراءة قبل عرضها على الطلاب».
- lead: «أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة قراءة مبنية على كلمات كل وحدة وصورها وتسجيلاتها، وعلى هدف الكتاب: تمييز الصوت الأول في الكلمة. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b>»
- three `.act` boxes: «اقرَأ واختر الصورة» — «تظهر الكلمة مكتوبة دون صوت، ويختار الطالب صورتها من ثلاث صور. تُسمع الكلمة بعد الإجابة.»; «الحرف الأول» — «يسمع الطالب الكلمة ويرى صورتها، ويختار حرفها الأول من ثلاثة أحرف. لا تُكتب الكلمة.»; «يبدأ بهذا الحرف» — «يظهر حرف، ويختار الطالب الصورة التي يبدأ اسمها بصوته من ثلاث صور.»
- card «ما المطلوب في كل كلمة»: ١ هل الحرف المكتوب هو فعلًا أول صوت يسمعه الطالب في الكلمة؟ ٢ هل الصورة تدل على الكلمة دون لبس؟ ٣ هل توافقون على استبعاد الكلمات المستبعدة، أو تريدون إضافة إحداها؟
- card «طريقة التعبئة»: the same three bullets as the grammar form, with «الجملة» → «الكلمة».

Table CSS replacing the grammar form's sentence/choose rules:

```css
  td.word { font-family: var(--latin); font-size: 1.05rem; font-weight: 500; text-align: left; white-space: nowrap; }
  td.letter { font-family: var(--latin); font-size: 1.35rem; font-weight: 700; color: var(--teal); text-align: center; }
  td.skip { color: var(--muted); font-size: .85rem; }
  .pic-art { font-size: 1.45rem; letter-spacing: 2px; font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
```

Modify `lib/curriculum/scripts/grammar-sheet.ts`: import `renderReadingReviewHtml` from `../src/englishReadingReview.ts`, add `['english-reading-g1-review.html', renderReadingReviewHtml()]` to the list, and extend its header comment ("…and the reading form to docs/english-reading-g1-review.html").

- [ ] **Step 4: Generate the form and run the tests**

Run: `pnpm --filter @workspace/curriculum run grammar-sheet && cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReading.test.ts src/__tests__/englishGrammar.test.ts`
Expected: three `wrote docs/…` lines; PASS (the grammar files unchanged).

- [ ] **Step 5: Look at it in a browser** — Playwright screenshot of `docs/english-reading-g1-review.html` (`executablePath: '/opt/pw-browsers/chromium'`), screen and print (`page.pdf({ landscape: true, format: 'A4' })`). Check: the Latin letter and word sit LTR inside the RTL table; the unit meta line's Arabic digits are not merged (each in its own span); one unit per printed page.

- [ ] **Step 6: Commit**

```bash
git add lib/curriculum/src/englishReadingReview.ts lib/curriculum/scripts/grammar-sheet.ts lib/curriculum/src/__tests__/englishReading.test.ts docs/english-reading-g1-review.html
git commit -m "feat(curriculum): the teacher's printable review form for Grade 1 reading"
```

---

### Task 3: Round builders

**Files:**
- Modify: `artifacts/mobile/services/englishHub/games.ts`
- Test: `artifacts/mobile/services/__tests__/englishReadingGames.test.ts`

**Interfaces:**
- Consumes: `firstSound` from `@workspace/curriculum/englishReading`; `HubWord`; existing `sample`, `shuffle`, `isPicturable`, `wordPicture`, `ROUND_LENGTH`, `lessonHasPictureMatch`.
- Produces:
  - `HubActivity` gains `'read-find' | 'first-letter' | 'starts-with'`
  - `READING_ACTIVITIES: HubActivity[]` = `['read-find', 'first-letter', 'starts-with']`
  - `READING_OPTIONS = 3`
  - `interface ReadFindQuestion { word: HubWord; options: string[]; answerIndex: number }` — options are English words, each picturable, pictures distinct
  - `buildReadFindRound(words, rng?): ReadFindQuestion[]`
  - `interface FirstLetterQuestion { word: HubWord; options: string[]; answerIndex: number }` — options are single lower-case letters
  - `buildFirstLetterRound(words, rng?): FirstLetterQuestion[]`
  - `interface StartsWithQuestion { letter: string; word: HubWord; options: string[]; answerIndex: number }` — options are English words, each picturable
  - `buildStartsWithRound(words, rng?): StartsWithQuestion[]`
  - `readingActivityAvailable(activity: HubActivity, words: readonly HubWord[]): boolean`
  - `SCORED_ACTIVITIES` includes the three

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Round builders for the Grade 1 reading activities. Like grammar, the builders
 * do not gate on review — the lesson screen's `offeredReading` does — so they
 * are tested over every Grade 1 lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hubLessonsForGrade, type HubWord } from '@workspace/curriculum/englishHub';
import { firstSound } from '@workspace/curriculum/englishReading';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  READING_ACTIVITIES,
  READING_OPTIONS,
  ROUND_LENGTH,
  buildFirstLetterRound,
  buildReadFindRound,
  buildStartsWithRound,
  isPicturable,
  lessonStars,
  readingActivityAvailable,
  recordResult,
  wordPicture,
} from '../englishHub/games.ts';

const LESSONS = hubLessonsForGrade(1);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('Read and find', () => {
  it('asks a pictured word, offers three distinct pictures, the right one at answerIndex', () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      const round = buildReadFindRound(l.words, makeRng(seed));
      assert.equal(round.length, Math.min(ROUND_LENGTH, l.words.filter(w => isPicturable(w.en)).length), l.id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(q.options[q.answerIndex], q.word.en);
        assert.ok(q.options.every(isPicturable), `${l.id} ${q.options}`);
        assert.equal(new Set(q.options.map(wordPicture)).size, READING_OPTIONS);
      }
    }
  });
});

describe('First letter', () => {
  it("asks only words with a first sound; the answer is that sound; three distinct letters, no b/d or p/q pair", () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      for (const q of buildFirstLetterRound(l.words, makeRng(seed))) {
        const letter = firstSound(q.word.en);
        assert.ok(letter, q.word.en);
        assert.equal(q.options[q.answerIndex], letter);
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(new Set(q.options).size, READING_OPTIONS);
        assert.ok(q.options.every(o => /^[a-z]$/.test(o)));
        const has = (c: string) => q.options.includes(c);
        assert.ok(!(has('b') && has('d')), `${q.word.en} ${q.options}`);
        assert.ok(!(has('p') && has('q')), `${q.word.en} ${q.options}`);
      }
    }
  });
});

describe('Starts with', () => {
  it('exactly one option starts with the shown letter; no two share a first letter; all pictured', () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      const round = buildStartsWithRound(l.words, makeRng(seed));
      assert.ok(round.length > 0, l.id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(q.options[q.answerIndex], q.word.en);
        assert.equal(firstSound(q.word.en), q.letter);
        const letters = q.options.map(firstSound);
        assert.ok(letters.every(Boolean), `${q.options}`);
        assert.equal(new Set(letters).size, READING_OPTIONS, `${q.options}`);
        assert.ok(q.options.every(isPicturable));
      }
    }
  });
});

describe('availability', () => {
  it('all three are available on all 10 lessons today', () => {
    for (const l of LESSONS) for (const a of READING_ACTIVITIES) assert.ok(readingActivityAvailable(a, l.words), `${l.id} ${a}`);
  });

  it('each is unavailable one short of its floor', () => {
    const w = (en: string): HubWord => ({ en, ar: '' });
    // three pictured words
    assert.equal(readingActivityAvailable('read-find', ['cat', 'dad', 'mum'].map(w)), false);
    assert.equal(readingActivityAvailable('read-find', ['cat', 'dad', 'mum', 'boy'].map(w)), true);
    // three words with a first sound (apples has none)
    assert.equal(readingActivityAvailable('first-letter', ['cat', 'dad', 'mum', 'apples'].map(w)), false);
    assert.equal(readingActivityAvailable('first-letter', ['cat', 'dad', 'mum', 'boy'].map(w)), true);
    // two distinct letters among pictured words (dad/doll share d)
    assert.equal(readingActivityAvailable('starts-with', ['dad', 'doll', 'mum', 'apples'].map(w)), false);
    assert.equal(readingActivityAvailable('starts-with', ['dad', 'doll', 'mum', 'cat'].map(w)), true);
    assert.equal(readingActivityAvailable('listen', ['cat', 'dad', 'mum', 'boy'].map(w)), false);
  });
});

it('reading stars count toward the lesson', () => {
  let p = EMPTY_PROGRESS;
  for (const a of READING_ACTIVITIES) p = recordResult(p, LESSONS[0].id, a, 2, '2026-10-17');
  assert.equal(lessonStars(p, LESSONS[0].id), 6);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishReadingGames.test.ts`
Expected: FAIL — missing exports (`READING_ACTIVITIES`, …).

- [ ] **Step 3: Implement in `games.ts`**

Header comment: change "The English hub's four activities" sentence to "The English hub's activities". Add the import:

```ts
import { firstSound } from '@workspace/curriculum/englishReading';
```

Extend the type and lists:

```ts
export type HubActivity =
  | 'flashcards' | 'listen' | 'match' | 'spell' | 'scramble' | 'picture' | 'speaking'
  | 'grammar-choose' | 'grammar-build' | 'grammar-true'
  | 'read-find' | 'first-letter' | 'starts-with';
/** The reading activities, offered only on a Grade 1 lesson whose unit a teacher has reviewed (`offeredReading`). */
export const READING_ACTIVITIES: HubActivity[] = ['read-find', 'first-letter', 'starts-with'];
```

New section, placed after the grammar section and before `starsFor`:

```ts
// ─── Reading (Grade 1) ──────────────────────────────────────────────────────
//
// The words are the lesson's own. These builders do not gate on a teacher's
// review — the lesson screen asks `offeredReading`. A word's first sound comes
// from `firstSound` in `@workspace/curriculum/englishReading`, never from here.

/** Three, not four: a six-year-old reading, not guessing. */
export const READING_OPTIONS = 3;
/** Letters a First letter question is padded with when its lesson has too few of its own. */
const PAD_LETTERS = ['b', 'd', 'f', 'h', 'l', 'm', 'n', 'p', 'r', 's', 't'];
/** Shapes a six-year-old confuses: side by side they test eyesight, not hearing. */
const MIRROR: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };
const MIN_FIRST_SOUND_WORDS = 4;
const MIN_STARTS_WITH_LETTERS = 3;

export interface ReadFindQuestion {
  word: HubWord;
  /** English words, each with its own picture; one is `word.en`. */
  options: string[];
  answerIndex: number;
}

/** Read the printed word, tap its picture. Pictures are distinct, so no option shows the answer's. */
export function buildReadFindRound(words: readonly HubWord[], rng: () => number = Math.random): ReadFindQuestion[] {
  const pool = words.filter(w => isPicturable(w.en));
  return sample(pool, ROUND_LENGTH, rng).map(word => {
    const others = pool.filter(w => wordPicture(w.en) !== wordPicture(word.en)).map(w => w.en);
    const options = shuffle([word.en, ...sample(others, READING_OPTIONS - 1, rng)], rng);
    return { word, options, answerIndex: options.indexOf(word.en) };
  });
}

export interface FirstLetterQuestion {
  word: HubWord;
  /** Single lower-case letters; one is the word's first sound. */
  options: string[];
  answerIndex: number;
}

/** The two wrong letters: the lesson's own first letters first, then the pad — never the answer's mirror. */
function letterDistractors(answer: string, lessonLetters: readonly string[], rng: () => number): string[] {
  const picked: string[] = [];
  const ok = (c: string) => c !== answer && c !== MIRROR[answer] && !picked.includes(c) && !picked.some(p => MIRROR[p] === c);
  for (const c of [...shuffle([...lessonLetters], rng), ...shuffle(PAD_LETTERS, rng)]) {
    if (picked.length === READING_OPTIONS - 1) break;
    if (ok(c)) picked.push(c);
  }
  return picked;
}

/** Hear the word (and see its picture, when it has one), tap the letter it starts with. */
export function buildFirstLetterRound(words: readonly HubWord[], rng: () => number = Math.random): FirstLetterQuestion[] {
  const pool = words.filter(w => firstSound(w.en));
  const lessonLetters = [...new Set(pool.map(w => firstSound(w.en)!))];
  return sample(pool, ROUND_LENGTH, rng).map(word => {
    const answer = firstSound(word.en)!;
    const options = shuffle([answer, ...letterDistractors(answer, lessonLetters, rng)], rng);
    return { word, options, answerIndex: options.indexOf(answer) };
  });
}

export interface StartsWithQuestion {
  /** The letter shown, lower-case — `firstSound(word.en)`. */
  letter: string;
  word: HubWord;
  /** English words, each pictured; no two start with the same sound. */
  options: string[];
  answerIndex: number;
}

function startsWithPool(words: readonly HubWord[]): HubWord[] {
  return words.filter(w => isPicturable(w.en) && firstSound(w.en));
}

/** See a letter, tap the picture whose word starts with it. Exactly one option does. */
export function buildStartsWithRound(words: readonly HubWord[], rng: () => number = Math.random): StartsWithQuestion[] {
  const pool = startsWithPool(words);
  return sample(pool, ROUND_LENGTH, rng).flatMap(word => {
    const letter = firstSound(word.en)!;
    const chosen: HubWord[] = [];
    for (const w of shuffle(pool, rng)) {
      if (chosen.length === READING_OPTIONS - 1) break;
      const seen = [letter, ...chosen.map(c => firstSound(c.en))];
      if (!seen.includes(firstSound(w.en))) chosen.push(w);
    }
    // Unreachable while `readingActivityAvailable` holds (three letters guarantee two others).
    if (chosen.length < READING_OPTIONS - 1) return [];
    const options = shuffle([word.en, ...chosen.map(c => c.en)], rng);
    return [{ letter, word, options, answerIndex: options.indexOf(word.en) }];
  });
}

export function readingActivityAvailable(activity: HubActivity, words: readonly HubWord[]): boolean {
  if (activity === 'read-find') return lessonHasPictureMatch(words);
  if (activity === 'first-letter') return words.filter(w => firstSound(w.en)).length >= MIN_FIRST_SOUND_WORDS;
  if (activity === 'starts-with') return new Set(startsWithPool(words).map(w => firstSound(w.en))).size >= MIN_STARTS_WITH_LETTERS;
  return false;
}
```

Extend `SCORED_ACTIVITIES`:

```ts
const SCORED_ACTIVITIES = [
  'listen', 'match', 'spell', 'scramble', 'picture', 'grammar-choose', 'grammar-build', 'grammar-true',
  'read-find', 'first-letter', 'starts-with',
] as const;
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishReadingGames.test.ts services/__tests__/englishGrammarGames.test.ts`
Expected: PASS. Then `pnpm test` in `artifacts/mobile` — all pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/englishHub/games.ts artifacts/mobile/services/__tests__/englishReadingGames.test.ts
git commit -m "feat(english-hub): round builders for Grade 1 reading"
```

---

### Task 4: The screens

**Files:**
- Create: `artifacts/mobile/components/englishHub/ReadingActivities.tsx`
- Modify: `artifacts/mobile/components/englishHub/GrammarActivities.tsx` (export `Feedback`)
- Modify: `artifacts/mobile/app/curriculum/english/[lessonId].tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: Task 3's builders and question types; `HearButton`, `Progress`, `RIGHT`, `WRONG` from `./Activities`; `Feedback` from `./GrammarActivities`; `offeredReading` from `@workspace/curriculum/englishReading`.
- Produces: components `ReadFind`, `FirstLetter`, `StartsWith`, each `({ words: readonly HubWord[]; onFinish: (correct: number, total: number) => void })`.

- [ ] **Step 1: i18n keys** — in the Arabic block after `hubGIsFalse: 'خطأ',`:

```ts
    hubReading: 'القراءة',
    hubRFind: 'اقرأ واختر الصورة',
    hubRFindDesc: 'اقرأ الكلمة ثم اختر صورتها',
    hubRLetter: 'الحرف الأول',
    hubRLetterDesc: 'اسمع الكلمة واختر الحرف الذي تبدأ به',
    hubRStarts: 'يبدأ بهذا الحرف',
    hubRStartsDesc: 'أيّ صورة تبدأ بصوت هذا الحرف؟',
```

and in the English block after `hubGIsFalse: 'False',`:

```ts
    hubReading: 'Reading',
    hubRFind: 'Read and find',
    hubRFindDesc: 'Read the word, then tap its picture',
    hubRLetter: 'First letter',
    hubRLetterDesc: 'Hear the word, tap the letter it starts with',
    hubRStarts: 'Starts with',
    hubRStartsDesc: 'Which picture starts with this sound?',
```

- [ ] **Step 2: Export `Feedback`** from `GrammarActivities.tsx` (`function Feedback` → `export function Feedback`), unchanged otherwise.

- [ ] **Step 3: Write `ReadingActivities.tsx`**

```tsx
/**
 * The English corner's three Grade 1 reading activities: Read and find, First
 * letter, Starts with. Every decision with a right answer comes from
 * `services/englishHub/games.ts`; these only render and count.
 *
 * Letters and words are laid out left to right whatever the UI language. Audio
 * starts from a tap, as in `Activities.tsx`; a letter is never played.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HubWord } from '@workspace/curriculum/englishHub';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { playWord } from '@/services/englishAudio';
import { buildFirstLetterRound, buildReadFindRound, buildStartsWithRound, wordPicture } from '@/services/englishHub/games';
import { HearButton, Progress, RIGHT, WRONG } from './Activities';
import { Feedback } from './GrammarActivities';

type Finish = (correct: number, total: number) => void;

function buzz(ok: boolean) {
  void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** One question's pick → right/wrong → next bookkeeping, shared by all three. */
function useRound<Q extends { answerIndex: number }>(round: Q[], onFinish: Finish) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const pick = (k: number, then?: () => void) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === round[i].answerIndex;
    if (ok) setCorrect(c => c + 1);
    buzz(ok);
    then?.();
  };
  const next = (then?: (q: Q) => void) => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
    then?.(round[i + 1]);
  };
  return { q: round[i], i, picked, pick, next };
}

function tintFor(colors: ReturnType<typeof useColors>, picked: number | null, k: number, answer: number) {
  const shown = picked !== null && (k === answer || k === picked);
  const tint = !shown ? colors.border : k === answer ? RIGHT : WRONG;
  return { borderColor: tint, backgroundColor: shown ? tint + '18' : colors.card };
}

/** Three picture cards in one row, always left to right. */
function PictureChoices({ options, picked, answer, onPick }: { options: string[]; picked: number | null; answer: number; onPick: (k: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.choiceRow}>
      {options.map((o, k) => (
        <Pressable
          key={o}
          onPress={() => onPick(k)}
          accessibilityRole="button"
          // The label would read the answer out to a screen reader: number them instead.
          accessibilityLabel={String(k + 1)}
          style={[styles.pictureCard, tintFor(colors, picked, k, answer)]}
        >
          <Text style={styles.picture}>{wordPicture(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Read and find ──────────────────────────────────────────────────────────

export function ReadFind({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const round = useMemo(() => buildReadFindRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
      {/* Heard only once answered: before, the sound would do the reading. */}
      <PictureChoices options={q.options} picked={picked} answer={q.answerIndex} onPick={k => pick(k, () => void playWord(q.word.en))} />
      {picked !== null ? <Feedback ok={picked === q.answerIndex} answer={q.word.en} onNext={() => next()} sentence={q.word.en} /> : null}
    </View>
  );
}

// ─── First letter ───────────────────────────────────────────────────────────

export function FirstLetter({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const round = useMemo(() => buildFirstLetterRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  const pic = wordPicture(q.word.en);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      {pic ? <Text style={styles.picture}>{pic}</Text> : null}
      {/* The first word plays from this button; later ones from Next. The word is never printed before the answer. */}
      <HearButton word={q.word.en} big />
      <View style={styles.choiceRow}>
        {q.options.map((o, k) => (
          <Pressable key={o} onPress={() => pick(k)} style={[styles.letterCard, tintFor(colors, picked, k, q.answerIndex)]}>
            <Text style={[styles.letter, { color: colors.foreground }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {picked !== null ? (
        <>
          <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
          <Feedback ok={picked === q.answerIndex} answer={q.options[q.answerIndex]} onNext={() => next(n => void playWord(n.word.en))} sentence={q.word.en} />
        </>
      ) : null}
    </View>
  );
}

// ─── Starts with ────────────────────────────────────────────────────────────

export function StartsWith({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const { t } = useLanguage();
  const round = useMemo(() => buildStartsWithRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, textAlign: 'center' }}>{t('hubRStartsDesc')}</Text>
      <Text style={[styles.bigLetter, { color: colors.primary }]}>{q.letter}</Text>
      <PictureChoices options={q.options} picked={picked} answer={q.answerIndex} onPick={k => pick(k, () => void playWord(q.word.en))} />
      {picked !== null ? (
        <>
          <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
          <Feedback ok={picked === q.answerIndex} answer={q.word.en} onNext={() => next()} sentence={q.word.en} />
        </>
      ) : null}
    </View>
  );
}

/** Pictures are artwork, sized as in `Activities.tsx`; letters are larger than any word so a six-year-old can see the shape. */
const PICTURE_SIZE = 64;

const styles = StyleSheet.create({
  page: { gap: 16, alignItems: 'center' },
  // A physical row, never flipped for Arabic: the options are English.
  choiceRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  pictureCard: { width: 96, height: 96, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  picture: { fontSize: PICTURE_SIZE, lineHeight: PICTURE_SIZE + 12, textAlign: 'center' },
  letterCard: { width: 80, height: 80, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: 'ReadexPro_700Bold', fontSize: 40, writingDirection: 'ltr' },
  bigLetter: { fontFamily: 'ReadexPro_700Bold', fontSize: 72, lineHeight: 88, writingDirection: 'ltr' },
  bigWord: { fontFamily: 'ReadexPro_700Bold', fontSize: 36, textAlign: 'center', writingDirection: 'ltr' },
});
```

- [ ] **Step 4: Wire into the lesson screen** — in `[lessonId].tsx`:

  - header comment: "…its grammar activities once a teacher has reviewed the unit (`offeredGrammar`), likewise its Grade 1 reading activities (`offeredReading`), and the end-of-round card."
  - imports:

```ts
import { offeredReading } from '@workspace/curriculum/englishReading';
import { GRAMMAR_ACTIVITIES, HUB_ACTIVITIES, READING_ACTIVITIES, dayOf, grammarActivityAvailable, lessonHasPictureMatch, newlyEarnedBadges, progressKey, readingActivityAvailable, recordResult, starsFor, type BadgeId, type HubActivity } from '@/services/englishHub/games';
import { FirstLetter, ReadFind, StartsWith } from '@/components/englishHub/ReadingActivities';
```

  - META entries:

```ts
  'read-find': { icon: 'book-outline', title: 'hubRFind', desc: 'hubRFindDesc' },
  'first-letter': { icon: 'text-outline', title: 'hubRLetter', desc: 'hubRLetterDesc' },
  'starts-with': { icon: 'search-outline', title: 'hubRStarts', desc: 'hubRStartsDesc' },
```

  - beside `grammar`: `const reading = useMemo(() => offeredReading(lessonId ?? ''), [lessonId]);`
  - in `body()` after the grammar routes:

```tsx
    if (reading && activity === 'read-find') return <ReadFind key={round} words={reading} onFinish={finish} />;
    if (reading && activity === 'first-letter') return <FirstLetter key={round} words={reading} onFinish={finish} />;
    if (reading && activity === 'starts-with') return <StartsWith key={round} words={reading} onFinish={finish} />;
```

  - cards: `const readingCards = reading ? READING_ACTIVITIES.filter(a => readingActivityAvailable(a, reading)) : [];` and render a «القراءة» section after the vocabulary cards and before «القواعد»:

```tsx
        {readingCards.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.foreground, textAlign: align }]}>{t('hubReading')}</Text>
            {readingCards.map(card)}
          </>
        ) : null}
```

- [ ] **Step 5: Typecheck** — `pnpm run typecheck` at the root. Expected: no errors.

- [ ] **Step 6: Check it in a browser.** Locally only (never committed), set `reviewedBy` on `READING_UNITS` for S1 U1 and S2 U7, build web (`cd artifacts/mobile && EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), serve with `e2e/serve.mjs` on 8098, and with Playwright (Chromium at `/opt/pw-browsers/chromium`, `localStorage` `@iqra_intro_seen_v1`, `@iqra_language` `ar` then `en`, 4.5 s splash wait) open `/curriculum/english/kbl-g1-eng-s1-nccd-u1_l1`: the «القراءة» section appears above «القواعد» only for the signed units; play one question of each activity; screenshot. Check the letter and words sit LTR, the feedback line keeps the English answer whole, and an unsigned lesson (S1 U2) shows no reading section. Then `git checkout lib/curriculum/src/englishReading.ts` and confirm `git diff` is empty there.

- [ ] **Step 7: Run all affected tests**

Run: `cd artifacts/mobile && pnpm test` and `pnpm --filter @workspace/curriculum test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/components/englishHub/ReadingActivities.tsx artifacts/mobile/components/englishHub/GrammarActivities.tsx "artifacts/mobile/app/curriculum/english/[lessonId].tsx" artifacts/mobile/services/i18n.ts
git commit -m "feat(english-hub): Grade 1 reading screens, shown per unit once signed off"
```

---

### Task 5: STATUS.md

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1:** Add a section «Grade 1 reading in the English corner» beside «Grade 1 grammar in the English corner»: what the three activities are; first sound = rule + `SOFT_G`, with the 9 words left out; hidden per unit by `READING_UNITS[].reviewedBy`; the teacher signs `docs/english-reading-g1-review.html` (regenerate with `pnpm --filter @workspace/curriculum run grammar-sheet`; a test pins it); medial/final sounds and letter recordings not done. Add «sign the reading form, then set `reviewedBy` in `englishReading.ts`» to the existing sign-off checklist.

- [ ] **Step 2:** Mark this plan's spec as implemented: change its **Status** line to «implemented (PR #1120)».

- [ ] **Step 3: Commit**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-17-english-corner-reading-g1-design.md
git commit -m "docs: Grade 1 reading in STATUS.md"
```

---

## Spec deviations (decided while planning)

- `renderReadingReviewHtml` lives in its own `englishReadingReview.ts`, not `englishReading.ts` — the same split as grammar (`englishGrammar.ts` / `englishGrammarReview.ts`), so the app's import never carries the form's HTML.
- First letter's word "plays once on arrival" from the second question on (from Next). The first question plays from the big «hear» button, because a browser refuses audio no tap started — the same rule every hub activity follows.

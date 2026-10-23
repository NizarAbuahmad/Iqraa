# English corner: Grade 3 reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 8 Grade 3 hub lessons the reading activities (word activities on all 8, «Read the sentence» on 3), all hidden until a teacher signs the printed form.

**Architecture:** Grade 2's design applied to Grade 3 data. Eight `READING_UNITS` rows (all `reviewedBy: null`); `readSentencePool`'s grade test widens from Grade 2 to Grades 2 and 3; the teacher form gets Grade 3 copy and a Grade 3 not-covered table. The app's round builder, screen and strings are grade-agnostic and are expected to need no change.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script that writes the printable forms.

**Spec:** `docs/superpowers/specs/2026-10-22-english-corner-reading-g3-design.md`

## Global Constraints

- Every Grade 3 `READING_UNITS` row ships `reviewedBy: null`; no sign-off is ever committed.
- Grade 1 reading stays excluded from «Read the sentence» (the grade test is `2 | 3`, not `>= 2`).
- The Grade 1 and Grade 2 reading forms (`docs/english-reading-g1-review.html`, `docs/english-reading-g2-review.html`) and all four Grade 1/2 grammar files stay byte-identical.
- `READING_NOT_COVERED_*` text is form-safe: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`; push only to `ccr-d9db5f6c-mgwkuo`; run `pnpm run typecheck` before committing a task.

## File Structure

- Modify `lib/curriculum/src/englishReading.ts`: rows, pool grade test, `READING_NOT_COVERED_G3`.
- Modify `lib/curriculum/src/englishReadingReview.ts`: Grade 3 copy; sentence section for Grades 2 and 3.
- Modify `lib/curriculum/scripts/grammar-sheet.ts`: write the Grade 3 reading form.
- Create `lib/curriculum/src/__tests__/englishReadingG3.test.ts`; create `artifacts/mobile/services/__tests__/englishReadingG3Games.test.ts`.
- Generate `docs/english-reading-g3-review.html`.
- Docs: top of `docs/status-log.md`, one index line in `STATUS.md`, spec status.

---

### Task 1: Rows, pool and not-covered table

**Files:**
- Modify: `lib/curriculum/src/englishReading.ts`
- Test: `lib/curriculum/src/__tests__/englishReadingG3.test.ts`

**Interfaces:**
- Consumes: `hubLessonsForGrade`, `readSentencePool`, `sentencePartner`, `firstSound`, `firstSoundSkip`, `offeredReading`, `offeredReadingSentences`, `readingUnitsForGrade`.
- Produces: eight Grade 3 rows in `READING_UNITS`; `READING_NOT_COVERED_G3: Record<string, string[]>` keyed by the seven lessons S1 U2, U3, U4 and S2 U7, U8, U9, U10.

- [ ] **Step 1: Write the failing test** — create `lib/curriculum/src/__tests__/englishReadingG3.test.ts`:

```ts
/**
 * Grade 3 reading (spec: docs/superpowers/specs/2026-10-22-english-corner-reading-g3-design.md):
 * the unit rows, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  READING_NOT_COVERED_G3, READING_UNITS, distinctPictureWords, firstSound, firstSoundSkip,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G3 = hubLessonsForGrade(3);
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 3), L(1, 5), L(2, 9)];

test('every Grade 3 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(3).map(u => u.lessonId).sort(), G3.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(3).length, 8);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(3)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('the Grade 1 first-sound rule needs no new exception: it leaves out exactly these 20 Grade 3 words', () => {
  const out = G3.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en));
  assert.equal(out.length, 20);
  assert.deepEqual([...out].sort(), [
    'afternoon', 'evening', 'shirt', 'phone', 'Thursday', 'astronaut', 'chef', 'artist', 'underground',
    'chicken', 'sheep', 'old', 'shampoo', 'armchair', 'in front of', 'opposite', 'giraffe', 'elephant', 'eagle',
    'ice lolly',
  ].sort());
  for (const w of out) assert.ok(firstSoundSkip(w), w);
});

test('the sentence pool exists for exactly S1 U3, S1 U5 and S2 U9, and Grade 2 is unchanged', () => {
  const withPool = G3.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.deepEqual(ELIGIBLE.map(id => readSentencePool(id).length), [26, 22, 18]);
  assert.deepEqual(ELIGIBLE.map(id => distinctPictureWords(readSentencePool(id))), [12, 16, 6]);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.equal(hubLessonsForGrade(2).filter(l => readSentencePool(l.id).length > 0).length, 7);
  for (const id of ELIGIBLE) for (const s of readSentencePool(id)) {
    assert.ok(s.picture, s.key);
    assert.equal(s.yesNo, null, s.key);
  }
});

test('partners: S1 U5 pairs the transport sentences he / she, S2 U9 pairs There is / There isn\'t, S1 U3 has none', () => {
  const partnered = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool));
  };
  const u5 = partnered(L(1, 5));
  assert.equal(u5.length, 12);
  assert.ok(u5.every(s => /goes to work by/.test(s.text)), 'only the transport sentences have a partner');
  assert.equal(partnered(L(2, 9)).length, 18);
  assert.equal(partnered(L(1, 3)).length, 0);
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
  const stars = readSentencePool(L(2, 9));
  assert.equal(sentencePartner(stars.find(s => s.text === "There's a door.")!, stars)!.text, "There isn't a door.");
  const work = readSentencePool(L(1, 5));
  assert.equal(sentencePartner(work.find(s => s.text === 'He goes to work by bus.')!, work)!.text, 'She goes to work by bus.');
});

test('the sentence activity needs reading, grammar and a Grade 2 or 3 lesson', () => {
  const id = L(1, 5);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  assert.equal(offeredReadingSentences(L(1, 2), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the seven lessons with a gap, in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G3).sort(),
    [L(1, 2), L(1, 3), L(1, 4), L(2, 7), L(2, 8), L(2, 9), L(2, 10)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G3)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @workspace/curriculum exec node --experimental-strip-types --test src/__tests__/englishReadingG3.test.ts`. Expected: FAIL (`READING_NOT_COVERED_G3` is not exported / no Grade 3 rows).

- [ ] **Step 3: Implement** in `lib/curriculum/src/englishReading.ts`:
  - Append after the Grade 2 rows (hub has no Grade 3 S1 U0/U1 or S2 U5/U6):
    ```ts
      // Grade 3 (spec: 2026-10-22-english-corner-reading-g3-design.md).
      { lessonId: 'kbl-g3-eng-s1-nccd-u2_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s1-nccd-u3_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s1-nccd-u4_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s1-nccd-u5_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s2-nccd-u7_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s2-nccd-u8_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s2-nccd-u9_l1', reviewedBy: null },
      { lessonId: 'kbl-g3-eng-s2-nccd-u10_l1', reviewedBy: null },
    ```
  - In `readSentencePool`: replace `if (hubLesson(lessonId)?.grade !== 2) return [];` with
    ```ts
    const grade = hubLesson(lessonId)?.grade;
    if (grade !== 2 && grade !== 3) return [];
    ```
    and update the section heading, the doc comments ("The Grade 2 or 3 grammar sentences…", "for another grade") and `offeredReadingSentences`'s comment ("for any Grade 1 lesson") to say Grades 2 and 3.
  - Append `READING_NOT_COVERED_G3` (Arabic, form-safe):
    ```ts
    /** Why a Grade 3 lesson has no «Read the sentence» for some or all of its sentences, or no picture activity — printed on the form. */
    export const READING_NOT_COVERED_G3: Record<string, string[]> = {
      'kbl-g3-eng-s1-nccd-u2_l1': [
        'لا صور لهذه الوحدة: كلماتها أفعال وعبارات، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
      ],
      'kbl-g3-eng-s1-nccd-u3_l1': [
        'sandals وpyjamas وtrainers وbaseball cap بلا صور، فلا تظهر جملها (٨ جمل) في «اقرَأ الجملة».',
      ],
      'kbl-g3-eng-s1-nccd-u4_l1': [
        'لا صور لهذه الوحدة: كلماتها أفعال وأيام وعبارات، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
      ],
      'kbl-g3-eng-s2-nccd-u7_l1': [
        'جمل الوحدة أسئلة عن أفعال بلا صور (brushing وcollecting…)، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة على أسماء الحيوانات.',
      ],
      'kbl-g3-eng-s2-nccd-u8_l1': [
        'لا صور لهذه الوحدة (tent وtorch وغيرهما)، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
      ],
      'kbl-g3-eng-s2-nccd-u9_l1': [
        'جمل «Is there a sofa? Yes, there is.» وأخواتها (١٢ جملة) لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
        'الغرف والأثاث بلا صور (armchair وbed وwardrobe وbookcase…) فلا تظهر جملها. تبقى ست كلمات مصورة، فالجولة ستة أسئلة لا ثمانية.',
      ],
      'kbl-g3-eng-s2-nccd-u10_l1': [
        'جمل الوحدة كلها «نعم أم لا» (٣٤ جملة) أو بلا صور (٤ جمل)، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة.',
      ],
    };
    ```

- [ ] **Step 4: Run to verify it passes** — the same command. Expected: PASS. Then `pnpm --filter @workspace/curriculum test` (existing Grade 1/2 reading tests unchanged and green).
- [ ] **Step 5: Typecheck and commit** — `pnpm run typecheck`, then `git add lib/curriculum/src/englishReading.ts lib/curriculum/src/__tests__/englishReadingG3.test.ts && git commit` with message `Grade 3 reading: unit rows, sentence pool and not-covered notes (all hidden)` plus the trailers.

---

### Task 2: The teacher's Grade 3 reading form

**Files:**
- Modify: `lib/curriculum/src/englishReadingReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`
- Generate: `docs/english-reading-g3-review.html`
- Test: `lib/curriculum/src/__tests__/englishReadingG3.test.ts` (append)

**Interfaces:**
- Consumes: `READING_NOT_COVERED_G3` (Task 1).
- Produces: `renderReadingReviewHtml(3)`; `docs/english-reading-g3-review.html`.

- [ ] **Step 1: Write the failing tests** — append to `englishReadingG3.test.ts`:

```ts
import { readFileSync } from 'node:fs';

const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 3 reading form lists every word and pool sentence once, with a not-covered block per gap', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(3);
  const words = G3.flatMap(l => l.words);
  assert.equal(words.length, 126);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 126);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, 106);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, 20);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 8);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 66);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 7);
  assert.ok(html.includes('مراجعة قراءة الصف الثالث'));
  assert.ok(html.includes('اقرَأ الجملة'));
  assert.ok(html.includes('<td class="sentence" dir="ltr">She goes to work by bus.</td>'));
  assert.ok(html.includes("<td class=\"sentence\" dir=\"ltr\">There isn&#39;t a door.</td>") || html.includes("There isn't a door."));
});

test('the committed Grade 3 reading form is exactly what the generator produces; Grades 1 and 2 are untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  assert.equal(readFileSync(new URL('english-reading-g3-review.html', docs), 'utf8'), renderReadingReviewHtml(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(new URL('english-reading-g2-review.html', docs), 'utf8'), renderReadingReviewHtml(2), 'Grade 2 form changed');
  assert.equal(readFileSync(new URL('english-reading-g1-review.html', docs), 'utf8'), renderReadingReviewHtml(1), 'Grade 1 form changed');
});
```

- [ ] **Step 2: Run to verify it fails** (`GRADE_COPY[3]` is undefined; the file is missing).
- [ ] **Step 3: Implement** in `englishReadingReview.ts`:
  - Import `READING_NOT_COVERED_G3`; add `const NOT_COVERED = { ...READING_NOT_COVERED_G2, ...READING_NOT_COVERED_G3 };` and have `sentenceSection` read `NOT_COVERED[lessonId]`.
  - In `renderUnit`, change `grade === 2 ? sentenceSection(...)` to `grade >= 2 ? sentenceSection(...)`.
  - Extract Grade 2's `extraCss` template into `const SENTENCE_CSS` (unchanged text) and its `acts` into `const ACTS_SENTENCE` (the ACT_FIND + ACT_LETTER + ACT_STARTS + «اقرَأ الجملة» string), so Grade 2's output stays byte-identical, then add `GRADE_COPY[3]`: same `acts`, `meta` and `extraCss` as Grade 2; `title: 'مراجعة قراءة الصف الثالث'`; `eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثالث'`; `lead` as Grade 2's wording with «الصف الثالث», its units/words/sentences/sentence-units, and one added sentence that three units have no pictures and keep only «الحرف الأول»; `checks`: `CHECKS_WORD`, then the three Grade 2 sentence checks reworded for Grade 3 (can a Grade 3 child read the whole sentence; do ✅/❌ read as «There's» / «There isn't» and the boy / girl pictures as «he» / «she»; does any picture leave the word in doubt), then «في وحدة Look at the stars ست كلمات مصورة فقط، فالجولة ستة أسئلة: هل يكفي هذا أم تفضلون إخفاء النشاط هناك؟».
- In `scripts/grammar-sheet.ts`: add `files.push(['english-reading-g3-review.html', renderReadingReviewHtml(3)]);` and extend the header comment.
- [ ] **Step 4: Generate and verify** — `pnpm --filter @workspace/curriculum run grammar-sheet`; `git status` must show only `docs/english-reading-g3-review.html` as new and **no change** to the g1/g2 reading or grammar docs; `pnpm --filter @workspace/curriculum test` green.
- [ ] **Step 5: Typecheck and commit** — message `Grade 3 reading: the teacher's printable review form`.

---

### Task 3: The round builder on Grade 3

**Files:**
- Test: `artifacts/mobile/services/__tests__/englishReadingG3Games.test.ts`
- (Modify `artifacts/mobile/services/englishHub/games.ts` only if this test shows a real defect.)

**Interfaces:**
- Consumes: `buildReadSentenceRound`, `readSentenceAvailable`, `readingActivityAvailable`, `ROUND_LENGTH`, `READING_OPTIONS`.

- [ ] **Step 1: Write the test** — mirror `englishReadingG2Games.test.ts` over `hubLessonsForGrade(3)`:
  - exactly 3 pools, and `readSentenceAvailable` true on exactly S1 U3, S1 U5, S2 U9;
  - a round is `min(8, distinctPictureWords(pool))` questions (so S2 U9 is exactly 6), three distinct pictures, the sentence's own at `answerIndex`, no Yes/No sentence, every sentence in `allGrammarSpoken()`;
  - no picture word twice in a round; the partner is among the wrong pictures whenever one exists (and `withPartner > 0` over S1 U5 and S2 U9);
  - the availability matrix of the spec: for each of the 8 lessons, `readingActivityAvailable('first-letter' | 'read-find' | 'starts-with', l.words)` equals `[true, false, false]`-style row from the spec table (First letter all true; read-find and starts-with true only on S1 U3, S1 U5, S2 U7, S2 U9, S2 U10).
- [ ] **Step 2: Run** — `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishReadingG3Games.test.ts` (use the runner's flags from `package.json`'s `test` script). Expected: PASS without changing `games.ts`; if a case fails, fix the builder narrowly and say so in the commit.
- [ ] **Step 3: Typecheck (root, to rebuild curriculum declarations) and commit** — message `Grade 3 reading: round builder tests on the three Grade 3 pools`.

---

### Task 4: Browser check, docs, PR

- [ ] **Step 1: Browser check** (390 px, Arabic and English) with **local** sign-offs on the reading and grammar rows of S1 U3, S1 U5, S2 U9 — restore both files immediately (`git checkout lib/curriculum/src/englishReading.ts lib/curriculum/src/englishGrammarG3.ts`) and confirm `git diff --stat` is empty: the sentence stays left to right; three pictures fit (S1 U5 partner cards, «police officer»); S2 U9's round ends after 6; an unsigned unit shows nothing; a unit with reading but not grammar signed shows the word activities and no sentence card.
- [ ] **Step 2: Docs** — put a «Grade 3 reading in the English corner» section at the **top** of `docs/status-log.md` (what was built, what was and was not verified, the switch-on steps, known limits), add one index line to `STATUS.md`, and set the spec's status to implemented.
- [ ] **Step 3: Full verification** — `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test` (about 5 minutes, background).
- [ ] **Step 4: Commit, push to `ccr-d9db5f6c-mgwkuo`; PR #1171 stays a draft** — update its body for Grade 3 reading; do not mark ready or merge.

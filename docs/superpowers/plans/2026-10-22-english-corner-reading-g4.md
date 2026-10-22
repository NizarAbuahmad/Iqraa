# English corner: Grade 4 reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 9 Grade 4 hub lessons the reading activities (word activities on all 9, «Read the sentence» on 4), all hidden until a teacher signs the printed form.

**Architecture:** Grade 3's design applied to Grade 4 data. Nine `READING_UNITS` rows (all `reviewedBy: null`); `readSentencePool`'s grade test widens to Grades 2–4; one new first-sound exception (`hard-q`: «Qatar», «Qatari»); a Grade 4 not-covered table and form copy. The app's round builder, screen and strings are expected to need no change.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script that writes the printable forms.

**Spec:** `docs/superpowers/specs/2026-10-22-english-corner-reading-g4-design.md`

## Global Constraints

- Every Grade 4 `READING_UNITS` row ships `reviewedBy: null`; no sign-off is ever committed.
- Grade 1 stays excluded from «Read the sentence» (the pool test is Grades 2, 3 and 4).
- The Grade 1, 2 and 3 reading forms and all four grammar sheets and forms stay byte-identical (tests pin them).
- `READING_NOT_COVERED_*` and `SKIP_AR` text is form-safe in the not-covered notes: no `"`, `&`, `<` or `>` in a not-covered note (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`; push only to `ccr-d9db5f6c-mgwkuo`; run `pnpm run typecheck` before committing a task; never commit a sign-off.

## File Structure

- Modify `lib/curriculum/src/englishReading.ts`: rows, `hard-q`, pool grade test, `READING_NOT_COVERED_G4`.
- Modify `lib/curriculum/src/englishReadingReview.ts`: `SKIP_AR['hard-q']`, Grade 4 copy, merged not-covered map.
- Modify `lib/curriculum/scripts/grammar-sheet.ts`; generate `docs/english-reading-g4-review.html`.
- Create `lib/curriculum/src/__tests__/englishReadingG4.test.ts` and `artifacts/mobile/services/__tests__/englishReadingG4Games.test.ts`.
- Docs: top of `docs/status-log.md`, one index line in `STATUS.md`, spec status.

---

### Task 1: Rows, the `hard-q` exception, the pool and the not-covered table

**Files:** Modify `englishReading.ts`; Test `englishReadingG4.test.ts` (created here; the form tests are appended in Task 2).

**Interfaces:**
- Produces: nine Grade 4 rows in `READING_UNITS`; `SoundSkip` gains `'hard-q'`; `READING_NOT_COVERED_G4: Record<string, string[]>` keyed by S1 U2, S1 U4, S2 U7, S2 U9, S2 U10.

- [ ] **Step 1: Write the failing test** — create `englishReadingG4.test.ts`:

```ts
/**
 * Grade 4 reading (spec: docs/superpowers/specs/2026-10-22-english-corner-reading-g4-design.md):
 * the unit rows, the new first-sound exception, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  READING_NOT_COVERED_G4, READING_UNITS, distinctPictureWords, firstSound, firstSoundSkip,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G4 = hubLessonsForGrade(4);
const L = (sem: number, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 1), L(1, 3), L(1, 5), L(2, 8)];

test('every Grade 4 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(4).map(u => u.lessonId).sort(), G4.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(4).length, 9);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(4)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('«Qatar» and «Qatari» are skipped (Q is read /k/); «quickly», «quiet» and «quietly» are /kw/ and stay', () => {
  assert.equal(firstSoundSkip('Qatar'), 'hard-q');
  assert.equal(firstSoundSkip('Qatari'), 'hard-q');
  assert.equal(firstSound('Qatar'), null);
  for (const w of ['quickly', 'quiet', 'quietly', 'queue']) assert.equal(firstSound(w), 'q', w);
});

test('the rule leaves out exactly these 45 Grade 4 words, each with a reason', () => {
  const out = G4.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en));
  assert.equal(out.length, 45);
  assert.deepEqual([...out].sort(), [
    'Egypt', 'Qatar', 'the United Kingdom', 'the United Arab Emirates', 'Egyptian', 'Emirati', 'Qatari',
    'Arabic', 'Art', 'English', 'Islamic Studies', 'always', 'often', 'at the weekend', 'every day', 'once a week', 'three times a week',
    'cereal', 'olives', 'a bag of', 'a bottle of', 'a bowl of', 'a box of', 'a can of', 'a cup of', 'a glass of', 'a plate of',
    'city', 'island', 'exciting', 'interesting',
    'chef', 'arrive on time', 'shout in class',
    'knit', 'easily',
    'shopping centre', 'ancient', 'cheap', 'expensive',
    'iron', 'shield', 'arrive', 'use',
    'invitation',
  ].sort());
  for (const w of out) assert.ok(firstSoundSkip(w), w);
});

test('the sentence pool exists for exactly S1 U1, U3, U5 and S2 U8, and Grades 1–3 are unchanged', () => {
  const withPool = G4.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.deepEqual(ELIGIBLE.map(id => readSentencePool(id).length), [30, 24, 21, 32]);
  assert.deepEqual(ELIGIBLE.map(id => distinctPictureWords(readSentencePool(id))), [6, 8, 13, 9]);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.equal(hubLessonsForGrade(2).filter(l => readSentencePool(l.id).length > 0).length, 7);
  assert.equal(hubLessonsForGrade(3).filter(l => readSentencePool(l.id).length > 0).length, 3);
  for (const id of ELIGIBLE) for (const s of readSentencePool(id)) {
    assert.ok(s.picture, s.key);
    assert.equal(s.yesNo, null, s.key);
  }
});

test('partners: S1 U1, U3 and S2 U8 have one for every sentence; S1 U5 for the 16 job sentences, none for the clothes', () => {
  const partnered = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool));
  };
  assert.equal(partnered(L(1, 1)).length, 30);
  assert.equal(partnered(L(1, 3)).length, 24);
  assert.equal(partnered(L(2, 8)).length, 32);
  const jobs = partnered(L(1, 5));
  assert.equal(jobs.length, 16);
  assert.ok(jobs.every(s => /^(He|She)'s a /.test(s.text)));
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      const p = sentencePartner(s, pool);
      if (!p) continue;
      assert.equal(p.picture!.word, s.picture!.word, s.key);
      assert.ok(p.picture!.count !== s.picture!.count || p.marker !== s.marker, s.key);
    }
  }
  const flags = readSentencePool(L(1, 1));
  assert.equal(sentencePartner(flags.find(s => s.text === "I'm from Spain.")!, flags)!.text, "He's from Spain.");
  assert.equal(sentencePartner(flags.find(s => s.text === "I'm Spanish.")!, flags)!.text, "He's from Spain.");
});

test('the sentence activity needs reading, grammar and a Grade 2, 3 or 4 lesson', () => {
  const id = L(1, 3);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  assert.equal(offeredReadingSentences(L(1, 4), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the five lessons with no sentence activity, in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G4).sort(), [L(1, 2), L(1, 4), L(2, 7), L(2, 9), L(2, 10)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G4)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
```

- [ ] **Step 2: Run to verify it fails** — `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishReadingG4.test.ts` → FAIL (`READING_NOT_COVERED_G4` is not exported).
- [ ] **Step 3: Implement** in `englishReading.ts`: `SoundSkip` adds `'hard-q'`; in `firstSoundSkip`, after the soft-c line, `if (/^qa/.test(w)) return 'hard-q';` (with a comment: «Qatar», «Qatari»: Q is read /k/); append nine rows `kbl-g4-eng-s1-nccd-u1_l1 … u5_l1`, `s2-nccd-u7_l1 … u10_l1` with `reviewedBy: null` after the Grade 3 rows; in `readSentencePool` replace the grade test with `if (grade !== 2 && grade !== 3 && grade !== 4) return [];` and update the section heading and doc comments to «Grades 2 to 4»; append `READING_NOT_COVERED_G4` (Arabic, form-safe, one note per lesson: no pictures for S1 U2, S2 U7 and S2 U9 (only `wall` has one), comparisons without pictures for S1 U4, past-tense sentences without pictures for S2 U10; each says which activities remain).
- [ ] **Step 4: Run to verify it passes**, then `pnpm --filter @workspace/curriculum test` — the existing Grade 1–3 reading and form tests stay green (no Grade 1–3 word starts «qa»).
- [ ] **Step 5: Typecheck and commit** — `Grade 4 reading: unit rows, the Qatar exception, sentence pool and not-covered notes (all hidden)`. Tests that need the form (Task 2) are not in this file yet, so the commit is green.

---

### Task 2: The teacher's Grade 4 reading form

**Files:** Modify `englishReadingReview.ts`, `scripts/grammar-sheet.ts`; Generate `docs/english-reading-g4-review.html`; Test `englishReadingG4.test.ts` (append).

**Interfaces:** Consumes `READING_NOT_COVERED_G4`, `'hard-q'`. Produces `renderReadingReviewHtml(4)`.

- [ ] **Step 1: Write the failing tests** — append to `englishReadingG4.test.ts`:

```ts
const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 4 reading form lists every word and pool sentence once, the 45 left-out words, and a note per gap', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(4);
  const words = G4.flatMap(l => l.words);
  assert.equal(words.length, 172);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 172);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, 127);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, 45);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 9);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 107);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 5);
  assert.ok(html.includes('مراجعة قراءة الصف الرابع'));
  assert.ok(html.includes('اقرَأ الجملة'));
  assert.ok(html.includes('<td class="sentence" dir="ltr">He\'s from Spain.</td>'));
  assert.ok(html.includes('<td class="skip">لا تُستعمل: <span dir="ltr">Q</span> تُلفظ <span dir="ltr">k</span> هنا</td>'));
});

test('the committed Grade 4 reading form is exactly what the generator produces; Grades 1–3 are untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const read = (f: string) => readFileSync(new URL(f, docs), 'utf8');
  assert.equal(read('english-reading-g4-review.html'), renderReadingReviewHtml(4), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  for (const g of [1, 2, 3]) assert.equal(read(`english-reading-g${g}-review.html`), renderReadingReviewHtml(g), `Grade ${g} reading form changed`);
});
```

- [ ] **Step 2: Run → FAIL** (`GRADE_COPY[4]` is undefined; the file is missing).
- [ ] **Step 3: Implement** in `englishReadingReview.ts`: import `READING_NOT_COVERED_G4` and merge it into `NOT_COVERED`; add `'hard-q': 'لا تُستعمل: <span dir="ltr">Q</span> تُلفظ <span dir="ltr">k</span> هنا'` to `SKIP_AR` (the `Record<SoundSkip, string>` type forces it); add `GRADE_COPY[4]` — title `مراجعة قراءة الصف الرابع`, eyebrow `إقرأ · ركن اللغة الإنجليزية · الصف الرابع`, a lead like Grade 3's (the units, words, sentence count and the sentence units; that five of the nine lessons have no sentence activity and why; that `Qatar` and `Qatari` are left out), `acts: ACTS_SENTENCE`, `meta: META_SENTENCE`, `extraCss: CSS_SENTENCE`, and `checks`: `CHECKS_WORD`, then the spec's four open points (two-sentence «Where are you from?» too long; do the flag, ✅/❌, 👦/👧 and doubled pictures read clearly; is a round of 6 enough on S1 U1; is leaving `Qatar` and `Qatari` out of First letter right). In `scripts/grammar-sheet.ts` add `files.push(['english-reading-g4-review.html', renderReadingReviewHtml(4)]);` and extend the header comment.
- [ ] **Step 4: Generate and verify** — `pnpm --filter @workspace/curriculum run grammar-sheet`; `git status` shows only `docs/english-reading-g4-review.html` as new and **no change** to any other doc; `pnpm --filter @workspace/curriculum test` green.
- [ ] **Step 5: Typecheck and commit** — `Grade 4 reading: the teacher's printable review form`.

---

### Task 3: The round builder on Grade 4

**Files:** Test `artifacts/mobile/services/__tests__/englishReadingG4Games.test.ts`. (`games.ts` changes only if a test shows a real defect.)

- [ ] **Step 1: Write the test**, mirroring `englishReadingG3Games.test.ts` over `hubLessonsForGrade(4)`: exactly four pools and `readSentenceAvailable` true on exactly S1 U1, U3, U5 and S2 U8; a round is `min(8, picture words)` questions: S1 U1 exactly 6, the others 8; three distinct pictures, the sentence's own at `answerIndex`, a recording in `allGrammarSpoken()`, no Yes or No; no picture word twice in a round; the partner among the wrong pictures whenever one exists; and the activity matrix: First letter on all nine, Read and find true on S1 U1, U3, U4, U5, S2 U8, U10 and false on S1 U2, S2 U7, U9, and Starts with true on the same lessons except S1 U1 (its six flags leave only Jordan and Spain with a first sound, under the floor of three letters).
- [ ] **Step 2: Run** — `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishReadingG4Games.test.ts` → PASS without changing `games.ts`; if a case fails, fix the builder narrowly and say so in the commit.
- [ ] **Step 3: Typecheck (root) and commit** — `Grade 4 reading: round builder and availability tests on the Grade 4 lessons`.

---

### Task 4: Browser check, docs, PR

- [ ] **Step 1: Full verification** — `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test` (about 5 minutes, in the background; do not edit sign-offs until it finishes).
- [ ] **Step 2: Browser check** (390 px, Arabic and English). After the mobile suite finishes, set a local `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-22' }` on the **reading** rows of S1 U1, U3, U4, U5, S2 U7 and S2 U8 and on the **grammar** rows of S1 U1, U5 and S2 U8 in the working tree only, build the web bundle, serve it with `WEB_PORT=8098 node e2e/serve.mjs` (kill by PID) and drive it: S1 U1 shows all four reading cards, a six-question round ending with «Finished», flags with 👦/👧 markers fitting; S2 U8 doubled pictures fit; S1 U3 (reading signed, grammar unsigned) shows the three word cards and no sentence card; S1 U4 shows Read and find and Starts with and no sentence card; S2 U7 shows First letter only; an unsigned lesson shows nothing; no horizontal scroll. Then **restore** both data files with `git checkout`, confirm `grep -c "LOCAL CHECK"` is 0 and `git status` is clean.
- [ ] **Step 3: Docs** — a «Grade 4 reading in the English corner — built, shown to nobody yet» section at the **top** of `docs/status-log.md`, one index line in `STATUS.md`, the spec's status set to implemented.
- [ ] **Step 4: Commit, push to `ccr-d9db5f6c-mgwkuo`, update the PR body** of #1171 (it stays a draft; do not mark ready or merge), merge `main` if it conflicts (no rebase or force-push), and check CI.

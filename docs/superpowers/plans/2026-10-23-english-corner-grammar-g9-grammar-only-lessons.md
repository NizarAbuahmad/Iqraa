# English corner: grammar-only hub lessons, and the last five Grade 9 grammar lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the hub carry five Grade 9 grammar lessons that have fewer than four words, invisible until a teacher signs them off, and give them 200 hand-written grammar items.

**Architecture:** `englishHub.ts` gains a short list of grammar-only lesson ids and a `grammarOnly` flag; `englishGrammar.ts` gains `hubLessonVisible(id)` (a grammar-only lesson is visible only when its unit is signed); the five units reuse the hand-written-item engine from the fourteen earlier lessons. The lesson index, lesson screen and curriculum lesson page use the visibility rule, and a grammar-only lesson shows grammar cards only.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script, Expo web for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-grammar-only-lessons-design.md`

## Global Constraints

- All five units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs, restored with `git checkout`; `grep -c "LOCAL CHECK"` is 0).
- A grammar-only lesson is **never visible unsigned**: not in the index, not by its URL, not through the curriculum page's link.
- Lessons with four or more words behave exactly as before.
- The Grade 1–4 grammar sheets and forms, the four reading forms and every earlier Grade 9 page stay byte-identical (tests pin them), apart from the Grade 9 intro and the removed «lessons the hub does not carry» card.
- Every sentence is nine words or fewer, with a correct answer once as whole words, a differing distractor and twin, no real person's name, nothing religious, political or sensitive.
- A distractor is `form` (ungrammatical in standard English); these five lessons use no `meaning` items. No reported-speech item turns on the tense shift.
- True or false on these items is silent (`claim.voiced: false`, already in the engine).
- **Project rules (CLAUDE.md):** no `sed -i` or `perl -pi` on source (use the Edit tool); stage named paths, never `git add -A`; read `git diff --stat` for `Bin N -> M bytes` after editing text files; the product's Latin name is «Iqrra» in copy and PR titles.
- Arabic not-covered notes: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- Measured before the change: hub lessons per grade 1:10, 2:9, 3:8, 4:9, 5:10, 9:36, 10:20 (102 in all).

## File Structure

- Modify `lib/curriculum/src/englishHub.ts`: `GRAMMAR_ONLY_LESSONS`, `HubLesson.grammarOnly`, the build condition.
- Modify `lib/curriculum/src/englishGrammar.ts`: `hubLessonVisible`.
- Modify `lib/curriculum/src/englishGrammarG9Items.ts` (regenerated from a script in the scratchpad, additions only): the five lessons' items.
- Modify `lib/curriculum/src/englishGrammarG9.ts`: remove `G9_HUB_GAPS`; `NOT_COVERED_G9` gains five entries.
- Modify `lib/curriculum/src/englishGrammarReview.ts`: drop the gaps card (`GRADE_COPY[9].extra`) and the `G9_HUB_GAPS` import; regenerate `docs/english-grammar-g9-review.html` and `-sheet.md`.
- Modify `artifacts/mobile/services/i18n.ts` (`hubGrammarOnly`, Arabic and English), `app/curriculum/english/index.tsx`, `app/curriculum/english/[lessonId].tsx`, `app/curriculum/lesson-detail.tsx`.
- Tests: `englishHub.test.ts` (edit and append), `englishHubVisible.test.ts` (create), `englishGrammarG9Items.test.ts` and `englishGrammarG9.test.ts` (update), `artifacts/mobile/services/__tests__/englishGrammarG9ItemGames.test.ts` (update).
- Docs: top of `docs/status-log.md`, `STATUS.md` index line, the two specs' status notes.

---

### Task 1: The hub carries grammar-only lessons, and a visibility rule

**Files:**
- Modify: `lib/curriculum/src/englishHub.ts`, `lib/curriculum/src/englishGrammar.ts`
- Test: `lib/curriculum/src/__tests__/englishHub.test.ts` (edit, append), `lib/curriculum/src/__tests__/englishHubVisible.test.ts` (create)

**Interfaces:**
- Produces: `GRAMMAR_ONLY_LESSONS: readonly string[]`; `HubLesson.grammarOnly?: boolean` (true only on a listed lesson with fewer than `MIN_HUB_WORDS` words); `hubLessonVisible(lessonId: string, offered: (id: string) => unknown = offeredGrammar): boolean` in `englishGrammar.ts`.

- [ ] **Step 1: Write the failing tests.** In `englishHub.test.ts`, add `GRAMMAR_ONLY_LESSONS` to the import from `../englishHub.ts`, change the assertion `assert.ok(l.words.length >= MIN_HUB_WORDS, l.id);` to `assert.ok(l.grammarOnly ? l.words.length < MIN_HUB_WORDS : l.words.length >= MIN_HUB_WORDS, l.id);`, and append:

```ts
const GRAMMAR_ONLY = [
  'kbl-g9-eng-s1-nccd-u2_l3', 'kbl-g9-eng-s2-nccd-u7_l1', 'kbl-g9-eng-s2-nccd-u7_l2', 'kbl-g9-eng-s2-nccd-u8_l5', 'kbl-g9-eng-s2-nccd-u9_l3',
];

test('five Grade 9 lessons are grammar-only: listed, under the word floor, and no other lesson is', () => {
  assert.deepEqual([...GRAMMAR_ONLY_LESSONS], GRAMMAR_ONLY);
  const flagged = ENGLISH_HUB_LESSONS.filter(l => l.grammarOnly).map(l => l.id);
  assert.deepEqual(flagged, GRAMMAR_ONLY);
  for (const id of GRAMMAR_ONLY) assert.ok(hubLesson(id)!.words.length < MIN_HUB_WORDS, id);
});

test('the hub has 41 Grade 9 lessons now and every other grade is unchanged', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9, 10].map(g => hubLessonsForGrade(g).length), [10, 9, 8, 9, 10, 41, 20]);
});
```

Create `englishHubVisible.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonVisible } from '../englishGrammar.ts';
import { GRAMMAR_ONLY_LESSONS, hubLessonsForGrade } from '../englishHub.ts';

test('a lesson with words is visible, signed or not; an unknown id never is', () => {
  const withWords = hubLessonsForGrade(1)[0].id;
  assert.equal(hubLessonVisible(withWords), true);
  assert.equal(hubLessonVisible(withWords, () => null), true);
  assert.equal(hubLessonVisible('kbl-no-such-lesson'), false);
});

test('a grammar-only lesson is invisible until its unit is signed', () => {
  for (const id of GRAMMAR_ONLY_LESSONS) {
    assert.equal(hubLessonVisible(id), false, `${id} must be hidden in the committed data`);
    assert.equal(hubLessonVisible(id, () => null), false, id);
    assert.equal(hubLessonVisible(id, () => [{}]), true, id);
  }
});
```

- [ ] **Step 2: Run to verify they fail.** `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishHub.test.ts src/__tests__/englishHubVisible.test.ts` — FAIL (`GRAMMAR_ONLY_LESSONS` and `hubLessonVisible` not exported).

- [ ] **Step 3: Implement.** In `englishHub.ts`, add to `HubLesson` (after `words`): `/** True on a grammar-only lesson: listed in GRAMMAR_ONLY_LESSONS and under MIN_HUB_WORDS words. The app hides its word activities and shows it only once its grammar is signed. */ grammarOnly?: boolean;`. After `MIN_HUB_WORDS` add:

```ts
/**
 * Grade 9 lessons whose book statement is a grammar topic but whose book gives them fewer than `MIN_HUB_WORDS` words
 * (used to; the two present perfects; the first conditional; reported speech). They are in the hub for their
 * grammar only: the lesson screen hides the word activities, and `hubLessonVisible` (englishGrammar.ts) keeps one
 * out of sight until a teacher signs its unit. A test pins that each id has fewer than four words and a grammar
 * unit, so this list cannot go stale. It lives here because englishGrammar.ts imports this file.
 */
export const GRAMMAR_ONLY_LESSONS: readonly string[] = [
  'kbl-g9-eng-s1-nccd-u2_l3',
  'kbl-g9-eng-s2-nccd-u7_l1',
  'kbl-g9-eng-s2-nccd-u7_l2',
  'kbl-g9-eng-s2-nccd-u8_l5',
  'kbl-g9-eng-s2-nccd-u9_l3',
];
```

In `buildFromVocabulary`, replace `if (words.length < MIN_HUB_WORDS) continue;` with:

```ts
      const grammarOnly = words.length < MIN_HUB_WORDS;
      if (grammarOnly && !GRAMMAR_ONLY_LESSONS.includes(l.id)) continue;
```

and add `...(grammarOnly ? { grammarOnly: true } : {}),` as the last property of the pushed object. In `englishGrammar.ts`, after `offeredGrammar`, add:

```ts
/**
 * Is this hub lesson shown to students? A lesson with words always is. A grammar-only lesson (too few words for the
 * word activities) is only once a teacher has signed its grammar unit: otherwise it would be an empty page in the
 * public index. `offered` is `offeredGrammar` unless a test passes a stand-in.
 */
export function hubLessonVisible(lessonId: string, offered: (id: string) => unknown = offeredGrammar): boolean {
  const lesson = hubLesson(lessonId);
  if (!lesson) return false;
  return !lesson.grammarOnly || Boolean(offered(lessonId));
}
```

(`hubLesson` is already imported there.)

- [ ] **Step 4: Run to verify they pass.** The two test files, then `pnpm --filter @workspace/curriculum test`. One failure is expected and is Task 2's: any test that asserts every Grade 9 hub lesson has a grammar unit or a reading row, if one exists; if a test other than those named fails, read it before touching it.
- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishHub.ts lib/curriculum/src/englishGrammar.ts lib/curriculum/src/__tests__/englishHub.test.ts lib/curriculum/src/__tests__/englishHubVisible.test.ts
git diff --cached --stat
git commit -m "Hub: grammar-only lessons and a visibility rule"
```

---

### Task 2: The five lessons' sentences and the teacher's form

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG9Items.ts`, `lib/curriculum/src/englishGrammarG9.ts`, `lib/curriculum/src/englishGrammarReview.ts`; regenerate `docs/english-grammar-g9-review.html`, `docs/english-grammar-g9-sheet.md`
- Test: `lib/curriculum/src/__tests__/englishGrammarG9Items.test.ts`, `englishGrammarG9.test.ts`, `englishHub.test.ts` (append)

**Interfaces:**
- Consumes: `GRAMMAR_ONLY_LESSONS`, `G9_ITEM_LESSONS` (the existing shape `{ lessonId, statement, items }`).
- Produces: five more entries in `G9_ITEM_LESSONS` in hub order; five more units in `GRAMMAR_UNITS_G9`; `G9_HUB_GAPS` removed.

Sub-topics and counts (the contract, 40 a lesson, 200 in all). Every item is `form`: the distractor is ungrammatical.

| Lesson id (`kbl-g9-eng-…`) | Sub-topics (id: count) | Distractors |
| --- | --- | --- |
| `s1-nccd-u2_l3` | `used-to-affirmative`: 14, `didnt-use-to`: 12, `did-use-to-questions`: 14 | «used to play» / «use to play»; «didn't use to» / «didn't used to»; «Did you use to» / «Did you used to» |
| `s2-nccd-u7_l1` | `already-just`: 14, `ever-never`: 14, `yet-negatives`: 12 | «have finished» / «have finish»; «Have you ever visited» / «Have you ever visit»; «haven't finished» / «haven't finish» (also have/has agreement) |
| `s2-nccd-u7_l2` | `for`: 14, `since`: 14, `have-has`: 12 | «for five years» / «since five years»; «since 2019» / «for 2019»; «has lived» / «have lived» |
| `s2-nccd-u8_l5` | `will-clause`: 14, `if-clause`: 14, `negatives-questions`: 12 | «will stay» / «would stay»; «If you study» / «If you will study»; «What will you do» / «What would you do» |
| `s2-nccd-u9_l3` | `say-tell`: 16, `ask`: 12, `reported-questions`: 12 | «told me» / «said me»; «said» / «told» before a clause with no object; «asked me where» / «said me where»; «where I lived» / «where did I live» |

Authoring rules, every item: nine words or fewer; everyday school, family, food, travel and technology; no real person's name; one point; what decides the answer is in the sentence; `answer` appears exactly once as whole words; the distractor is never a form that could fit (so no backshift item in `u9_l3`, no «would» for a meaning choice). Example items:

```ts
["I used to play football every day.", "used to play", "use to play"],
["Have you ever visited Petra?", "Have you ever visited", "Have you ever visit"],
["I have lived here for five years.", "for", "since"],
["If it rains, we will stay home.", "will stay", "would stay"],
["She told me she was tired.", "told me", "said me"],
```

The `statement` of each lesson is read from `lib/curriculum/src/data/iqra_curriculum_g9_eng_sem{1,2}.json` by the generator script, never typed from memory.

- [ ] **Step 1: Write the failing tests.** In `englishGrammarG9Items.test.ts`: add the five ids to `LESSONS` in hub order (`s1-nccd-u2_l3` after `s1-nccd-u2_l1`; `s2-nccd-u7_l1`, `s2-nccd-u7_l2` after `s2-nccd-u6_l3`; `s2-nccd-u8_l5` after `s2-nccd-u8_l1`; `s2-nccd-u9_l3` after `s2-nccd-u9_l1`); rename the first describe's «fourteen» to «nineteen»; change `560` to `760` in the totals test; add to the shape pins:

```ts
    assert.deepEqual(shape('s1-nccd-u2_l3'), { 'used-to-affirmative': 14, 'didnt-use-to': 12, 'did-use-to-questions': 14 });
    assert.deepEqual(shape('s2-nccd-u7_l1'), { 'already-just': 14, 'ever-never': 14, 'yet-negatives': 12 });
    assert.deepEqual(shape('s2-nccd-u7_l2'), { for: 14, since: 14, 'have-has': 12 });
    assert.deepEqual(shape('s2-nccd-u8_l5'), { 'will-clause': 14, 'if-clause': 14, 'negatives-questions': 12 });
    assert.deepEqual(shape('s2-nccd-u9_l3'), { 'say-tell': 16, ask: 12, 'reported-questions': 12 });
```

In the form test change the counts `14` to `19` (the two «تأكدوا أولًا» and «الكلمات خارج قوائم المفردات» counts) and `560` to `760`, delete the line that checks `'used to', 'present perfect', 'first conditional', 'tell'` and the block after it that slices the gaps card, and replace them with `assert.ok(!html.includes('class="card gaps"'), 'no hub topic is left without a lesson');`. Add:

```ts
  it('«didn\'t used to» appears only as the distractor of the flagged topic', () => {
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      const mentions = x.text.includes("didn't used to") || x.claim!.falseText.includes("didn't used to");
      if (mentions) {
        assert.equal(id, L('s1-nccd-u2_l3'));
        assert.equal(x.patternId, 'didnt-use-to');
      }
    }
  });
```

In `englishGrammarG9.test.ts`: `122 + 560` → `122 + 760`, `2 + 14` → `2 + 19` (units), and the not-covered count `2 + 14 + 1` → `2 + 19`; update the two comments. Append to `englishHub.test.ts`:

```ts
test('every grammar-only lesson has a grammar unit', async () => {
  const { grammarUnit } = await import('../englishGrammar.ts');
  for (const id of GRAMMAR_ONLY) assert.ok(grammarUnit(id), id);
});
```

In the mobile test `englishGrammarG9ItemGames.test.ts`, add the five ids to its `LESSONS` and rename «fourteen» to «nineteen».

- [ ] **Step 2: Run to verify they fail.** `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG9Items.test.ts src/__tests__/englishGrammarG9.test.ts src/__tests__/englishHub.test.ts` — FAIL (the five lessons have no units).
- [ ] **Step 3: Author the data.** Extend the generator in the scratchpad (`g9items/data3.py` with the 200 items in the same `(topic, kind, [(text, answer, distractor), …])` shape; `gen.py`'s `ORDER` list gains the five ids in hub order; `data1.py` and `data2.py` stay as they are). Run it: it rewrites `englishGrammarG9Items.ts` whole, and `git diff --stat` must show insertions only (no deletions) and no NUL bytes (`tr -cd '\000' < file | wc -c` is 0).
- [ ] **Step 4: Units and notes.** In `englishGrammarG9.ts`, remove `G9_HUB_GAPS` (and its comment); the units already come from `G9_ITEM_LESSONS.map(...)`. With the Edit tool add to `NOT_COVERED_G9` one entry per new lesson (`[L2('s1-nccd-u2_l3')]`, `[L2('s2-nccd-u7_l1')]`, `[L2('s2-nccd-u7_l2')]`, `[L2('s2-nccd-u8_l5')]`, `[L2('s2-nccd-u9_l3')]`) with the two common notes («لا صور ولا «نعم أم لا»…», ««صح أم خطأ» صامت عمدًا…») and a third: `هذا الدرس بلا أنشطة كلمات أو قراءة لأن كلماته قليلة؛ لن يظهر للطلاب إلا بعد توقيعكم.` plus, per lesson: `u2_l3`: `«didn't use to» مقابل «didn't used to» يقبلهما بعض المعلمين معًا، فهما في موضوع واحد من ١٢ جملة للمراجعة.`; `u7_l1` and `u7_l2`: `الخيارات الخاطئة أخطاء في الصيغة فقط (have finish، since five years).`; `u8_l5`: `الخيارات الخاطئة هي صيغة الشرط الثاني (would stay) أو will داخل جملة if، لا اختيار في المعنى.`; `u9_l3`: `لا جملة تعتمد على تغيّر زمن الفعل في الكلام المنقول (said she was tired مقابل said she is tired مقبولتان)، فالخيارات الخاطئة نقص المفعول أو ترتيب الكلمات.`
- [ ] **Step 5: The form.** In `englishGrammarReview.ts` remove `G9_HUB_GAPS` from the import and the `extra:` line of `GRADE_COPY[9]` (and the `.gaps` CSS rule). Regenerate: `pnpm --filter @workspace/curriculum run grammar-sheet`; `git status` shows only the two Grade 9 documents changed among `docs/`.
- [ ] **Step 6: Run to verify they pass.** `pnpm --filter @workspace/curriculum test` — all pass; `pnpm run typecheck`; the two Grade 9 app test files (`cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG9Games.test.ts services/__tests__/englishGrammarG9ItemGames.test.ts`).
- [ ] **Step 7: Look at it.** Render the form in Chromium at 390 px and wide (the earlier `g9items-form.mjs` is the model): the five new pages appear in hub order with their book statements, no gaps card, no horizontal scroll of the page.
- [ ] **Step 8: Commit** the named files (`englishGrammarG9Items.ts`, `englishGrammarG9.ts`, `englishGrammarReview.ts`, the two documents, the four test files) with «Grade 9 grammar: the five grammar-only lessons and their form (hidden)».

---

### Task 3: The app shows a grammar-only lesson only when it is signed, with grammar cards only

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts`, `artifacts/mobile/app/curriculum/english/index.tsx`, `artifacts/mobile/app/curriculum/english/[lessonId].tsx`, `artifacts/mobile/app/curriculum/lesson-detail.tsx`

**Interfaces:**
- Consumes: `hubLessonVisible` (`@workspace/curriculum/englishGrammar`), `HubLesson.grammarOnly`.
- Produces: i18n key `hubGrammarOnly` (Arabic «تمارين قواعد», English «Grammar activities»).

- [ ] **Step 1: Strings.** With the Edit tool add `hubGrammarOnly: 'تمارين قواعد',` after the Arabic `hubWords` line and `hubGrammarOnly: 'Grammar activities',` after the English one. If a test checks Arabic and English key parity, it passes because both are added.
- [ ] **Step 2: The index.** In `index.tsx` import `hubLessonVisible` from `@workspace/curriculum/englishGrammar`; replace `const lessons = hubLessonsForGrade(grade);` with `const lessons = hubLessonsForGrade(grade).filter(l => hubLessonVisible(l.id));` (so `perUnit` counts only visible lessons), and replace the words row (`{t('hubWords', l.words.length)} · {l.words.slice(0, 4).map(w => w.en).join(', ')}…`) with `{l.grammarOnly ? t('hubGrammarOnly') : `${t('hubWords', l.words.length)} · ${l.words.slice(0, 4).map(w => w.en).join(', ')}…`}`.
- [ ] **Step 3: The lesson screen.** In `[lessonId].tsx` import `hubLessonVisible` with the existing `offeredGrammar` import, and replace `const lesson = hubLesson(lessonId ?? '');` with `const lesson = lessonId && hubLessonVisible(lessonId) ? hubLesson(lessonId) : undefined;` (an invisible lesson then falls into the existing «lesson not found» branch). In the list of cards replace `{HUB_ACTIVITIES.filter(a => a !== 'picture' || lessonHasPictureMatch(lesson.words)).map(card)}` with `{lesson.grammarOnly ? null : HUB_ACTIVITIES.filter(a => a !== 'picture' || lessonHasPictureMatch(lesson.words)).map(card)}` and guard the reading section with `{!lesson.grammarOnly && readingCards.length > 0 ? (`.
- [ ] **Step 4: The curriculum page.** In `lesson-detail.tsx` change the import to also bring `hubLessonVisible` from `@workspace/curriculum/englishGrammar` and `{hubLesson(lesson.id) ? (` to `{hubLessonVisible(lesson.id) ? (`; drop the `hubLesson` import if it is then unused (the typechecker says).
- [ ] **Step 5: Typecheck and test.** `pnpm run typecheck`; `cd artifacts/mobile && pnpm test` in the background (the suite prints nothing until it ends); do not touch sign-offs while it runs.
- [ ] **Step 6: Commit** the four named files with «Hub screens: a grammar-only lesson is hidden until signed and shows grammar only».

---

### Task 4: Verify, document, push

- [ ] **Step 1:** `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; read `# fail 0` from the mobile suite log.
- [ ] **Step 2: Browser check at 390 px, Arabic and English.** (a) Unsigned: the Grade 9 index has 36 lessons (a count of rows), none of the five; opening `/curriculum/english/kbl-g9-eng-s2-nccd-u7_l1` says «lesson not found»; the curriculum lesson page of a grammar-only lesson shows no «open in the hub» link. (b) Temporary local sign-offs: in `englishGrammarG9.ts` replace the `reviewedBy: null` of the generated units with `{ name: 'LOCAL CHECK', date: '2026-10-23' }` using the Edit tool; `pnpm run build:web` (`EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true`), serve with `WEB_PORT=8098 node e2e/serve.mjs`; the index now shows 41 rows with «Grammar activities» on the five; each of the five opens with Choose, Build and True or false cards and no word or reading section; True or false shows no speaker button; a lesson with words (for example S1 U1 l1) is unchanged; no horizontal scroll. Restore: kill the server by pid, `git checkout lib/curriculum/src/englishGrammarG9.ts`, confirm `grep -c "LOCAL CHECK"` is 0 and `git status` is clean.
- [ ] **Step 3: Docs.** A top entry in `docs/status-log.md` («Grammar-only hub lessons, and the last five Grade 9 grammar lessons — built, shown to nobody yet»: what was built, the visibility rule, what was and was not verified, the limits, how to switch a lesson on), an index line at the top of `STATUS.md`'s «Recent changes», the spec's status set to implemented, and a note in `…-g9-lessons-design.md` that the five topics are now built.
- [ ] **Step 4: Push and PR.** `git fetch origin main`; merge `main` if behind (no rebase, no force-push); `git push origin ccr-d9db5f6c-mgwkuo`; the open draft PR #1212 now covers the passive fix, the hub change and the five lessons, so retitle it and rewrite its body; keep CI green.

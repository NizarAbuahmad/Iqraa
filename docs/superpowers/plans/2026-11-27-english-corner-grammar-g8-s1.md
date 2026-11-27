# English corner: Grade 8 Semester 1 grammar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ten Grade 8 Semester 1 grammar lessons grammar activities built from 400 hand-written items, one of them (`u5_l4`) a grammar-only hub lesson, every unit hidden until a teacher signs it off.

**Architecture:** Everything the Grade 10 work built is reused unchanged: the authored-items engine (`GrammarUnit.items`, `unitSentences`, `kind: 'form' | 'meaning'`, silent True or false, `buildCap(8)` = 9), the grammar-only hub mechanism (`GRAMMAR_ONLY_LESSONS`, `hubLessonVisible`) and the generalised teacher form (`englishGrammarReview.ts`). Grade 8 adds two new data files (`englishGrammarG8Items.ts`, `englishGrammarG8.ts`) shaped exactly like the Grade 10 pair, registers them in the engine and the form, adds one id to the grammar-only list, and generates a Grade 8 sheet and form. No engine, app, server or schema change.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script.

**Spec:** `docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md` (approved 2026-11-27). The Grade 10 spec and plans (`…2026-10-23-english-corner-grammar-g10-design.md`, `…2026-10-24-english-corner-grammar-g10-s2-design.md`, `docs/superpowers/plans/2026-10-24-english-corner-grammar-g10-s2.md`) are the model for everything here: read the Grade 10 files named below before writing the Grade 8 ones.

## Global Constraints

- All ten Grade 8 units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs set with the Edit tool and restored with `git checkout <file>`; `grep -rc "LOCAL CHECK" lib/curriculum/src artifacts/mobile` must be 0 before every commit).
- The Grade 1–5, 9 and 10 grammar sheets and forms and the four reading forms stay byte-identical (tests pin them). The Grade 8 sheet and form are new.
- Every sentence is 9 words or fewer (`buildCap(8)` is 9), so Build always takes it whole.
- A distractor is `form` (ungrammatical in standard English) or `meaning` (grammatical but excluded by a word in the sentence itself). Never a form real English accepts. `meaning` items exist only in the four sub-topics the contract table marks `meaning` (52 items in all; 348 are `form`).
- True or false on authored items is silent; false twins are never voiced (`allGrammarSpoken` omits them).
- No real or book-character name in any sentence; a family word (`Mum`, `Dad`) or a Jordanian place name (`Amman`, `Aqaba`, `Petra`) is fine. Nothing religious, political or sensitive.
- Arabic not-covered notes and form copy: no `"`, `&`, `<` or `>` in a note (the form does not escape runs); write the Arabic conjunction «و» with a space before an English word, never glued.
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No `sed -i`/`perl -pi` on source; use the Edit or Write tool. `git diff --stat` must show no `Bin N -> M bytes` line; new files must have no NUL bytes.
- Stage named paths only (never `git add -A` or `.`) and check `git diff --cached --stat` before each commit.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- The Latin product name is «Iqrra» in copy; repo and package names stay Iqraa.
- Work on branch `ccr-d9db5f6c-mgwkuo` (draft PR #1416, which already holds the spec). Do not push from a subagent; the controller pushes.
- With the sandbox's `R2_*` variables set, `r2.test.ts` fails by design: run the curriculum suite with `env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY`. Never print or read any `.env` file or environment value.
- No «ما الجديد» entry in this change (nothing is visible until a unit is signed); the PR body says so.

## File Structure

- **Create `lib/curriculum/src/englishGrammarG8Items.ts`:** `G8_ITEM_LESSONS` (ten entries in hub order), header comment, the `items(topic, kind, rows)` helper and `L(s)` = `` `kbl-g8-eng-s1-nccd-${s}` `` (a `g8` in the id). Shape and helper identical to `englishGrammarG10Items.ts`. Imports only types from the engine.
- **Create `lib/curriculum/src/englishGrammarG8.ts`:** `GRAMMAR_UNITS_G8` (one unit per lesson, `reviewedBy: null`, `patterns: []`, `slots: {}`, sorted by `hubLessonsForGrade(8)` order) and `NOT_COVERED_G8` (notes per lesson, see Task 1). Same shape as `englishGrammarG10.ts`.
- **Modify `lib/curriculum/src/englishGrammar.ts`:** import `GRAMMAR_UNITS_G8` and add it to `GRAMMAR_UNITS` (line 379, after `GRAMMAR_UNITS_G5`, before `GRAMMAR_UNITS_G9`).
- **Modify `lib/curriculum/src/englishGrammarReview.ts`:** import `NOT_COVERED_G8` and `G8_ITEM_LESSONS`; add `8: NOT_COVERED_G8` to the `NOT_COVERED` map (line 46); add `...G8_ITEM_LESSONS` to the statement lookup in `renderAuthoredUnit` (line 201); add a `GRADE_COPY[8]` entry (wording in Task 1).
- **Modify `lib/curriculum/src/englishHub.ts`:** `GRAMMAR_ONLY_LESSONS` gains `'kbl-g8-eng-s1-nccd-u5_l4'` (Task 2); the doc comment above it is updated.
- **Modify `lib/curriculum/scripts/grammar-sheet.ts`:** `8` is added to the grade list (line 28). Generate `docs/english-grammar-g8-review.html` and `docs/english-grammar-g8-sheet.md`.
- **Tests:** create `lib/curriculum/src/__tests__/englishGrammarG8Items.test.ts` and `…/englishGrammarG8.test.ts`; modify `…/englishHub.test.ts` (the grammar-only list, its count and the Grade 8 test, Task 2); create `artifacts/mobile/services/__tests__/englishGrammarG8ItemGames.test.ts` (Task 3).
- **Docs:** top of `docs/status-log.md`, `STATUS.md` «Recent changes» line (and the log's section count), the spec's status line.

The Grade 8 browser catalog already carries `u5_l4` («Grammar», unit 5 «Appearances», checked 2026-11-27), so the hub builds its lesson as soon as the id is in `GRAMMAR_ONLY_LESSONS`.

## The content contract (Tasks 1 and 2)

Sub-topics, sizes and kinds (each lesson sums to 40; 400 in all; 52 `meaning`, 348 `form`). `statement` is the lesson's `objectives[0]` copied verbatim from `lib/curriculum/src/data/iqra_curriculum_g8_eng_sem1.json` (lesson key = id after `-nccd-`, e.g. `u1_l1`); a test reads it back. Hub order is the order below. Lesson ids are `kbl-g8-eng-s1-nccd-u1_l1` etc.

Statements (verbatim): u1_l1 «I can use the Present Simple to talk about daily routines.» · u1_l3 «I can ask and answer questions about everyday life and use adverbs of frequency.» · u2_l1 «I can use there is/there are and some and any to talk about my home.» · u2_l3 «I can use can and can't to talk about household chores.» · u3_l1 «I can use countable and uncountable nouns to talk about diets.» · u3_l4 «I can use quantifiers to talk about amounts.» · u4_l1 «I can use the Present Continuous to talk about things happening now or temporary situations.» · u4_l3 «I can use the Present Simple and the Present Continuous to talk about regular actions and activities happening now/temporary situations.» · u5_l1 «I can use the Past Simple to talk about the past.» · u5_l4 «I can use the Past Simple to ask questions and give affirmative or negative answers.» (the data file's apostrophe in «can't» is a straight `'`).

| Lesson (`kbl-g8-eng-s1-nccd-…`) | Sub-topics: size, kind | What decides the answer, and which distractors are allowed | Example rows: `text` / answer / distractor |
| --- | --- | --- | --- |
| `u1_l1` | `third-person-s` 14 form · `spelling-es` 12 form · `negatives` 14 form | He/she/it + `-s`: distractor is the bare verb (`walk`) or a doubled `-s` (`walkss` is never used). `spelling-es`: `-es` after -ch, -sh, -s, -x, -o and `-ies` after consonant+y: distractor is the misspelt form (`watchs`, `studys`, `gos`). `negatives`: `doesn't`/`don't` + base verb: distractors `doesn't plays`, `don't plays`, `not play` | «She walks to school.» / walks / walk · «He watches TV at night.» / watches / watchs · «She doesn't play tennis.» / doesn't play / doesn't plays |
| `u1_l3` | `do-does-questions` 14 form · `question-words` 12 form · `adverb-position` 14 form | `Do`/`Does` + subject + base verb; wh-word + do/does + subject + base verb. Distractors: `Do he`, `Does he walks`, the wh-word with no auxiliary (`Where you live?`). `adverb-position`: before a main verb; the adverb sits inside the answer and the twin moves it between a main verb and its object (`always eats` / `eats always`, `usually walks` / `walks usually`); no be + adverb row («She always is late» is marked, not wrong English). **Never `sometimes`** (it can go first or last, so several positions are fine) | «Does he walk to school?» / Does he walk / Do he walk · «Where do you live?» / do you live / you live · «She always eats breakfast at home.» / always eats / eats always |
| `u2_l1` | `there-is-are` 14 form · `some-any` 14 form · `questions-negatives` 12 form | `there is` + singular or uncountable, `there are` + plural; `some` in positive sentences, `any` in negatives and questions. Distractors: the wrong be-form (`There is two beds`), `some` in a negative (`There aren't some chairs`). **No `Would you like some…?`** (some is correct in an offer). Questions/negatives are decided by agreement (`Are there any books?` / `Is there any books?`), never by word order alone | «There are two beds in my room.» / are / is · «There aren't any chairs.» / any / some · «Are there any books on the shelf?» / Are there / Is there |
| `u2_l3` | `can-form` 14 form · `can-questions` 12 form · `can-vs-cant` 14 meaning | `can` + base verb, no `to`, no `-s`; `Can you …?`; `can't`. Form distractors: `can cooks`, `can to cook`, `Do you can`. `can-vs-cant` (meaning): a second clause with «so» or «but» that states the clue (`He is three, so he can't wash dishes.` / can't / can). A sentence where either modal could follow is not written; the reviewer must be able to say which word excludes the distractor | «She can cook dinner.» / can cook / can cooks · «Can you wash the car?» / Can you / Do you can · «He is three, so he can't wash dishes.» / can't / can |
| `u3_l1` | `plural-nouns` 12 form · `uncountable` 14 form · `a-an-some` 14 form | Countable plural (`three apples`); an uncountable noun has no plural and no `a`/`an` (`some rice`, `a rice` is wrong); `a`/`an`/`some` with the right noun. **Uncountable items use only nouns with no ordinary plural: milk, rice, bread, meat, butter, cheese, water** — never sugar, fruit, paper, chicken, coffee, tea, cake, glass, juice (a test pins this for `uncountable`). An `a`/`an` twin in `a-an-some` only with rice, meat, butter, bread: «a milk», «a water» read as a serving | «I need three apples.» / apples / apple · «I want some bread.» / some / a · «We need some rice.» / some / a |
| `u3_l4` | `much-many` 14 form · `a-few-a-little` 14 form · `how-much-how-many` 12 form | `many` + countable plural, `much` + uncountable (in negatives and questions only: no `I have much money`); `a few` + countable, `a little` + uncountable; `How many` + plural, `How much` + uncountable | «There aren't many eggs.» / many / much · «I have a little milk.» / a little / a few · «How many apples do we need?» / many / much |
| `u4_l1` | `be-v-ing` 14 form · `spelling-ing` 12 form · `questions-negatives` 14 form | `am/is/are` + `-ing`. Distractors: the verb without `be` (`She reading`), the wrong be-form (`They is reading`, `She are reading`), `is reads`. **Never `is read`** (a grammatical passive). `spelling-ing` (running, making, writing, sitting, swimming, dying): the distractor is the misspelt form (`runing`, `makeing`). `questions-negatives`: `Is she sleeping?` / `Does she sleeping`, `isn't raining` / `don't raining` | «She is reading a book.» / is reading / reading · «He is running now.» / running / runing · «Is she sleeping?» / Is she sleeping / Does she sleeping |
| `u4_l3` | `habit-markers` 12 meaning · `now-markers` 12 meaning · `stative-verbs` 8 form · `questions` 8 form | Habit words decide the Simple (`every day`, `usually`, `often`, `rarely`, `on Fridays`); now words decide the Continuous (`now`, `right now`, `Look!`, `Listen!`, `at the moment`). **Never `this week` or `always`** (both forms fit). A habit twin is the Continuous and a now twin is the Simple (grammatical, excluded by the marker). `stative-verbs` (like, know, want, need, love, have = own): the twin is the Continuous of the verb (`I am liking`). `questions`: `Do you play chess every day?` / `Are you play…` form errors only | «We play chess every day.» / play / are playing · «Look! It is raining.» / is raining / rains · «I like pizza.» / like / am liking |
| `u5_l1` | `regular-ed` 12 form · `irregular` 14 form · `past-time-markers` 14 meaning | Regular `-ed` with the spelling rules (stopped, studied, planned); the second form of the irregular verb (went, saw, had, ate, took, ran, came, wrote, bought, met). Form distractors: `goed`, `eated`, `studyed`, `stoped`. `past-time-markers` (meaning): `yesterday`, `last week/night/year`, `two days ago` exclude the present form | «She walked to school.» / walked / walk · «We went to the park.» / went / goed · «She visited her aunt yesterday.» / visited / visits |
| `u5_l4` | `did-questions` 14 form · `didnt-negatives` 14 form · `wh-did` 12 form | `Did` + subject + base verb; `didn't` + base verb; wh-word + `did` + subject + base verb. Distractors: the past form after did (`Did you saw`, `didn't went`), `Do you saw` / `Does he went`, the wh-word with no `did` (`Where she went?` is a question without an auxiliary) | «Did you see the film?» / Did you see / Did you saw · «He didn't go to school.» / didn't go / didn't went · «Where did she go?» / did she go / did she went |

Authoring rules, every item:

1. Nine words or fewer; one grammar point; what decides the answer is in the sentence.
2. In a `meaning` sub-topic the distractor is grammatical but a marker in the sentence rules it out (a reviewer must be able to say which word excludes it). If you cannot write the pinned number of such items for a sub-topic without a distractor that could fit, change that sub-topic to `form` items, update its pinned kind in the test (and the totals tests: meaning count, form count), and say so in the report (the controller edits the spec and the log).
3. A `form` distractor is ungrammatical in standard English; never a form real English accepts. A spelling distractor (`runing`, `studyed`, `watchs`) is allowed only in `spelling-es`, `spelling-ing`, `regular-ed`.
4. An adverb sits inside the answer so the false twin keeps standard order (`always eats` / `eats always`; no be + adverb row). A time word alone (`while`, `before`, `already`) does not decide a tense.
5. `answer` appears exactly once as whole words, case-sensitive; trailing punctuation stays in `text` (the engine moves it to the distractor). For a two-sentence text (`Look! It is raining.`) keep the answer in one of them.
6. No name; no repeated `text` within a lesson; a twin (the sentence with the distractor in place) must never equal another true sentence of the lesson.
7. A question item whose distractor is a grammatical question in another word order (`Is there a sofa?` against `Is a sofa there?`) is not written; the twin must be ungrammatical.
8. Vocabulary from common school words and function words; few words outside the function-word list (they print on the form for the teacher). No digits needed.
9. Be conservative where a teacher could dispute: note in your report any item you think a teacher could dispute.

Item helper (copy it into the new data file): `items(topic, kind, rows)` with `type Row = [text: string, answer: string, distractor: string]`.

---

### Task 1: Wiring, wording, and lessons u1_l1, u1_l3, u2_l1, u2_l3, u3_l1

**Files:**
- Create: `lib/curriculum/src/englishGrammarG8Items.ts`, `lib/curriculum/src/englishGrammarG8.ts`
- Modify: `lib/curriculum/src/englishGrammar.ts`, `lib/curriculum/src/englishGrammarReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`
- Create tests: `lib/curriculum/src/__tests__/englishGrammarG8Items.test.ts`, `…/englishGrammarG8.test.ts`
- Generate: `docs/english-grammar-g8-review.html`, `docs/english-grammar-g8-sheet.md`

**Interfaces:**
- Consumes: `GrammarItem` (`englishGrammar.ts`), `GrammarUnit`, `hubLessonsForGrade`, `unitSentences`, `grammarUnit`, `grammarUnitsForGrade`.
- Produces: `G8_ITEM_LESSONS` (5 entries now, 10 after Task 2, each `{ lessonId, statement, items }`); `GRAMMAR_UNITS_G8`; `NOT_COVERED_G8: Record<string, string[]>`; Grade 8 present in `GRAMMAR_UNITS`; `renderGrammarReviewHtml(8)` and `renderGrammarSheet(8)` working.

- [ ] **Step 1: Write the failing tests.**

Create `lib/curriculum/src/__tests__/englishGrammarG8Items.test.ts` by copying `englishGrammarG10Items.test.ts` (`cp`, then edit with the Edit tool; do not use sed) and changing exactly the following. Everything not listed stays as in the Grade 10 file (the buildable/unique/never-a-Yes-or-No test, the differing-twin test, the capitalised-name test, the audio-list test, the GRAMMAR_UNITS test).

1. Header comment: «Grade 8 grammar on the authored Semester 1 lessons (docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md): the lessons, their book statements, the item rules and the audio list. …» (keep the last sentence about a teacher's call).
2. Imports: `G8_ITEM_LESSONS` from `'../englishGrammarG8Items.ts'` instead of `G10_ITEM_LESSONS`; drop nothing else.
3. Replace the data-file and id helpers and the lesson lists with:

```ts
const dataFile = () => JSON.parse(readFileSync(new URL('../data/iqra_curriculum_g8_eng_sem1.json', import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;
const FIRST = ['u1_l1', 'u1_l3', 'u2_l1', 'u2_l3', 'u3_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G8_ITEM_LESSONS.map(l => l.lessonId);
```

4. `SIZES` for the five lessons of this task:

```ts
const SIZES: Record<string, Record<string, [number, 'form' | 'meaning']>> = {
  [L('u1_l1')]: { 'third-person-s': [14, 'form'], 'spelling-es': [12, 'form'], negatives: [14, 'form'] },
  [L('u1_l3')]: { 'do-does-questions': [14, 'form'], 'question-words': [12, 'form'], 'adverb-position': [14, 'form'] },
  [L('u2_l1')]: { 'there-is-are': [14, 'form'], 'some-any': [14, 'form'], 'questions-negatives': [12, 'form'] },
  [L('u2_l3')]: { 'can-form': [14, 'form'], 'can-questions': [12, 'form'], 'can-vs-cant': [14, 'meaning'] },
  [L('u3_l1')]: { 'plural-nouns': [12, 'form'], uncountable: [14, 'form'], 'a-an-some': [14, 'form'] },
};
```

5. Describe title `'Grade 8 authored lessons'`. First test «are the hub lessons in order, unsigned and offered to nobody»: `assert.deepEqual(ids(), FIRST);` and `assert.equal(hubLesson(id)!.grade, 8, id);`.
6. Replace the grammar-only test with a test that for now every lesson in `ids()` is **not** grammar-only (`assert.equal(!!hubLesson(id)!.grammarOnly, false, id)` and `GRAMMAR_ONLY_LESSONS.includes(id) === false`); Task 2 replaces it.
7. Statement test: `const lesson = dataFile().units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);` (same `key` logic).
8. Totals test «are 5 lessons and 200 items, 14 of them meaning-decided»: `G8_ITEM_LESSONS.length === 5`; item sum `200`; `grammarUnitsForGrade(8).length === 5`; meaning count `14`, equal to the sum of the pinned `meaning` sizes in `SIZES`.
9. Delete the two present-perfect tests (`past simple as a present perfect distractor`, `keep a have/has auxiliary`), the zero-conditional test and the `must of` test. Add these Grade 8 guards:

```ts
  it('use only nouns with no ordinary plural in the uncountable sub-topic', () => {
    const countableToo = /\b(sugar|fruit|paper|chicken|coffee|tea|cake|glass|juice)s?\b/i;
    for (const x of sentencesOf(L('u3_l1')).filter(y => y.patternId === 'uncountable')) {
      assert.ok(!countableToo.test(x.text), x.text);
    }
  });

  it('never test the adverb «sometimes» for position', () => {
    for (const x of sentencesOf(L('u1_l3')).filter(y => y.patternId === 'adverb-position')) {
      assert.ok(!/\bsometimes\b/i.test(x.text), x.text);
    }
  });

  it('state the clue for can / can\'t in a so or but clause', () => {
    for (const x of sentencesOf(L('u2_l3')).filter(y => y.patternId === 'can-vs-cant')) {
      assert.ok(/\b(so|but)\b/i.test(x.text), x.text);
    }
  });
```

10. Form describe `'the Grade 8 teacher form'`: `renderGrammarReviewHtml(8)`; the docs names `english-grammar-g8-review.html` / `english-grammar-g8-sheet.md` with `renderGrammarSheet(8)`; unit count `html.split('class="unit"').length - 1` equals `5`; `html.includes('الصف الثامن')`; ids shown without prefix: `html.includes('>s1-nccd-u1_l1<')` and `>s1-nccd-u3_l1<`, and `!html.includes('>kbl-g8-')`; kind counts `kind-meaning` `14` and `kind-form` `186`; the «names both semesters» test becomes «names Semester 1 in its lead»: `html.includes('الفصل الأول')` (and nothing about the second semester); keep the «و» glue test and the every-sentence test; the «leaves the other grades alone» loop runs over `[1, 2, 3, 4, 5, 9, 10]`.

Create `lib/curriculum/src/__tests__/englishGrammarG8.test.ts` (copy `englishGrammarG10.test.ts`):

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G8, NOT_COVERED_G8 } from '../englishGrammarG8.ts';
import { offeredGrammar } from '../englishGrammar.ts';

const IDS = ['u1_l1', 'u1_l3', 'u2_l1', 'u2_l3', 'u3_l1'].map(s => `kbl-g8-eng-s1-nccd-${s}`);

describe('Grade 8 grammar units', () => {
  it('are the grammar lessons in hub order, all unsigned', () => {
    assert.deepEqual(GRAMMAR_UNITS_G8.map(u => u.lessonId), IDS);
    for (const u of GRAMMAR_UNITS_G8) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    assert.deepEqual(Object.keys(NOT_COVERED_G8).sort(), [...IDS].sort());
    for (const id of IDS) {
      const notes = NOT_COVERED_G8[id]!;
      assert.ok(notes.length >= 3, id);
      for (const n of notes) {
        assert.ok(!/["&<>]/.test(n), `${id}: ${n}`);
        assert.ok(!/[ء-ي]و[A-Za-z]|(^|\s)و[A-Za-z]/.test(n), `${id}: «و» glued to an English word: ${n}`);
      }
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY node --experimental-strip-types --test src/__tests__/englishGrammarG8Items.test.ts src/__tests__/englishGrammarG8.test.ts`
Expected: FAIL (cannot find module `../englishGrammarG8Items.ts`).

- [ ] **Step 3: Create the data file with the first five lessons.**

`lib/curriculum/src/englishGrammarG8Items.ts` starts with a header comment in the style of `englishGrammarG10Items.ts` (what a distractor is, `form` / `meaning`, nine words, no names, `statement` is the book's own line, imports only types from the engine; spec path `docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md`), then:

```ts
import type { GrammarItem } from './englishGrammar.ts';

type Row = [text: string, answer: string, distractor: string];
const items = (topic: string, kind: GrammarItem['kind'], rows: Row[]): GrammarItem[] =>
  rows.map(([text, answer, distractor]) => ({ topic, kind, text, answer, distractor }));

const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;

export const G8_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [
  {
    lessonId: L('u1_l1'),
    statement: 'I can use the Present Simple to talk about daily routines.',
    items: [
      // one comment per sub-topic stating what decides the answer, as in englishGrammarG10Items.ts
      ...items('third-person-s', 'form', [ /* 14 rows: [text, answer, distractor] */ ]),
      ...items('spelling-es', 'form', [ /* 12 rows */ ]),
      ...items('negatives', 'form', [ /* 14 rows */ ]),
    ],
  },
  // u1_l3, u2_l1, u2_l3, u3_l1 in the same way, statements verbatim from the contract
];
```

Fill every `rows` array with the real sentences (the comments above only show where rows go; none may be left empty), following the contract table and the authoring rules. Lesson order is the order of the contract table.

- [ ] **Step 4: Create the units file.**

`lib/curriculum/src/englishGrammarG8.ts`:

```ts
/**
 * Grade 8 grammar for the English corner: the authored Semester 1 lessons (spec:
 * docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md), each a unit of hand-written items from
 * `englishGrammarG8Items.ts`. Nothing is pictured. Every unit ships `reviewedBy: null`: offered to nobody until a teacher
 * signs the printed form (`docs/english-grammar-g8-review.html`). `NOT_COVERED_G8` is what the form says is left out.
 *
 * Imports only types from the engine, and the hub (which does not import the engine): `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';
import { G8_ITEM_LESSONS } from './englishGrammarG8Items.ts';
import { hubLessonsForGrade } from './englishHub.ts';

const HUB_ORDER = new Map(hubLessonsForGrade(8).map((l, i) => [l.id, i]));

const UNITS_G8: GrammarUnit[] = G8_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items }) satisfies GrammarUnit);

/** In the book's order, so the sheet reads unit by unit. */
export const GRAMMAR_UNITS_G8: GrammarUnit[] = [...UNITS_G8].sort((a, b) => HUB_ORDER.get(a.lessonId)! - HUB_ORDER.get(b.lessonId)!);

const SHARED = [
  'لا صور ولا «نعم أم لا» في هذا الدرس: الجملة تُحدِّد الصيغة، والأسئلة عن القواعد لا عن المعلومات.',
  '«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها. «اختر الكلمة» و«رتّب الجملة» يقرآن الجملة الصحيحة بعد الإجابة.',
];

const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;

/** What a Grade 8 lesson does not cover, and why — printed on the teacher's form. One bullet per item, no `"`, `&`, `<` or `>`. */
export const NOT_COVERED_G8: Record<string, string[]> = {
  [L('u1_l1')]: [...SHARED, 'المضارع البسيط للروتين اليومي: -s أو -es مع he و she و it، والنفي بـ doesn\'t أو don\'t مع المصدر؛ الخيارات الخاطئة كلها في الشكل. المضارع المستمر غير مشمول هنا لأنه موضوع الوحدة الرابعة.'],
  [L('u1_l3')]: [...SHARED, 'أسئلة do و does وكلمات الاستفهام وموضع ظرف التكرار (she always eats breakfast لا she eats always breakfast)؛ الخيارات الخاطئة كلها في الشكل أو الترتيب. وكلمة sometimes غير مشمولة لأنها تقبل أكثر من موضع في الجملة.'],
  [L('u2_l1')]: [...SHARED, 'there is مع المفرد وغير المعدود و there are مع الجمع، و some في الإثبات و any في النفي والسؤال. جملة مثل Would you like some tea? غير مشمولة لأن some تأتي فيها في سؤال.'],
  [L('u2_l3')]: [...SHARED, 'can للقدرة والمساعدة في أعمال المنزل: الفعل بعد can بلا to وبلا -s، والسؤال Can you؟. في صفوف can و can\'t الخيار الخاطئ سليم لغويًا لكن جملة بعده تبدأ بـ so أو but تستبعده، وهي أحكام يراجعها المعلم.'],
  [L('u3_l1')]: [...SHARED, 'المعدود (an apple، three eggs) وغير المعدود (some rice، water) ولا جمع لغير المعدود في الجمل. لا تُستخدم أسماء لها جمع مقبول مثل sugar أو fruit أو paper.'],
};
```

(Task 2 adds the other five notes, written in the same style: see the note texts there.)

- [ ] **Step 5: Register the units in the engine.**

In `lib/curriculum/src/englishGrammar.ts`: add `import { GRAMMAR_UNITS_G8 } from './englishGrammarG8.ts';` next to the `GRAMMAR_UNITS_G10` import (line 25) and change line 379 to `…, ...GRAMMAR_UNITS_G5, ...GRAMMAR_UNITS_G8, ...GRAMMAR_UNITS_G9, ...GRAMMAR_UNITS_G10];`.

- [ ] **Step 6: Wire the form.**

In `lib/curriculum/src/englishGrammarReview.ts`: add `import { NOT_COVERED_G8 } from './englishGrammarG8.ts';` and `import { G8_ITEM_LESSONS } from './englishGrammarG8Items.ts';` beside the Grade 10 imports (lines 23–24); line 46 becomes `{ 2: …, 5: NOT_COVERED_G5, 8: NOT_COVERED_G8, 9: NOT_COVERED_G9, 10: NOT_COVERED_G10 }`; line 201 becomes `[...G5_ITEM_LESSONS, ...G8_ITEM_LESSONS, ...G9_ITEM_LESSONS, ...G10_ITEM_LESSONS]`. Add `GRADE_COPY[8]` (insert before `9:`), a copy of the Grade 10 entry (`10: {` at line 460) with these changes only:

- `title: 'مراجعة قواعد الصف الثامن'`, `eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثامن'`.
- `lead`:

```ts
    lead: (total, units) => `هذه مراجعة قواعد الصف الثامن، الفصل الأول: ${AR_DIGITS(units)} ${units > 10 ? 'درسًا' : 'دروس'} كُتبت جملها واحدةً واحدة، لكل جملة إجابتها الصحيحة وخيار مموِّه. الكتاب يعطي هدفًا لكل درس دون جمل نموذجية، فكل جملة هنا كتبناها نحن، وتُراجَع هنا قبل أي ظهور لها. أغلب الجمل يختبر الشكل (جمع الفعل، did مع المصدر، much أو many)، وبعضها يختبر الاختيار بين صيغتين بكلمة في الجملة (المضارع البسيط والمستمر، الماضي البسيط، can أو can't)، فنوع المموِّه مطبوع لكل جملة: <b>form</b> غير سليم لغويًا، و <b>meaning</b> سليم لكن كلمة في الجملة نفسها تستبعده. لا صور في أي درس. <b>لن يرى الطلاب أي درس قبل أن توافقوا عليه</b>، ودرس الماضي البسيط (الأسئلة والنفي) لا مفردات له، فلا يظهر في الركن إلا بعد توقيعكم. هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
```

- `acts`: the Grade 10 text with the first act's examples replaced by `<span dir="ltr">walks / walk</span>` and `<span dir="ltr">many / much</span>`; the other two acts unchanged.
- `checks`: as Grade 10, except the fifth line becomes `'في درس المضارع المستمر والماضي البسيط وجمل can و can\'t: هل الجمل واضحة دون سياق أوسع؟'` and the sixth `'في «الكلمات خارج قوائم المفردات»: وافقوا على الكلمات المناسبة للصف الثامن واشطبوا الباقي.'`. The line that opens `'هل رقم الدرس يطابق صفحة الكتاب؟…` stays. Add one more check at the end of the list, for the spec's fourth open point: `'هل مموِّهات التهجئة (runing و studyed) سؤال عادل لطلاب الصف الثامن، أم تُترك التهجئة؟'`.
- `extraCss`: identical to Grade 10's.

In `lib/curriculum/scripts/grammar-sheet.ts` line 28 the grade list becomes `[1, 2, 3, 4, 5, 8, 9, 10]`.

- [ ] **Step 7: Generate the Grade 8 documents.**

Run: `pnpm --filter @workspace/curriculum run grammar-sheet`
Then `git status --short docs/` must show only the two new Grade 8 files as untracked and **no other** docs file modified (if another grade's form or sheet changes, stop and report).

- [ ] **Step 8: Run the tests and the type check.**

Run: `cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY node --experimental-strip-types --test "src/**/__tests__/**/*.test.ts"` and `npx tsc --noEmit -p .`
Expected: all pass, typecheck clean. Fix any failing item (a rule violation names the sentence).

- [ ] **Step 9: Commit.**

```bash
git add lib/curriculum/src/englishGrammarG8Items.ts lib/curriculum/src/englishGrammarG8.ts lib/curriculum/src/englishGrammar.ts lib/curriculum/src/englishGrammarReview.ts lib/curriculum/scripts/grammar-sheet.ts lib/curriculum/src/__tests__/englishGrammarG8Items.test.ts lib/curriculum/src/__tests__/englishGrammarG8.test.ts docs/english-grammar-g8-review.html docs/english-grammar-g8-sheet.md
git diff --cached --stat
git commit -m "English corner: Grade 8 grammar, first five Semester 1 lessons (hidden until signed)"
```

---

### Task 2: Lessons u3_l4, u4_l1, u4_l3, u5_l1, u5_l4, the grammar-only entry, and the totals

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG8Items.ts`, `lib/curriculum/src/englishGrammarG8.ts`, `lib/curriculum/src/englishHub.ts`
- Modify tests: `…/englishGrammarG8Items.test.ts`, `…/englishGrammarG8.test.ts`, `…/englishHub.test.ts`
- Regenerate: `docs/english-grammar-g8-review.html`, `docs/english-grammar-g8-sheet.md`

**Interfaces:**
- Consumes: Task 1's `G8_ITEM_LESSONS`, `GRAMMAR_UNITS_G8`, `NOT_COVERED_G8`, the `items` helper.
- Produces: all ten lessons (400 items, 52 meaning); `GRAMMAR_ONLY_LESSONS` containing `kbl-g8-eng-s1-nccd-u5_l4`; a Grade 8 hub with exactly one more lesson than before this task.

- [ ] **Step 1: Update the tests so they fail.**

In `englishGrammarG8Items.test.ts`:

1. `const REST = ['u3_l4', 'u4_l1', 'u4_l3', 'u5_l1', 'u5_l4'].map(L);` and the order test becomes `assert.deepEqual(ids(), [...FIRST, ...REST]);`.
2. Add to `SIZES`:

```ts
  [L('u3_l4')]: { 'much-many': [14, 'form'], 'a-few-a-little': [14, 'form'], 'how-much-how-many': [12, 'form'] },
  [L('u4_l1')]: { 'be-v-ing': [14, 'form'], 'spelling-ing': [12, 'form'], 'questions-negatives': [14, 'form'] },
  [L('u4_l3')]: { 'habit-markers': [12, 'meaning'], 'now-markers': [12, 'meaning'], 'stative-verbs': [8, 'form'], questions: [8, 'form'] },
  [L('u5_l1')]: { 'regular-ed': [12, 'form'], irregular: [14, 'form'], 'past-time-markers': [14, 'meaning'] },
  [L('u5_l4')]: { 'did-questions': [14, 'form'], 'didnt-negatives': [14, 'form'], 'wh-did': [12, 'form'] },
```

3. Grammar-only test (replaces Task 1's stand-in):

```ts
  it('make only the Past Simple questions lesson grammar-only, under the word floor, and the rest lessons with words', () => {
    const grammarOnly = (id: string) => id === L('u5_l4');
    for (const id of ids()) {
      assert.equal(!!hubLesson(id)!.grammarOnly, grammarOnly(id), id);
      assert.equal(GRAMMAR_ONLY_LESSONS.includes(id), grammarOnly(id), id);
    }
  });
```

4. Totals: title «are 10 lessons and 400 items, 52 of them meaning-decided»; `length === 10`, items `400`, `grammarUnitsForGrade(8).length === 10`, meaning `52` (still equal to the pinned sum).
5. Add the marker guards:

```ts
  it('decide the Simple against the Continuous by a habit word or a now word, never «this week» or «always»', () => {
    const habit = /\b(every|usually|often|rarely|on (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)days)\b/i;
    const now = /\b(now|Look!|Listen!|at the moment)/i;
    for (const x of sentencesOf(L('u4_l3'))) {
      if (x.patternId === 'habit-markers') assert.ok(habit.test(x.text), x.text);
      if (x.patternId === 'now-markers') assert.ok(now.test(x.text), x.text);
      if (x.kind === 'meaning') assert.ok(!/\b(always|this week)\b/i.test(x.text), x.text);
    }
  });

  it('decide the Past Simple against the present by a past time word', () => {
    for (const x of sentencesOf(L('u5_l1')).filter(y => y.patternId === 'past-time-markers')) {
      assert.ok(/\b(yesterday|last \w+|\w+ ago)\b/i.test(x.text), x.text);
    }
  });

  it('keep did out of the past form in the Past Simple questions lesson, so no twin is a grammatical past question', () => {
    for (const x of sentencesOf(L('u5_l4'))) {
      assert.ok(/\b(did|didn't|Did)\b/.test(x.text), `${x.text}: the true sentence uses did`);
    }
  });
```

6. Form test: unit count `10`, kind counts `kind-meaning` `52` and `kind-form` `348`; add `>s1-nccd-u5_l4<`; the intro «ten lessons» is not asserted.

In `englishGrammarG8.test.ts`: `IDS` gains the five new ids in order.

In `englishHub.test.ts`:
- `GRAMMAR_ONLY` (line ~262) gains `'kbl-g8-eng-s1-nccd-u5_l4'` as the last element; the test title that says «twenty-two lessons are grammar-only (seven in Grade 9; in Grade 10 …)» becomes «twenty-three lessons are grammar-only (one in Grade 8, seven in Grade 9; in Grade 10 …)» (keep the rest of the title as it is).
- The Grade 8 test (`grade 8 offers both semesters, units 1–10`, line ~101): replace `assert.deepEqual(lessons.map(l => l.id).sort(), expected);` with

```ts
  const grammarOnly = GRAMMAR_ONLY_LESSONS.filter(id => id.startsWith('kbl-g8-eng-'));
  assert.deepEqual(lessons.map(l => l.id).sort(), [...expected, ...grammarOnly].sort());
```

- The per-grade count test (`the hub has 42 Grade 9 and 35 Grade 10 lessons now…`) does not include Grade 8 and stays.

- [ ] **Step 2: Run them to verify they fail.**

Run the three test files as in Task 1, Step 2 (`englishHub.test.ts` included).
Expected: FAIL (the five lessons and the hub id are missing).

- [ ] **Step 3: Add the hub id first.**

In `lib/curriculum/src/englishHub.ts`, append `'kbl-g8-eng-s1-nccd-u5_l4',` as the last element of `GRAMMAR_ONLY_LESSONS` (with a one-line comment: «Grade 8 semester 1's Past Simple questions lesson: it prints no Word List of its own.») and extend the doc comment above the array with «and Grade 8's Past Simple questions lesson». Do not run the suite yet: the hub test needs the unit from Step 4.

- [ ] **Step 4: Add the five lessons and their notes.**

Append the five lessons to `G8_ITEM_LESSONS` in `englishGrammarG8Items.ts` in the contract order, with real rows for every sub-topic. Statements verbatim from the contract. Add the notes to `NOT_COVERED_G8` (same style, no `"&<>`, no glued «و»):

```ts
  [L('u3_l4')]: [...SHARED, 'much و many و a few و a little و how much و how many: العدّ يُحدِّد الخيار. تُستخدم much و many في النفي والسؤال فقط، فجملة مثل I have much money غير مشمولة لأن a lot of أنسب منها في الإثبات.'],
  [L('u4_l1')]: [...SHARED, 'المضارع المستمر: am أو is أو are مع -ing، والتهجئة (running، making)، والسؤال والنفي. الخيارات الخاطئة كلها في الشكل؛ والمقابلة بين البسيط والمستمر في الدرس التالي.'],
  [L('u4_l3')]: [...SHARED, 'البسيط مع كلمات العادة (every day، usually، on Fridays) والمستمر مع now أو Look! أو at the moment؛ وكلمتا this week و always غير مشمولتين لأنهما تقبلان الصيغتين. أفعال الحالة (like، know) لا تأتي بصيغة المستمر.'],
  [L('u5_l1')]: [...SHARED, 'الماضي البسيط: -ed للمنتظمة (وتهجئة studied و stopped) والصيغة الثانية للشاذة (went لا goed). وكلمات yesterday و last week و ago تستبعد المضارع في صفوف الزمن؛ والخيار الخاطئ فيها سليم لغويًا لكن الكلمة تستبعده.'],
  [L('u5_l4')]: [...SHARED, 'هذا الدرس بلا أنشطة كلمات أو قراءة لأنه بلا مفردات؛ لن يظهر للطلاب إلا بعد توقيعكم.', 'Did في السؤال والنفي يأخذ المصدر بلا -ed (Did you see لا Did you saw، didn\'t go لا didn\'t went)؛ والإجابات القصيرة (Yes, I did) غير مشمولة.'],
```

- [ ] **Step 5: Regenerate the documents and run everything.**

Run: `pnpm --filter @workspace/curriculum run grammar-sheet`, then the full curriculum suite and `npx tsc --noEmit -p .` as in Task 1, Step 8. `git status --short docs/` must show only the two Grade 8 files modified.
Expected: all pass; the Grade 8 form lists ten lessons.

- [ ] **Step 6: Commit.**

```bash
git add lib/curriculum/src/englishGrammarG8Items.ts lib/curriculum/src/englishGrammarG8.ts lib/curriculum/src/englishHub.ts lib/curriculum/src/__tests__/englishGrammarG8Items.test.ts lib/curriculum/src/__tests__/englishGrammarG8.test.ts lib/curriculum/src/__tests__/englishHub.test.ts docs/english-grammar-g8-review.html docs/english-grammar-g8-sheet.md
git diff --cached --stat
git commit -m "English corner: Grade 8 grammar, the last five Semester 1 lessons and the grammar-only entry"
```

---

### Task 3: The app plays them, and the form looks right

**Files:**
- Create: `artifacts/mobile/services/__tests__/englishGrammarG8ItemGames.test.ts`

**Interfaces:**
- Consumes: `grammarUnit`, `unitSentences`, `allGrammarSpoken` (`@workspace/curriculum/englishGrammar`); `buildChooseRound`, `buildSentenceRound`, `buildTrueFalseRound`, `grammarActivityAvailable`, `isSentenceBuilt`, `isSilentTrueFalse` (`../englishHub/games.ts`); `makeRng`.
- Produces: the app-side pin that Choose, Build and True or false are offered on all ten lessons, Yes or No on none, True or false silent.

- [ ] **Step 1: Write the test.**

`cp artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts artifacts/mobile/services/__tests__/englishGrammarG8ItemGames.test.ts`, then edit with the Edit tool: the header comment («The ten authored Grade 8 Semester 1 lessons on the app side (spec: docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md): Choose, Build and True or false on hand-written items, no Yes or No, and a True or false that plays no sound. The Past Simple questions lesson (u5_l4) is grammar-only, with no words.»), the `LESSONS` constant:

```ts
const LESSONS = ['u1_l1', 'u1_l3', 'u2_l1', 'u2_l3', 'u3_l1', 'u3_l4', 'u4_l1', 'u4_l3', 'u5_l1', 'u5_l4']
  .map(s => `kbl-g8-eng-s1-nccd-${s}`);
```

`assert.equal(LESSONS.length, 10)`, and every `Grade 10` in a describe or test title becomes `Grade 8`. Everything else (rounds, silence, the audio list) stays.

- [ ] **Step 2: Run it.**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishGrammarG8ItemGames.test.ts` (use the mobile package's own `pnpm test` line if this form fails to resolve `@workspace/curriculum`; the Grade 10 file shows the working form).
Expected: PASS (the data exists after Task 2).

- [ ] **Step 3: Browser check with temporary sign-offs.**

Run `pnpm run dev:mobile:web` (note the port it listens on), and in a browser at 390 px width, in Arabic and in English:
1. Edit `reviewedBy` of **one** Grade 8 unit and of `u5_l4` in `lib/curriculum/src/englishGrammarG8.ts` to a local value with a comment `// LOCAL CHECK` (Edit tool).
2. Confirm: the Grade 8 index shows no grammar row before the edit; `u5_l4` is absent from the Grade 8 index and its URL says «lesson not found» until signed; signed, it appears with only Choose, Build and True or false; no horizontal scroll; the signed words lesson shows its grammar row.
3. Restore with `git checkout lib/curriculum/src/englishGrammarG8.ts` and confirm `grep -rc "LOCAL CHECK" lib/curriculum/src artifacts/mobile` is 0 everywhere. If the browser check cannot be run in the sandbox, say so in the report rather than skipping silently.

- [ ] **Step 4: Commit.**

```bash
git add artifacts/mobile/services/__tests__/englishGrammarG8ItemGames.test.ts
git diff --cached --stat
git commit -m "English corner: Grade 8 grammar is played correctly in the app"
```

---

### Task 4: Verify, document

**Files:**
- Modify: `docs/status-log.md`, `STATUS.md`, `docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md`

- [ ] **Step 1: Run what CI runs.**

`pnpm run typecheck`; curriculum `test` (with the `R2_*` variables unset as in Global Constraints) and `verify` (`pnpm --filter @workspace/curriculum run verify`); mobile `pnpm test`; api-server `pnpm build` then `pnpm test`. Every one passes except `r2.test.ts` if it fails here with and without this change (check with `git stash`, never skip).

- [ ] **Step 2: Write up.**

Add an entry at the **top** of `docs/status-log.md` titled «Grade 8 grammar (Semester 1) in the English corner — built, shown to nobody yet» (what was built: 10 lessons, 400 items, 52 meaning / 348 form, the grammar-only lesson, the form and sheet; any sub-topic that changed kind and why; what was and was not verified, including whether the browser check ran; known limits from the spec), add the matching line at the top of `STATUS.md` «Recent changes» (keep it at 30 entries) and bump «The log has N sections». Set the spec's status line to `implemented (PR #1416)`.

- [ ] **Step 3: Commit and report.**

```bash
git add docs/status-log.md STATUS.md docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md
git diff --cached --stat
git commit -m "English corner: Grade 8 grammar write-up"
```

The controller then merges `origin/main`, resolves any `STATUS.md` / `docs/status-log.md` conflict (keep both sides, newest first), pushes, updates draft PR #1416's title and body (no «ما الجديد» entry: nothing is visible until a unit is signed), and waits for the user to say "merge it".

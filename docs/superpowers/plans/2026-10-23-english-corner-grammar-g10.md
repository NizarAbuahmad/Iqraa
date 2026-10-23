# English corner: Grade 10 grammar, Semester 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the eleven Grade 10 Semester 1 grammar lessons (ten already in the English hub, plus Articles as a grammar-only lesson) grammar activities built from 440 hand-written items, hidden until a teacher signs off.

**Architecture:** The authored-items engine (`GrammarUnit.items`, `unitSentences`, `kind: 'form' | 'meaning'`, silent True or false, `buildCap(10)` = 9), the grammar-only hub mechanism (`GRAMMAR_ONLY_LESSONS`, `hubLessonVisible`) and the grade-generic teacher form already exist from the Grade 9 and Grade 5 work. Grade 10 is data (two new files), one hub-list entry, `GRADE_COPY[10]`, and a small tweak so the form shows Grade 10 ids (they have no `g10`).

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script.

**Spec:** `docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md`

## Global Constraints

- All eleven units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs set with the Edit tool and restored with `git checkout <file>`; `grep -rc "LOCAL CHECK" lib/curriculum/src artifacts/mobile/services` must show no non-zero count afterwards).
- The Grade 1–5 and Grade 9 grammar sheets and forms and the four reading forms stay byte-identical (tests pin them).
- Every sentence is 9 words or fewer (`buildCap(10)` is 9), so Build always takes it whole.
- A distractor is `form` (ungrammatical in standard English) or `meaning` (grammatical but excluded by something in the sentence itself: a time or quantity marker, a conjunction, a fixed expression). Never a form that could fit. A `meaning` item exists only in the sub-topics the table below marks `meaning`; a topic where two forms could both fit tests `form` only.
- True or false on authored items is silent; false twins are never voiced (`allGrammarSpoken` omits them).
- No real or book-character name in any sentence; a family word (`Mum`, `Dad`) or a Jordanian place name (`Amman`, `Aqaba`, `Petra`) is fine. Nothing religious, political or sensitive.
- Arabic not-covered notes and form copy: no `"`, `&`, `<` or `>` in a note (the form does not escape runs); write the Arabic conjunction «و» with a space before an English word, never glued (a known display problem in older notes).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No `sed -i`/`perl -pi` on source; use the Edit or Write tool. `git diff --stat` must show no `Bin N -> M bytes` line; new files must have no NUL bytes.
- Stage named paths only (never `git add -A` or `.`) and check `git diff --cached --stat` before each commit.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- The Latin product name is «Iqrra» in copy; repo and package names stay Iqraa.
- Work on branch `ccr-d9db5f6c-mgwkuo` (already reset to `main`). Do not push from a subagent; the controller pushes.

## File Structure

- Create `lib/curriculum/src/englishGrammarG10Items.ts`: `G10_ITEM_LESSONS` (lesson id, book statement, items), eleven entries in hub order.
- Create `lib/curriculum/src/englishGrammarG10.ts`: `GRAMMAR_UNITS_G10` (eleven units, `patterns: []`, `reviewedBy: null`) and `NOT_COVERED_G10`.
- Modify `lib/curriculum/src/englishGrammar.ts`: import and spread `GRAMMAR_UNITS_G10` into `GRAMMAR_UNITS`.
- Modify `lib/curriculum/src/englishHub.ts`: `GRAMMAR_ONLY_LESSONS` gains `kbl-eng-s1-nccd-u1_l5`; update the doc comment (Grade 9 and Grade 10).
- Modify `lib/curriculum/src/englishGrammarReview.ts`: statement lookup reads the Grade 10 list too; the lesson-id display regex becomes `/^kbl-(g\d+-)?eng-/`; `NOT_COVERED` gains `10`; `GRADE_COPY[10]`.
- Modify `lib/curriculum/scripts/grammar-sheet.ts`: grades `[1, 2, 3, 4, 5, 9, 10]` and its header comment.
- Generate `docs/english-grammar-g10-review.html`, `docs/english-grammar-g10-sheet.md`.
- Tests: create `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts`, `…/englishGrammarG10.test.ts`, `artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts`; modify `lib/curriculum/src/__tests__/englishHub.test.ts` and `…/englishHubVisible.test.ts` only if they pin counts or lists that change (see Task 1).
- Docs: top of `docs/status-log.md`, `STATUS.md` «Recent changes» line, the spec's status line.

Reference files to read first (the model for everything here): `lib/curriculum/src/englishGrammarG5Items.ts` and `englishGrammarG5.ts`; `lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts` and `englishGrammarG5.test.ts`; `artifacts/mobile/services/__tests__/englishGrammarG5ItemGames.test.ts`; `lib/curriculum/src/englishGrammarG9Items.ts` (which already has `meaning` items and the `now`/`prohibition` topics).

## The content contract (Tasks 1 and 2)

Sub-topics, sizes and kinds (each lesson sums to 40; 440 in all). `statement` is the lesson's `objectives[0]` copied verbatim from `lib/curriculum/src/data/iqra_curriculum_g10_english_sem1.json` (lesson key = id after `-nccd-`, e.g. `u1_l1`); a test reads it back. Hub order is the order below.

| Lesson id (`kbl-eng-s1-nccd-…`) | Sub-topics: size, kind | What decides the answer | Example rows: `text` / answer / distractor |
| --- | --- | --- | --- |
| `u1_l1` | `habit-markers` 12 meaning · `temporary-markers` 12 meaning · `stative` 8 form · `questions` 8 form | Habit markers: every day, usually, often, rarely, never, on Fridays. Temporary markers ONLY: now, right now, at the moment, Look!, Listen! (never «this week», «always», «currently»: both forms can fit) | «She usually walks to school.» / walks / is walking · «Look! The baby is smiling.» / is smiling / smiles · «Does he play tennis on Fridays?» / play / plays |
| `u1_l5` (grammar-only) | `a-an` 8 form · `already-mentioned` 12 meaning · `unique-things` 10 form · `no-article` 10 form | a/an by sound; the same noun repeated; one-of-a-kind nouns (the sun, the moon, the Earth); a missing or extra article that is plainly wrong | «She has an umbrella.» / an / a · «The sun rises in the east.» / The / A |
| `u2_l1` | `result-count` 14 meaning · `duration` 14 meaning · `forms` 12 form | Result-count: a number or «how many» with a finished amount (simple). Duration: «for three hours», «all morning», «How long» with an activity and no count (continuous) | «I have written five emails today.» / have written / have been writing · «She has been studying since seven.» / has been studying / has studied · «He has been wait.» fixes are `form` only in `forms` |
| `u2_l4` | `ing` 14 form · `to` 14 form · `change-of-meaning` 12 meaning | Verb pattern (enjoy + -ing; want + to); remember/stop/forget + -ing vs to where the rest of the sentence fixes the meaning | «She enjoys reading detective stories.» / reading / to read · «I want to learn French.» / to learn / learning · «He stopped to buy water.» / to buy / buying |
| `u3_l1` | `interrupted` 14 meaning · `earlier-event` 14 meaning · `forms` 12 form | Interrupted: «while», a clock time with a longer action, then a short event (continuous). Earlier event: «by the time», «before» + past simple, «already» (past perfect) | «While we were eating, the lights went out.» / were eating / ate · «By the time we arrived, the film had started.» / had started / started |
| `u3_l4` | `used-to-states` 14 meaning · `would-habits` 12 meaning · `forms` 14 form | States (have, be, live, know) take used to, never would; repeated actions with a time marker take either, so use only those where the sentence has «every summer» + an action and the distractor is a state-verb `would` | «I used to have a dog.» / used to have / would have · «Every summer we would swim here.» / would swim / was swimming · «She didn't use to like fish.» / use to / used to |
| `u3_l5` | `could-you-tell` 14 form · `do-you-know` 14 form · `if-whether` 12 form | Indirect question word order (statement order) and if/whether | «Could you tell me where it is?» / where it is / where is it · «Do you know if he is here?» / if he is / if is he |
| `u4_l1` | `obligation` 14 meaning · `ability-permission` 14 meaning · `forms` 12 form | Obligation: «mustn't» vs «don't have to» fixed by a following clause or a reason; ability/permission: a past-specific marker («yesterday», «when I was five») picks could/was able to | «You mustn't touch the wires. They're live.» / mustn't / don't have to · «He could swim when he was five.» / could / can · «You must to wear a helmet.» is `form` only in `forms` |
| `u4_l4` | `defining` 12 form · `non-defining` 14 form · `whose-where` 14 form | A comma-separated clause never takes «that»; a person takes who/that, a thing which/that; whose for possession, where for place | «My brother, who lives in Aqaba, is a pilot.» / who / that · «The girl who sits here is my cousin.» / who / which |
| `u5_l1` | `will-decisions` 10 meaning · `going-to-evidence` 10 meaning · `arrangements-timetables` 12 meaning · `forms` 8 form | Will: an instant decision («OK, I'll …», «Oh, I forgot …»); going to: present evidence («Look at …!»); arrangements/timetables: a fixed time or booking | «Look at those clouds! It's going to rain.» / going to rain / will rain · «The train leaves at nine tomorrow.» / leaves / will leave |
| `u5_l3` | `continuous` 14 meaning · `perfect` 14 meaning · `forms` 12 form | Continuous: «at this time tomorrow», «at 8 o'clock tonight». Perfect: «by next year», «by Friday», «before …» | «At this time tomorrow, I will be flying.» / will be flying / will have flown · «By next year, she will have finished school.» / will have finished / will be finishing |

Authoring rules, every item:

1. Nine words or fewer; one grammar point; what decides the answer is in the sentence.
2. In a `meaning` sub-topic the distractor is grammatical but the marker in the sentence rules it out (a reviewer must be able to say which word excludes it). If you cannot write 10+ such items for a sub-topic without a distractor that could fit, change that sub-topic to `form` items, update its pinned kind and size in the test, and say so in the report (the controller rules on it: spec decision 3 allows a form-only topic).
3. A `form` distractor is ungrammatical in standard English, from this list: the bare verb or wrong inflection, wrong agreement, `to` or -ing after the wrong verb, a missing or doubled auxiliary, the wrong relative word, statement/question word order in the wrong place, a missing or extra article that is plainly wrong, a doubled comparative marker. Never a form that real English accepts.
4. Present perfect (U2 l1) `forms` items: the distractor is a bare verb or wrong agreement («has been work», «have been wait»), never a past simple.
5. `answer` appears exactly once as whole words, case-sensitive; trailing punctuation stays in `text` (the engine moves it to the distractor). For a two-sentence text keep the answer in one of them.
6. No name; no repeated `text` within a lesson; a twin (the sentence with the distractor in place) must never equal another true sentence of the lesson.
7. Vocabulary from the unit's hub lesson or common function words; few words outside both (they print on the form).
8. Articles (`u1_l5`) and the present perfect simple vs continuous (`u2_l1`) are the risky lessons: be conservative, and note in the report any item you think a teacher could dispute.

Item helper at the top of the data file:

```ts
type Row = [text: string, answer: string, distractor: string];
const items = (topic: string, kind: GrammarItem['kind'], rows: Row[]): GrammarItem[] =>
  rows.map(([text, answer, distractor]) => ({ topic, kind, text, answer, distractor }));
```

---

### Task 1: Hub entry, units, and lessons u1_l1, u1_l5, u2_l1, u2_l4, u3_l1

**Files:**
- Create: `lib/curriculum/src/englishGrammarG10Items.ts`, `lib/curriculum/src/englishGrammarG10.ts`
- Modify: `lib/curriculum/src/englishGrammar.ts`, `lib/curriculum/src/englishHub.ts`, `lib/curriculum/src/__tests__/englishHub.test.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts` (create)

**Interfaces:**
- Consumes: `GrammarItem`, `GrammarUnit` (types from `englishGrammar.ts`), `hubLessonsForGrade` (`englishHub.ts`).
- Produces: `G10_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[]`; `GRAMMAR_UNITS_G10: GrammarUnit[]`; `NOT_COVERED_G10: Record<string, string[]>`; `GRAMMAR_ONLY_LESSONS` containing `kbl-eng-s1-nccd-u1_l5`.

- [ ] **Step 1: Write the failing tests.**

Create `englishGrammarG10Items.test.ts` (the model is `englishGrammarG5Items.test.ts`: read it and keep its structure):

```ts
/**
 * Grade 10 Semester 1 grammar on the eleven authored lessons (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor and the force of a
 * marker are a teacher's call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { G10_ITEM_LESSONS } from '../englishGrammarG10Items.ts';
import { GRAMMAR_ONLY_LESSONS, hubLesson } from '../englishHub.ts';

const dataFile = () => JSON.parse(readFileSync(new URL('../data/iqra_curriculum_g10_english_sem1.json', import.meta.url), 'utf8'));
const L = (s: string) => `kbl-eng-s1-nccd-${s}`;
const FIRST = ['u1_l1', 'u1_l5', 'u2_l1', 'u2_l4', 'u3_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G10_ITEM_LESSONS.map(l => l.lessonId);

/** topic: [size, kind] — the kind is pinned per sub-topic, so a meaning item cannot appear outside the topics meant for it. */
const SIZES: Record<string, Record<string, [number, 'form' | 'meaning']>> = {
  [L('u1_l1')]: { 'habit-markers': [12, 'meaning'], 'temporary-markers': [12, 'meaning'], stative: [8, 'form'], questions: [8, 'form'] },
  [L('u1_l5')]: { 'a-an': [8, 'form'], 'already-mentioned': [12, 'meaning'], 'unique-things': [10, 'form'], 'no-article': [10, 'form'] },
  [L('u2_l1')]: { 'result-count': [14, 'meaning'], duration: [14, 'meaning'], forms: [12, 'form'] },
  [L('u2_l4')]: { ing: [14, 'form'], to: [14, 'form'], 'change-of-meaning': [12, 'meaning'] },
  [L('u3_l1')]: { interrupted: [14, 'meaning'], 'earlier-event': [14, 'meaning'], forms: [12, 'form'] },
};

describe('Grade 10 authored lessons', () => {
  it('start with the five lessons of Task 1, unsigned and offered to nobody', () => {
    assert.deepEqual(ids().slice(0, 5), FIRST);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grade, 10, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it('make Articles the one grammar-only lesson, under the word floor, and the rest lessons with words', () => {
    assert.ok(GRAMMAR_ONLY_LESSONS.includes(L('u1_l5')));
    assert.equal(hubLesson(L('u1_l5'))!.grammarOnly, true);
    for (const id of ids().filter(i => i !== L('u1_l5'))) assert.equal(hubLesson(id)!.grammarOnly, undefined, id);
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G10_ITEM_LESSONS) {
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile().units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson in the pinned sub-topic sizes and kinds', () => {
    for (const [id, sizes] of Object.entries(SIZES)) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      for (const [topic, [size, kind]] of Object.entries(sizes)) {
        const own = s.filter(x => x.patternId === topic);
        assert.equal(own.length, size, `${id} ${topic}`);
        assert.ok(own.every(x => x.kind === kind), `${id} ${topic} must be ${kind}`);
      }
      assert.deepEqual([...new Set(s.map(x => x.patternId))].sort(), Object.keys(sizes).sort(), id);
    }
  });

  it('are buildable, picture-free, unique and never a Yes or No', () => {
    for (const id of ids()) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id} ${x.text}`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.ok(x.kind === 'form' || x.kind === 'meaning', x.text);
        assert.ok(!seen.has(x.text), `duplicate ${x.text}`);
        seen.add(x.text);
      }
      for (const x of s) assert.ok(!seen.has(x.claim!.falseText), `twin of «${x.text}» is a true sentence`);
    }
  });

  it('have a distractor that differs and a silent twin that differs from the sentence', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
      assert.notEqual(x.claim!.falseText, x.text, x.text);
      assert.equal(x.claim!.voiced, false, x.text);
    }
  });

  it('contain no capitalised name (only a sentence start, I, a family word or a place)', () => {
    const ok = new Set(['I', "I'm", "I'd", "I'll", "I've", 'Dad', 'Mum', 'TV', 'Jordan', 'Amman', 'Aqaba', 'Petra', 'Irbid', 'Sun', 'Moon', 'Earth', 'Mars', 'Saturday', 'Sunday', 'Monday', 'Friday', 'Fridays', 'English', 'French', 'Arabic']);
    for (const id of ids()) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
    }
  });

  it('never use a bare past simple as a present perfect distractor', () => {
    const past = new Set('saw did went ate took wrote broke wore gave drew threw knew spoke rode sang swam drank began chose fell forgot hid flew grew shook stole woke came became ran'.split(' '));
    for (const x of sentencesOf(L('u2_l1')).filter(y => y.patternId === 'forms')) {
      for (const w of x.choose!.wrong.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/)) assert.ok(!past.has(w), `${x.text}: ${w}`);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 10', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(10).length, ids().length);
  });
});
```

Update `englishHub.test.ts`: change `GRAMMAR_ONLY` to six ids (append `'kbl-eng-s1-nccd-u1_l5'`), rename the test titles «five Grade 9 lessons are grammar-only…» to «six lessons are grammar-only (five in Grade 9, Articles in Grade 10): listed, under the word floor, and no other lesson is», and change the counts test to «the hub has 41 Grade 9 and 21 Grade 10 lessons now and every other grade is unchanged» with `[10, 9, 8, 9, 10, 41, 21]`. Check `englishHubVisible.test.ts` — it loops `GRAMMAR_ONLY_LESSONS`, so it needs no edit.

- [ ] **Step 2: Run to verify they fail.**
  Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG10Items.test.ts src/__tests__/englishHub.test.ts`
  Expected: FAIL (`Cannot find module '../englishGrammarG10Items.ts'`; hub test expects 21 and six ids).

- [ ] **Step 3: Implement.**
  - `englishHub.ts`: add `'kbl-eng-s1-nccd-u1_l5',` to `GRAMMAR_ONLY_LESSONS` and rewrite its doc comment: «Grammar-only lessons: Grade 9 lessons whose book statement is a grammar topic but with fewer than `MIN_HUB_WORDS` words (used to; the two present perfects; the first conditional; reported speech), and Grade 10's Articles (no vocabulary rows). They are in the hub for their grammar only…» (keep the rest of the sentence about hiding word activities, `hubLessonVisible` and the pinning test).
  - Create `englishGrammarG10Items.ts`: header comment (what it is: the eleven authored Grade 10 Semester 1 lessons, spec path, the distractor rules `form` and marker-decided `meaning`, «every sentence is nine words or fewer», «`statement` is the book's own «I can» line, read back by a test», «imports only types from the engine: `englishGrammar.ts` imports `englishGrammarG10.ts`, which imports this file»), the `items` helper above, `const L = (s: string) => \`kbl-eng-s1-nccd-${s}\`;`, and `export const G10_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [ … ]` with five entries now (`u1_l1`, `u1_l5`, `u2_l1`, `u2_l4`, `u3_l1`). Read the statements with: `python3 -c "import json;d=json.load(open('lib/curriculum/src/data/iqra_curriculum_g10_english_sem1.json'));[print(l['id'],'|',l['objectives'][0]) for u in d['units'] for l in u['lessons']]"`. Write the rows to the sizes, kinds and rules in the contract; use the example rows as the first row of each sub-topic where they fit (if one violates the rules, replace it).
  - Create `englishGrammarG10.ts` modelled on `englishGrammarG5.ts`: header comment, `HUB_ORDER` from `hubLessonsForGrade(10)`, `UNITS_G10` from `G10_ITEM_LESSONS`, sorted `GRAMMAR_UNITS_G10`, `SHARED` (the two bullets from Grade 5's file) and `NOT_COVERED_G10` with an entry per lesson now: `[...SHARED, one lesson-specific bullet]`. Bullets (Arabic; English phrases inline; no `"`, `&`, `<`, `>`; a space after «و» before any English word): u1_l1 «جمل المضارع البسيط والمستمر تُحدِّد الصيغة بكلمة في الجملة، مثل usually أو Look!، والخيار الآخر يُسمّى «معنى» لا «خطأ». كلمات مثل this week أو always غير مشمولة لأنها تقبل الصيغتين.»; u1_l5 «هذا الدرس بلا أنشطة كلمات أو قراءة لأنه بلا مفردات؛ لن يظهر للطلاب إلا بعد توقيعكم. واختيار a أو the يقبل أحيانًا الصيغتين في سياق أوسع، فراجعوا كل جملة.»; u2_l1 «الحاضر التام البسيط (have written) مقابل المستمر (have been writing): تُحدِّده كلمة العدد أو المدة في الجملة؛ وجمل الصيغة (has been work) أخطاء في الشكل فقط.»; u2_l4 «الفعل وما يتبعه: -ing أو to، وفي تغيّر المعنى (stop doing / stop to do) تُحدِّد بقية الجملة المعنى.»; u3_l1 «الماضي البسيط والمستمر والتام: الحدث القصير الذي يقطع فعلًا أطول (when he fell) يُحدِّد المستمر، والفعل اللحظي بعد While … was skiing يبقى ماضيًا بسيطًا؛ ولا تُحدِّد while وحدها الصيغة لأن While we ate جملة سليمة. و by the time تُحدِّد التام، والخيارات الخاطئة في الشكل (had train) أخطاء صيغة.»
  - `englishGrammar.ts`: add `import { GRAMMAR_UNITS_G10 } from './englishGrammarG10.ts';` after the G9 import and append `...GRAMMAR_UNITS_G10` to `GRAMMAR_UNITS`.

- [ ] **Step 4: Run to verify they pass.**
  Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG10Items.test.ts src/__tests__/englishHub.test.ts src/__tests__/englishHubVisible.test.ts`, then `pnpm --filter @workspace/curriculum test`.
  Expected: PASS (the Grade 10 count in the last test equals 5 for now). A flagged capital that is a real place or hub word may be added to the test's `ok` set; a person's name may not. If another existing test fails because it enumerates hub lessons by grade or all grammar units (for example one that asserts every grammar unit's hub lesson has four words), read why: Articles is grammar-only like Grade 9's five, so narrow that assertion the same way Grade 9's was.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG10Items.ts lib/curriculum/src/englishGrammarG10.ts lib/curriculum/src/englishGrammar.ts lib/curriculum/src/englishHub.ts lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts lib/curriculum/src/__tests__/englishHub.test.ts
git diff --cached --stat
git commit -m "Grade 10 grammar data: five lessons of hand-written items, Articles grammar-only (hidden)"
```

---

### Task 2: Lessons u3_l4, u3_l5, u4_l1, u4_l4, u5_l1, u5_l3 and the totals

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG10Items.ts`, `lib/curriculum/src/englishGrammarG10.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts` (extend), `lib/curriculum/src/__tests__/englishGrammarG10.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's `G10_ITEM_LESSONS`, `NOT_COVERED_G10`.
- Produces: `G10_ITEM_LESSONS` with eleven entries; `NOT_COVERED_G10` with eleven entries.

- [ ] **Step 1: Extend the tests.** In `englishGrammarG10Items.test.ts` add `REST = ['u3_l4', 'u3_l5', 'u4_l1', 'u4_l4', 'u5_l1', 'u5_l3'].map(L)`; add to `SIZES`:

```ts
  [L('u3_l4')]: { 'used-to-states': [14, 'meaning'], 'would-habits': [12, 'meaning'], forms: [14, 'form'] },
  [L('u3_l5')]: { 'could-you-tell': [14, 'form'], 'do-you-know': [14, 'form'], 'if-whether': [12, 'form'] },
  [L('u4_l1')]: { obligation: [14, 'meaning'], 'ability-permission': [14, 'meaning'], forms: [12, 'form'] },
  [L('u4_l4')]: { defining: [12, 'form'], 'non-defining': [14, 'form'], 'whose-where': [14, 'form'] },
  [L('u5_l1')]: { 'will-decisions': [10, 'meaning'], 'going-to-evidence': [10, 'meaning'], 'arrangements-timetables': [12, 'meaning'], forms: [8, 'form'] },
  [L('u5_l3')]: { continuous: [14, 'meaning'], perfect: [14, 'meaning'], forms: [12, 'form'] },
```

Change the first test to `assert.deepEqual(ids(), [...FIRST, ...REST])` (title «are the eleven hub lessons in order…»), and add:

```ts
  it('are eleven lessons and 440 items, 189 of them meaning-decided', () => {
    assert.equal(G10_ITEM_LESSONS.length, 11);
    assert.equal(G10_ITEM_LESSONS.reduce((n, l) => n + sentencesOf(l.lessonId).length, 0), 440);
    assert.equal(grammarUnitsForGrade(10).length, 11);
    const meaning = ids().flatMap(id => sentencesOf(id)).filter(x => x.kind === 'meaning').length;
    assert.equal(meaning, Object.values(SIZES).flatMap(s => Object.values(s)).filter(([, k]) => k === 'meaning').reduce((n, [size]) => n + size, 0));
  });
```

(Compute the literal meaning total from the pinned sizes: u1_l1 24, u1_l5 12, u2_l1 28, u2_l4 12, u3_l1 28, u3_l4 26, u3_l5 0, u4_l1 28, u4_l4 0, u5_l1 32, u5_l3 28 = 218. Use 218 in the test title instead of 189; the assertion above computes it from the table, so the title must read «218 of them meaning-decided».) Also add a second guard in the past-simple test so it covers `forms` of any lesson whose distractor sits in a present perfect sentence: no change needed beyond Task 1.

Create `englishGrammarG10.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G10, NOT_COVERED_G10 } from '../englishGrammarG10.ts';
import { offeredGrammar } from '../englishGrammar.ts';

const IDS = ['u1_l1', 'u1_l5', 'u2_l1', 'u2_l4', 'u3_l1', 'u3_l4', 'u3_l5', 'u4_l1', 'u4_l4', 'u5_l1', 'u5_l3'].map(s => `kbl-eng-s1-nccd-${s}`);

describe('Grade 10 grammar units', () => {
  it('are the eleven grammar lessons, in hub order, all unsigned', () => {
    assert.deepEqual(GRAMMAR_UNITS_G10.map(u => u.lessonId), IDS);
    for (const u of GRAMMAR_UNITS_G10) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    assert.deepEqual(Object.keys(NOT_COVERED_G10).sort(), [...IDS].sort());
    for (const id of IDS) {
      const notes = NOT_COVERED_G10[id];
      assert.ok(notes.length >= 3, id);
      for (const n of notes) {
        assert.ok(!/["&<>]/.test(n), `${id}: ${n}`);
        assert.ok(!/[ء-ي]و[A-Za-z]|(^|\s)و[A-Za-z]/.test(n), `${id}: «و» glued to an English word: ${n}`);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail** (`node --experimental-strip-types --test src/__tests__/englishGrammarG10Items.test.ts src/__tests__/englishGrammarG10.test.ts`): FAIL, only five lessons.

- [ ] **Step 3: Author the six lessons** the same way as Task 1 (statements from the same JSON; sizes, kinds, rules and examples from the contract table), and add their `NOT_COVERED_G10` entries (`[...SHARED, bullet]`, spaced «و»): u3_l4 «used to للحالات (have, be, live) و would للتكرار مع كلمة وقت؛ لا اختيار حيث تصلح الصيغتان. didn't use to مقابل didn't used to يقبلهما بعض المعلمين معًا، فهما في موضوع الصيغ للمراجعة.»; u3_l5 «ترتيب الكلمات في السؤال غير المباشر (where it is لا where is it)، واختيار if أو whether؛ الخيارات الخاطئة كلها في ترتيب الكلمات.»; u4_l1 «mustn't مقابل don't have to تُحدِّدها جملة سبب أو جملة ثانية، وكذلك could مقابل was able to مع كلمة ماضٍ محدَّد؛ أما should أو ought to فغير مشمولتين لأن لكل منهما أكثر من إجابة مقبولة.»; u4_l4 «الجملة الاستدراكية بفاصلتين لا تقبل that، والجملة المحدِّدة تقبل who أو that للأشخاص؛ لا جملة تعتمد على حذف الضمير الموصول.»; u5_l1 «will للقرار اللحظي، و going to لدليل ظاهر، والمضارع المستمر أو البسيط لموعد أو جدول؛ لا اختيار بين will و going to لخطة عامة لأن كلتيهما مقبولة.»; u5_l3 «المستقبل المستمر (will be flying) مع وقت محدد والتام (will have finished) مع by؛ والخيارات الخاطئة الأخرى في الشكل.» The notes above are final; the test's glued-و check must pass on them as written.

- [ ] **Step 4: Run to verify they pass.** The two test files, then `pnpm --filter @workspace/curriculum test`. Expected PASS with 11 lessons and 440 items. If the glued-و test fails on a note, add the space; do not weaken the test.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG10Items.ts lib/curriculum/src/englishGrammarG10.ts lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts lib/curriculum/src/__tests__/englishGrammarG10.test.ts
git diff --cached --stat
git commit -m "Grade 10 grammar data: the other six lessons (hidden); 440 items in all"
```

---

### Task 3: The teacher's form for Grade 10

**Files:**
- Modify: `lib/curriculum/src/englishGrammarReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`
- Generate: `docs/english-grammar-g10-review.html`, `docs/english-grammar-g10-sheet.md`
- Test: `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts` (append)

**Interfaces:**
- Consumes: `G10_ITEM_LESSONS`, `NOT_COVERED_G10`, `unitGrade`.
- Produces: `renderGrammarReviewHtml(10)`; `renderAuthoredUnit` working for Grade 10 ids.

- [ ] **Step 1: Failing test (append to `englishGrammarG10Items.test.ts`)**

```ts
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { renderGrammarSheet } from '../englishGrammar.ts';

describe('the Grade 10 teacher form', () => {
  const html = renderGrammarReviewHtml(10);
  const docs = (name: string) => readFileSync(new URL(`../../../../docs/${name}`, import.meta.url), 'utf8');
  it('equals the committed form and sheet', () => {
    assert.equal(docs('english-grammar-g10-review.html'), html);
    assert.equal(docs('english-grammar-g10-sheet.md'), renderGrammarSheet(10));
  });
  it("prints each lesson's book statement and the first check, the lesson id without a grade prefix, and a kind for every item", () => {
    for (const l of G10_ITEM_LESSONS) assert.ok(html.includes(l.statement.replace(/'/g, '&#39;')) || html.includes(l.statement), l.lessonId);
    assert.ok(html.includes('تأكدوا أولًا'));
    assert.ok(html.includes('الكلمات خارج قوائم المفردات'));
    assert.equal(html.split('class="unit"').length - 1, 11);
    assert.ok(html.includes('الصف العاشر'));
    assert.ok(html.includes('>s1-nccd-u1_l5<'), 'the id shown without its kbl-eng- prefix');
    assert.ok(!html.includes('>kbl-eng-'), 'no un-stripped id');
    assert.equal((html.match(/class="kind kind-meaning"/g) ?? []).length, 218);
    assert.equal((html.match(/class="kind kind-form"/g) ?? []).length, 222);
  });
  it('lists every sentence', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) assert.ok(html.includes(x.text.replace(/'/g, '&#39;')) || html.includes(x.text), x.text);
  });
  it('leaves the other grades alone', () => {
    for (const g of [1, 2, 3, 4, 5, 9]) assert.equal(docs(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `grade ${g}`);
  });
});
```

(The class attribute on the kind chip is `class="kind kind-${s.kind}"` in `renderAuthoredUnit`; if the generated HTML spells it differently, match the real markup. The 218/222 counts come from the pinned sizes: 218 meaning + 222 form = 440.)

- [ ] **Step 2: Run to verify it fails** (`GRADE_COPY[10]` is undefined, so `renderGrammarReviewHtml(10)` throws).

- [ ] **Step 3: Implement** in `englishGrammarReview.ts`:
  - imports: `import { NOT_COVERED_G10 } from './englishGrammarG10.ts';` and `import { G10_ITEM_LESSONS } from './englishGrammarG10Items.ts';`.
  - `NOT_COVERED`: add `10: NOT_COVERED_G10`.
  - `renderAuthoredUnit`: the statement lookup becomes `[...G5_ITEM_LESSONS, ...G9_ITEM_LESSONS, ...G10_ITEM_LESSONS].find(...)`; the id display regex `/^kbl-g\d+-eng-/` becomes `/^kbl-(g\d+-)?eng-/`.
  - `GRADE_COPY[10]` after `[9]`: same shape and `extraCss` as `[5]` (copy `[5]`'s `YESNO_CSS + …` line-for-line, since it already carries the `.kind-meaning` rule), with this copy (Arabic verbatim; no `"`, `&`, `<`, `>`; no glued «و»):

```ts
  10: {
    title: 'مراجعة قواعد الصف العاشر',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف العاشر',
    lead: (total, units) => `هذه مراجعة قواعد الصف العاشر، الفصل الأول: ${AR_DIGITS(units)} دروس كُتبت جملها واحدةً واحدة، لكل جملة إجابتها الصحيحة وخيار مموِّه. الكتاب يعطي هدفًا لكل درس دون جمل نموذجية، فكل جملة هنا كتبناها نحن، وتُراجَع هنا قبل أي ظهور لها. كثير من الجمل يختبر الاختيار بين صيغتين (المضارع البسيط والمستمر، a أو the، will أو going to)، فنوع المموِّه مطبوع لكل جملة: <b>form</b> غير سليم لغويًا، و<b>meaning</b> سليم لكن كلمة في الجملة نفسها تستبعده. لا صور في أي درس. <b>لن يرى الطلاب أي درس قبل أن توافقوا عليه</b>، ودرس أدوات التعريف لا يظهر في الركن إلا بعد توقيعكم. هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ، وخياران: الإجابة الصحيحة أمام المموِّه، مثل <span dir="ltr">had started / started</span> أو <span dir="ltr">where it is / where is it</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. حتى ٩ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>تُعرض الجملة نفسها، أو توأمها الخاطئ باستبدال الإجابة بالمموِّه. <b>هذا النشاط صامت:</b> لا يُسمَع فيه أي جملة، صحيحة أو خاطئة، حتى لا يسمع الطالب إنجليزية خاطئة ولا يدل الصمت على الجواب.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل رقم الدرس يطابق صفحة الكتاب؟ (يقول الكتاب بالإنجليزية في أعلى كل صفحة.)',
      'في الجمل من نوع meaning: هل الكلمة المحدِّدة في الجملة تستبعد المموِّه فعلًا؟ وهل يمكن أن يقبل طالب جيد المموِّه؟',
      'هل أي مموِّه من نوع form مقبول أحيانًا في صفك؟',
      'في درس أدوات التعريف والمضارع التام البسيط والمستمر: هل الجمل واضحة دون سياق أوسع؟',
      'في «الكلمات خارج قوائم المفردات»: وافقوا على الكلمات المناسبة للصف العاشر واشطبوا الباقي.',
      'هل طول الجمل مناسب لـ «رتّب الجملة»؟',
    ],
    extraCss: /* copy of GRADE_COPY[5].extraCss */,
  },
```

  Replace the `extraCss` placeholder with the same value as `GRADE_COPY[5].extraCss` (do not leave a comment in its place). Keep the lead free of a «و» touching an English word (the glued-و convention); if you change the text, check every English word in your final strings.
  - `scripts/grammar-sheet.ts`: the loop `[1, 2, 3, 4, 5, 9, 10]`; header «for Grades 1 to 5, 9 and 10»; add `src/englishGrammarG10.ts, src/englishGrammarG10Items.ts` to the re-run list.

- [ ] **Step 4: Generate and run.**

```bash
cd lib/curriculum && node --experimental-strip-types scripts/grammar-sheet.ts
git status --short docs/
```

  Expected: only `docs/english-grammar-g10-review.html` and `docs/english-grammar-g10-sheet.md` are new (nothing modified for g1–g5, g9 or the reading forms; if another grade's doc changed, the refactor changed output — revert it and fix). Then `pnpm --filter @workspace/curriculum test` — PASS. If the chip-count assertions disagree because the page also prints kinds in the intro legend, count only `<span class="kind kind-…"` chips.

- [ ] **Step 5: Look at it.** Open `docs/english-grammar-g10-review.html` in the pre-installed Chromium (Playwright, `/opt/pw-browsers`; never `playwright install`; put scripts in the scratchpad directory) at 390 px and A4 landscape print emulation: eleven unit pages, topic rows, form and meaning chips in two colours, the book statement line, and the id shown as `s1-nccd-u1_l1`; no horizontal page scroll. Read the screenshots of the first, the Articles and one later page.

- [ ] **Step 6: Commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarReview.ts lib/curriculum/scripts/grammar-sheet.ts lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts docs/english-grammar-g10-review.html docs/english-grammar-g10-sheet.md
git diff --cached --stat
git commit -m "Grade 10 grammar: the teacher's form for the eleven authored lessons"
```

---

### Task 4: The app plays them

**Files:**
- Test: `artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts` (create)
- Modify: nothing expected. If a test fails because an app file assumes Grades 5 or 9 only, fix that file minimally and say so in the commit message.

- [ ] **Step 1: Write the test.** Copy `englishGrammarG5ItemGames.test.ts` to `englishGrammarG10ItemGames.test.ts` and change: the doc comment (Grade 10, spec path); `LESSONS` to the eleven Grade 10 ids (`u1_l1`, `u1_l5`, `u2_l1`, `u2_l4`, `u3_l1`, `u3_l4`, `u3_l5`, `u4_l1`, `u4_l4`, `u5_l1`, `u5_l3`) mapped with `` `kbl-eng-s1-nccd-${s}` ``; titles to «Grade 10»; keep every behaviour assertion (Choose, Build and True or false offered on every lesson and Yes or No on none; the right option equals the answer; Build judged right in order; True or false has no picture, is half true and silent; no authored twin voiced; each round has at least six questions).

- [ ] **Step 2: Run it.**
  Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG10ItemGames.test.ts`
  Expected: PASS straight away (the engine is shared). If it fails, read why before changing anything and report.

- [ ] **Step 3: Run the neighbouring files** (`englishGrammarGames`, `englishGrammarG2Games`, `…G3Games`, `…G4Games`, `…G5ItemGames`, `…G9Games`, `…G9ItemGames`, `englishHubGames`) and `cd lib/curriculum && pnpm test`. Expected PASS. (`englishHubGames` loops lessons with words: Articles is grammar-only and must not break it.) Do not run the full mobile suite here.

- [ ] **Step 4: Commit.**

```bash
git add artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts
git diff --cached --stat
git commit -m "Grade 10 grammar: the app plays the eleven lessons (tests)"
```

---

### Task 5: Verify, document

**Files:**
- Modify: `docs/status-log.md` (top), `STATUS.md`, the spec's status line.

- [ ] **Step 1: Whole verification.** `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test` and its `verify`; start the full mobile suite in the background (`cd artifacts/mobile && pnpm test > <scratchpad>/mobile-g10.log 2>&1 &`; it prints only at the end, about ten minutes; do not edit any source or sign-off file while it runs). Note: with `R2_*` variables set in the environment `r2.test.ts` fails by design (it expects them unset): rerun that file with `env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY` and report both results. Any other failure: read it, report it, fix if the Grade 10 work caused it.

- [ ] **Step 2: Browser check at 390 px, Arabic and English** (after the suite finishes). Build web (`cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), serve with `WEB_PORT=8098 node e2e/serve.mjs` (note its pid; kill it afterwards). Unsigned: a Grade 10 lesson with words (`/curriculum/english/kbl-eng-s1-nccd-u3_l1`) shows no grammar cards; the Grade 10 index lacks Articles and its direct URL (`…/kbl-eng-s1-nccd-u1_l5`) says «lesson not found». Then temporarily set `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-23' }` on the eleven units in `englishGrammarG10.ts` (the `UNITS_G10` map) with the Edit tool, rebuild, and with a Playwright script in the scratchpad (model: `g9items-browser.mjs` and `hubonly-browser.mjs` there) check: Articles appears with the «grammar activities» row and only Choose, Build and True or false; a lesson with words keeps its word activities and gains the three grammar cards; no Yes or No; Choose/Build play the sentence after answering; True or false has no speaker button and plays nothing; a nine-word sentence wraps with no horizontal scroll; both languages render. Read the screenshots. Restore: `git checkout lib/curriculum/src/englishGrammarG10.ts`, kill the server, confirm `grep -rc "LOCAL CHECK"` finds no non-zero count and `git status --short` is clean.

- [ ] **Step 3: Docs.** Add the entry «Grade 10 grammar (Semester 1) in the English corner — built, shown to nobody yet» at the top of `docs/status-log.md` (what was built: eleven lessons, 440 items, sub-topics, 218 meaning-decided and 222 form items, Articles grammar-only, the form's id regex, `GRADE_COPY[10]`; what was verified with the real counts; what was not: no teacher has read a sentence, no audio, no device, Semester 2 not covered; the teacher's open points, and the risky lessons) and the title as the first line of «Recent changes» in `STATUS.md` (drop the oldest line so it stays at 30; update «The log has N sections» by the same rule as the neighbouring lines). Change the spec's status line to «implemented (this PR)».

- [ ] **Step 4: Commit.**

```bash
git add docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md docs/superpowers/plans/2026-10-23-english-corner-grammar-g10.md
git diff --cached --stat
git commit -m "docs: Grade 10 Semester 1 grammar status-log entry"
```

# English corner: Grade 10 grammar, Semester 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ten Grade 10 Semester 2 grammar lessons grammar activities built from 400 hand-written items, each as a grammar-only hub lesson hidden until a teacher signs it off.

**Architecture:** Everything the Semester 1 work built is reused unchanged: the authored-items engine (`GrammarUnit.items`, `unitSentences`, `kind: 'form' | 'meaning'`, silent True or false, `buildCap(10)` = 9), the grammar-only hub mechanism (`GRAMMAR_ONLY_LESSONS`, `hubLessonVisible`) and the grade-generic teacher form. Semester 2 is data (ten more entries in the two Grade 10 data files), ten ids in the hub list, wording in `GRADE_COPY[10]`, and a statement lookup that reads the Semester 2 JSON.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script.

**Spec:** `docs/superpowers/specs/2026-10-24-english-corner-grammar-g10-s2-design.md` (approved). Semester 1's spec and plan (`…2026-10-23-english-corner-grammar-g10-design.md`, `…g10.md`) are the model for everything here.

## Global Constraints

- All 21 Grade 10 units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs set with the Edit tool and restored with `git checkout <file>`; `grep -rc "LOCAL CHECK" lib/curriculum/src artifacts/mobile/services` must show no non-zero count afterwards).
- The Grade 1–5 and Grade 9 grammar sheets and forms and the four reading forms stay byte-identical (tests pin them). The Grade 10 sheet and form are regenerated.
- Every sentence is 9 words or fewer (`buildCap(10)` is 9), so Build always takes it whole.
- A distractor is `form` (ungrammatical in standard English) or `meaning` (grammatical but excluded by something in the sentence itself). Never a form that could fit. A `meaning` item exists only in the sub-topics the table below marks `meaning`; a topic where two forms could both fit tests `form` only.
- Reported speech tests no tense shift (both «said she was tired» and «said she is tired» are fine): reporting-verb and reported-question items turn on the verb pattern, the object, `if`/`whether` and word order only.
- True or false on authored items is silent; false twins are never voiced (`allGrammarSpoken` omits them).
- No real or book-character name in any sentence; a family word (`Mum`, `Dad`) or a Jordanian place name (`Amman`, `Aqaba`, `Petra`) is fine. Nothing religious, political or sensitive.
- Arabic not-covered notes and form copy: no `"`, `&`, `<` or `>` in a note (the form does not escape runs); write the Arabic conjunction «و» with a space before an English word, never glued.
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No `sed -i`/`perl -pi` on source; use the Edit or Write tool. `git diff --stat` must show no `Bin N -> M bytes` line; new files must have no NUL bytes.
- Stage named paths only (never `git add -A` or `.`) and check `git diff --cached --stat` before each commit.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- The Latin product name is «Iqrra» in copy; repo and package names stay Iqraa.
- Work on branch `ccr-d9db5f6c-mgwkuo`. Do not push from a subagent; the controller pushes.
- With the sandbox's `R2_*` variables set, `r2.test.ts` fails by design: run the curriculum suite with `env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY`. Never print or read any `.env` file or environment value.

## File Structure

- Modify `lib/curriculum/src/englishGrammarG10Items.ts`: `G10_ITEM_LESSONS` grows from 11 to 21 entries (the ten Semester 2 lessons appended in hub order); the header comment and the `L` helper gain a Semester 2 counterpart `L2`.
- Modify `lib/curriculum/src/englishGrammarG10.ts`: `NOT_COVERED_G10` gains ten entries (keyed with an `L2` helper); header comment mentions Semester 2. `GRAMMAR_UNITS_G10` is derived from `G10_ITEM_LESSONS` and needs no change.
- Modify `lib/curriculum/src/englishHub.ts`: `GRAMMAR_ONLY_LESSONS` gains the ten ids (sixteen in all); the doc comment is updated. The hub already builds Semester 2 lessons from the catalog (`VOCAB_BOOKS` has `[10, 2, …]`); they were dropped only because they have no words, so listing them is the whole hub change.
- Modify `lib/curriculum/src/englishGrammarReview.ts`: `GRADE_COPY[10].lead` and one check line (wording below).
- `lib/curriculum/scripts/grammar-sheet.ts` is unchanged (Grade 10 is in its loop). Regenerate `docs/english-grammar-g10-review.html` and `docs/english-grammar-g10-sheet.md`.
- Tests: modify `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts`, `…/englishGrammarG10.test.ts`, `…/englishHub.test.ts`, and `artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts`. `englishHubVisible.test.ts` loops `GRAMMAR_ONLY_LESSONS` and needs no edit (check it passes).
- Docs: top of `docs/status-log.md`, `STATUS.md` «Recent changes» line, the spec's status line.

Read first: `lib/curriculum/src/englishGrammarG10Items.ts` (the eleven finished lessons: copy their tone, row style and vocabulary level, and read the header comment), `englishGrammarG10.ts`, `__tests__/englishGrammarG10Items.test.ts`.

## The content contract (Tasks 1 and 2)

Sub-topics, sizes and kinds (each lesson sums to 40; 400 in all; 102 `meaning`, 298 `form`). `statement` is the lesson's `objectives[0]` copied verbatim from `lib/curriculum/src/data/iqra_curriculum_g10_english_sem2.json` (lesson key = id after `-nccd-`, e.g. `u6_l1`); a test reads it back. Hub order is the order below. Lesson ids are `kbl-eng-s2-nccd-u6_l1` etc. (ignore the stale `uu6` in a comment in `catalogs/g10EnglishSem2.ts`).

Statements (verbatim): u6_l1 «I can use the first and second conditional to talk about possible and hypothetical situations.» · u6_l4 «I can use the zero conditional to talk about real situations that are always true.» · u7_l1 «I can use reporting verbs to report stories.» · u7_l5 «I can use reported questions to talk about what someone else said.» · u8_l1 «I can use the passive to talk about different actions.» · u8_l6 «I can use have/get something done to talk about services.» · u9_l1 «I can use the third conditional to talk about unreal situations in the past.» · u9_l4 «I can use I wish and if only to express regrets.» · u10_l1 «I can use modal verbs to speculate about the present.» · u10_l3 «I can use modal verbs to speculate about the past.»

| Lesson (`kbl-eng-s2-nccd-…`) | Sub-topics: size, kind | What decides the answer, and which distractors are allowed | Example rows: `text` / answer / distractor |
| --- | --- | --- | --- |
| `u6_l1` | `first-conditional` 12 form · `second-conditional` 12 form · `imagine-vs-real` 16 meaning | First: if-clause present, result `will` + base. Distractors: `will` inside the if-clause, a wrong verb form after `will` (`will to go`, `will going`), wrong agreement. Second: if-clause past, result `would` + base. Distractors: `would` inside the if-clause, `would to go`. Never `was`/`were` against each other (both accepted). Meaning (as built after review): every row is Imagine/Suppose-style, an unreal condition in its own sentence with a past verb, and the twin is a sound stand-alone `will` sentence that the opener rules out; no "likely" side, no row relying on a time word or on were/could + will | «If it rains, we will stay home.» / rains / will rain · «If I see Dad, I will tell him.» / will tell / will telling · «If I had a car, I would drive.» / would drive / would to drive · «If she lived in Aqaba, she would swim.» / would swim / would swam · «Imagine you had wings. You would fly.» / would fly / will fly |
| `u6_l4` | `if-present` 14 form · `when-general-truths` 14 form · `questions-negatives` 12 form | Zero conditional: present simple in both clauses (if or when). **No distractor may contain `will` or `would`** (a test pins this): «If you heat ice, it will melt» is a fine first conditional. Distractors are agreement (`it melt`), `-ing`, a past participle, a doubled auxiliary | «If you heat ice, it melts.» / melts / melt · «Plants die when they get no water.» / get / gets · «What happens if you freeze water?» / freeze / freezes · «If you don't water plants, they die.» / die / dies |
| `u7_l1` | `verb-patterns` 16 form · `admit-deny-suggest` 14 form · `tell-ask-warn` 10 form | Pattern after the reporting verb: promise/offer/refuse/agree + to-infinitive; admit/deny/suggest/apologise-for + `-ing`; tell/warn/advise/remind + object + to-infinitive. Distractors are the wrong pattern ( `suggested to go`, `denied to break`, `told to wait`, `promised calling`). **Never `asked to` / `asked me`** (both grammatical with different meanings) and never `advised resting` against `advised me to rest`. No tense shift | «He denied breaking the vase.» / breaking / to break · «She promised to call me.» / to call / calling · «Mum told me to wait.» / told me / said me |
| `u7_l5` | `ask-wonder` 14 form · `if-whether` 12 form · `word-order` 14 form | Reported question: statement word order after the wh-word, no `do`, no inversion; `if`/`whether` for yes/no questions. Distractors: question order (`where did I live`, `if was I ready`), `that` for a question. Never differ only by tense | «He asked where I lived.» / where I lived / where did I live · «She asked if I was ready.» / if I was / if was I · «They wondered whether it was true.» / whether it was / whether was it |
| `u8_l1` | `present-past` 14 form · `with-modals` 12 form · `questions-negatives` 14 form | Passive = be + past participle; agreement; modal + `be` + participle. Distractors: base verb for the participle (`was build`), missing `be` (`must locked`), `do`-support in a passive question (`Did the letters sent`), misplaced `not`. No active/passive meaning choice | «The bridge was built long ago.» / was built / was build · «The door must be locked.» / be locked / be lock · «Were the letters sent yesterday?» / Were / Did |
| `u8_l6` | `have-something-done` 12 form · `get-something-done` 12 form · `service-vs-self` 16 meaning | have/get + object + past participle. Form distractors: the base verb or `-ing` for the participle, or the object after the participle (`got fixed her phone`). **Never `had repaired my car` as a form distractor** (a grammatical past perfect). Meaning: a marker such as `myself`, `by hand`, or `by experts`, `at the garage`, `a mechanic` decides self-done vs a service | «I had my car repaired yesterday.» / repaired / repair · «She got her phone fixed.» / fixed / fix · «I cleaned the windows myself.» / cleaned the windows / had the windows cleaned · «We had the house painted by experts.» / had the house painted / painted the house |
| `u9_l1` | `third-conditional` 14 form · `past-unreal` 14 meaning · `would-have-forms` 12 form | Third: if-clause past perfect, result `would have` + participle. Form distractors: `would have` in the if-clause (`If I would have known`), `had knew`, `would had called`, `would have call`. **Never `If I knew … would have`** (a grammatical mixed conditional) as a form distractor. Meaning (the shakiest sub-topic, see rule 2): a sentence stating the real past fact («We lost.») or a past time word sets the unreal past | «If I had known, I would have called.» / had known / would have known · «She would have helped if she had known.» / would have helped / would had helped · «We lost. If we had trained, we would have won.» / would have won / would win |
| `u9_l4` | `wish-present` 14 form · `wish-past-regrets` 14 meaning · `if-only` 12 form | wish + past simple (present wish), wish + past perfect (past regret). Form distractors: `I wish I have`, `I wish I would have`, `If only I had listen`. **Never `If only I have …`** (a future hope, grammatical). Meaning (shaky, see rule 2): a past time word («last year», «yesterday») decides the past perfect | «I wish I had a bigger room.» / had / have · «I wish I had studied last year.» / had studied / studied · «If only I had listened to Mum!» / had listened / had listen |
| `u10_l1` | `must-cant` 14 meaning · `might-may` 12 form · `be-v-ing` 14 form | must = positive deduction, can't = confident negative; a clue in the sentence («so», «has just», «the lights are on») decides which. Distractors for `might-may`: `might is`, `may to be`, `might not to`. `be-v-ing`: `must sleeping`, `might be sleep`. No might/could choice | «The lights are on, so they must be home.» / must / can't · «He has just eaten, so he can't be hungry.» / can't / must · «She might be late today.» / might be / might is · «He must be sleeping now.» / be sleeping / sleeping |
| `u10_l3` | `must-have` 14 meaning · `might-could-have` 12 form · `cant-have` 14 meaning | must have = confident past deduction from evidence; can't have = confident past impossibility from evidence in the sentence. Form: `might forgot`, `could have forget`, `might had forgotten`. Never `must of` | «The ground is wet. It must have rained.» / must have / can't have · «She was with me. She can't have taken it.» / can't have / must have · «He might have forgotten the key.» / might have forgotten / might forgot |

Authoring rules, every item (the Semester 1 rules, restated):

1. Nine words or fewer; one grammar point; what decides the answer is in the sentence.
2. In a `meaning` sub-topic the distractor is grammatical but the marker in the sentence rules it out (a reviewer must be able to say which word excludes it). If you cannot write the pinned number of such items for a sub-topic without a distractor that could fit, change that sub-topic to `form` items, update its pinned kind in the test (and the totals test: meaning count, form count), and say so in the report (the controller rules on it: spec decision 3 allows it). `past-unreal`, `wish-past-regrets`, `imagine-vs-real` and `service-vs-self` are the likeliest to switch.
3. A `form` distractor is ungrammatical in standard English; never a form real English accepts. Where two forms fit (`was`/`were`, `might`/`could`, `will`/`going to`) the topic tests `form` only.
4. An adverb sits inside the answer so the false twin keeps standard order (not «usually is walking»). A time word alone («while», «before», «already») does not decide a tense.
5. `answer` appears exactly once as whole words, case-sensitive; trailing punctuation stays in `text` (the engine moves it to the distractor). For a two-sentence text keep the answer in one of them.
6. No name; no repeated `text` within a lesson; a twin (the sentence with the distractor in place) must never equal another true sentence of the lesson.
7. Vocabulary from common school words and function words; few words outside the function-word list (they print on the form). No digits needed: write «long ago» not a year.
8. Reported speech, conditionals, `wish` and speculation are the risky lessons: be conservative, and note in the report any item you think a teacher could dispute.

Item helper (already at the top of the data file): `items(topic, kind, rows)` with `Row = [text, answer, distractor]`.

---

### Task 1: Wiring, wording, and lessons u6_l1, u6_l4, u7_l1, u7_l5, u8_l1

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG10Items.ts`, `lib/curriculum/src/englishGrammarG10.ts`, `lib/curriculum/src/englishHub.ts`, `lib/curriculum/src/englishGrammarReview.ts`
- Modify tests: `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts`, `…/englishGrammarG10.test.ts`, `…/englishHub.test.ts`
- Regenerate: `docs/english-grammar-g10-review.html`, `docs/english-grammar-g10-sheet.md`

**Interfaces:**
- Consumes: `GrammarItem`, `GrammarUnit`, `hubLessonsForGrade`, `GRAMMAR_ONLY_LESSONS`.
- Produces: `G10_ITEM_LESSONS` with 16 entries (the five new ones last); `NOT_COVERED_G10` with 16 entries; `GRAMMAR_ONLY_LESSONS` containing the first five Semester 2 ids; the Grade 10 hub with 26 lessons. (Only five ids go in the hub list now: the hub test requires every listed id to have a grammar unit.)

- [ ] **Step 1: Update the tests so they fail.**

In `englishGrammarG10Items.test.ts`:

1. Header comment: «Grade 10 grammar on the authored lessons (Semester 1: …g10-design.md; Semester 2: docs/superpowers/specs/2026-10-24-english-corner-grammar-g10-s2-design.md)».
2. Replace `dataFile` with a per-semester reader and add the Semester 2 helpers:

```ts
const dataFile = (id: string) =>
  JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g10_english_sem${id.includes('-s2-') ? 2 : 1}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-eng-s1-nccd-${s}`;
const L2 = (s: string) => `kbl-eng-s2-nccd-${s}`;
const S2A = ['u6_l1', 'u6_l4', 'u7_l1', 'u7_l5', 'u8_l1'].map(L2);
```

3. Add to `SIZES`:

```ts
  [L2('u6_l1')]: { 'first-conditional': [12, 'form'], 'second-conditional': [12, 'form'], 'imagine-vs-real': [16, 'meaning'] },
  [L2('u6_l4')]: { 'if-present': [14, 'form'], 'when-general-truths': [14, 'form'], 'questions-negatives': [12, 'form'] },
  [L2('u7_l1')]: { 'verb-patterns': [16, 'form'], 'admit-deny-suggest': [14, 'form'], 'tell-ask-warn': [10, 'form'] },
  [L2('u7_l5')]: { 'ask-wonder': [14, 'form'], 'if-whether': [12, 'form'], 'word-order': [14, 'form'] },
  [L2('u8_l1')]: { 'present-past': [14, 'form'], 'with-modals': [12, 'form'], 'questions-negatives': [14, 'form'] },
```

   The existing `SIZES` test loops `Object.entries(SIZES)`, so it already requires 40 items and the exact sub-topics for these lessons.
4. First test: title «are the hub lessons in order, unsigned and offered to nobody»; `assert.deepEqual(ids(), [...FIRST, ...REST, ...S2A]);`.
5. The grammar-only test becomes:

```ts
  it('make Articles and every Semester 2 lesson grammar-only, under the word floor, and the rest lessons with words', () => {
    const grammarOnly = (id: string) => id === L('u1_l5') || id.includes('-s2-');
    for (const id of ids()) {
      assert.equal(!!hubLesson(id)!.grammarOnly, grammarOnly(id), id);
      assert.equal(GRAMMAR_ONLY_LESSONS.includes(id), grammarOnly(id), id);
    }
  });
```

6. Statement test: `const lesson = dataFile(l.lessonId).units.flatMap(...)` (pass the id).
7. Totals test: title «are 16 lessons and 640 items, 222 of them meaning-decided»; assert `G10_ITEM_LESSONS.length === 16`, the sum of `sentencesOf(...).length === 640`, `grammarUnitsForGrade(10).length === 16`, meaning count `222` and still equal to the sum of the pinned `meaning` sizes.
8. Add the zero-conditional guard (new `it`):

```ts
  it('never use will or would in a zero-conditional distractor, which would be a grammatical first or second conditional', () => {
    for (const x of sentencesOf(L2('u6_l4'))) {
      assert.ok(!/\b(will|would|won't|wouldn't)\b/i.test(x.choose!.wrong), `${x.text}: ${x.choose!.wrong}`);
    }
  });
```

9. In the `the Grade 10 teacher form` describe: unit count `16`, meaning chips `222`, form chips `418`, and add `assert.ok(html.includes('>s2-nccd-u6_l1<'))`. Add a test that the lead names both semesters:

```ts
  it('names both semesters in its lead', () => {
    assert.ok(html.includes('الفصلان الأول والثاني'));
    assert.ok(!html.includes('الفصل الأول:'));
  });
```

In `englishGrammarG10.test.ts` (read it first): extend `IDS` with the five Semester 2 ids (`kbl-eng-s2-nccd-…`), keep the order check (Semester 1 then 2), the note checks apply to all.

In `englishHub.test.ts`: append the five ids to `GRAMMAR_ONLY` (11 ids), retitle «eleven lessons are grammar-only (five in Grade 9, Articles and five Semester 2 lessons in Grade 10): …», and change the counts test to «the hub has 41 Grade 9 and 26 Grade 10 lessons now …» with `[10, 9, 8, 9, 10, 41, 26]`.

- [ ] **Step 2: Run to verify they fail.**
  Run: `cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY node --experimental-strip-types --test src/__tests__/englishGrammarG10Items.test.ts src/__tests__/englishGrammarG10.test.ts src/__tests__/englishHub.test.ts`
  Expected: FAIL (16 expected, 11 found; hub list lacks the ids).

- [ ] **Step 3: Implement.**
  - `englishHub.ts`: append `'kbl-eng-s2-nccd-u6_l1', 'kbl-eng-s2-nccd-u6_l4', 'kbl-eng-s2-nccd-u7_l1', 'kbl-eng-s2-nccd-u7_l5', 'kbl-eng-s2-nccd-u8_l1',` to `GRAMMAR_ONLY_LESSONS` and update its doc comment: «…and Grade 10's Articles and its Semester 2 grammar lessons (no vocabulary rows are extracted for Semester 2)».
  - `englishGrammarG10Items.ts`: update the header comment (Semester 1 and Semester 2; add the Semester 2 spec path; extend the `meaning` marker list with: «a condition the sentence marks as impossible (Imagine …, If I were …) or likely (Tomorrow …), a self-done marker (myself) or a service marker (by experts, a mechanic), a past fact or past time word for an unreal past, evidence in the sentence for must or can't»); add `const L2 = (s: string) => \`kbl-eng-s2-nccd-${s}\`;` after `L`; append five entries to `G10_ITEM_LESSONS` (`u6_l1`, `u6_l4`, `u7_l1`, `u7_l5`, `u8_l1`) with `lessonId: L2('…')`, `statement` verbatim from the list above (check with `python3 -c "import json;d=json.load(open('lib/curriculum/src/data/iqra_curriculum_g10_english_sem2.json'));[print(l['id'],'|',l['objectives'][0]) for u in d['units'] for l in u['lessons']]"`), and 40 items each in the sizes, kinds and rules of the contract; use the example rows as the first row of each sub-topic where they fit (if one violates a rule, replace it).
  - `englishGrammarG10.ts`: update the header comment (Semester 2 spec; all ten Semester 2 lessons are grammar-only hub lessons); add `const L2 = (s: string) => \`kbl-eng-s2-nccd-${s}\`;`; add `NOT_COVERED_G10` entries `[...SHARED, one bullet]` for the five (final text, do not change it, but check the test passes):
    - `u6_l1`: `الشرط الأول (If it rains, we will stay) والثاني (If I had a car, I would drive): الصيغة تُحدِّدها جملة الشرط، وفي صفوف الاختيار بين الاحتمال والتخيّل تُحدِّد كلمة مثل Imagine أو If I were أو Tomorrow؛ فإن بدت لكم جملة تقبل الصيغتين فاشطبوها. لا مقابلة بين were و was لأن كلتيهما تُقبل.`
    - `u6_l4`: `الشرط الصفري للحقائق العامة: if أو when مع المضارع البسيط في الجملتين. لا يدخل فيه will لأن If you heat ice, it will melt جملة سليمة (شرط أول)، فالخيارات الخاطئة هنا كلها في الشكل (it melt، if you will freeze).`
    - `u7_l1`: `أفعال النقل وما يليها: promise و offer مع to، و admit و deny مع -ing، و tell و warn بعد المفعول مع to. أما suggest فتقبل that we go أيضًا، لذلك لا يُختبر إلا النمط -ing؛ ولا جملة تعتمد على تغيّر الأزمنة في الكلام المنقول.`
    - `u7_l5`: `الأسئلة المنقولة: ترتيب الكلمات كالجملة الخبرية (He asked where I lived لا where did I live)، و if أو whether لأسئلة نعم أو لا. لا يُختبر تغيّر الأزمنة لأن He asked where I live مقبولة أيضًا.`
    - `u8_l1`: `المبني للمجهول في المضارع والماضي ومع الأفعال الناقصة (must be locked)، والأسئلة والنفي؛ الخيارات الخاطئة كلها في الشكل (was build، must locked). لا اختيار بين المبني للمعلوم والمبني للمجهول لأن كليهما مقبول غالبًا.`
  - `englishGrammarReview.ts`, `GRADE_COPY[10]` (three exact `Edit`s; the lead is one long line, so replace these substrings):
    1. `الفصل الأول: ${AR_DIGITS(units)}` → `الفصلان الأول والثاني: ${AR_DIGITS(units)}`
    2. `mustn't أو don't have to)،` → `mustn't أو don't have to، الشرط الأول أو الثاني)،`
    3. `ودرس أدوات التعريف ليس له مفردات في الكتاب، فلا يظهر في الركن إلا بعد توقيعكم.` → `ودرس أدوات التعريف ودروس الفصل الثاني العشرة ليس لها مفردات في الكتاب، فلا تظهر في الركن إلا بعد توقيعكم.`
    4. In `checks`, replace `'في درس أدوات التعريف والمضارع التام البسيط والمستمر: هل الجمل واضحة دون سياق أوسع؟',` with `'في درس أدوات التعريف والمضارع التام البسيط والمستمر والجمل الشرطية وجمل التخمين (must و can\'t): هل الجمل واضحة دون سياق أوسع؟',`

- [ ] **Step 4: Regenerate and run.**

```bash
cd lib/curriculum && node --experimental-strip-types scripts/grammar-sheet.ts
git status --short ../../docs/
env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY pnpm test
```

  Expected: only `docs/english-grammar-g10-review.html` and `docs/english-grammar-g10-sheet.md` modified; the curriculum suite PASSES. A flagged capital that is a real place or hub word may be added to the test's `ok` set; a person's name may not. If another existing test (`external.test.ts`, the print and glued-«و» tests) fails because it enumerates Grade 10 units, read why and update the count, not the rule.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG10Items.ts lib/curriculum/src/englishGrammarG10.ts lib/curriculum/src/englishHub.ts lib/curriculum/src/englishGrammarReview.ts lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts lib/curriculum/src/__tests__/englishGrammarG10.test.ts lib/curriculum/src/__tests__/englishHub.test.ts docs/english-grammar-g10-review.html docs/english-grammar-g10-sheet.md
git diff --cached --stat
git commit -m "Grade 10 Semester 2 grammar: five lessons of hand-written items, grammar-only (hidden)"
```

---

### Task 2: Lessons u8_l6, u9_l1, u9_l4, u10_l1, u10_l3 and the totals

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG10Items.ts`, `lib/curriculum/src/englishGrammarG10.ts`, `lib/curriculum/src/englishHub.ts`
- Modify tests: `lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts`, `…/englishGrammarG10.test.ts`, `…/englishHub.test.ts`
- Regenerate: `docs/english-grammar-g10-review.html`, `docs/english-grammar-g10-sheet.md`

**Interfaces:**
- Consumes: Task 1's `G10_ITEM_LESSONS`, `NOT_COVERED_G10`, `L2`.
- Produces: `G10_ITEM_LESSONS` with 21 entries (840 items, 308 `meaning`, 532 `form`); `NOT_COVERED_G10` with 21 entries; `GRAMMAR_ONLY_LESSONS` with sixteen ids; Grade 10 hub with 31 lessons.

- [ ] **Step 1: Update the tests so they fail.**
  - `englishGrammarG10Items.test.ts`: add `const S2B = ['u8_l6', 'u9_l1', 'u9_l4', 'u10_l1', 'u10_l3'].map(L2);`, the first test becomes `[...FIRST, ...REST, ...S2A, ...S2B]`, and add to `SIZES`:

```ts
  [L2('u8_l6')]: { 'have-something-done': [12, 'form'], 'get-something-done': [12, 'form'], 'service-vs-self': [16, 'meaning'] },
  [L2('u9_l1')]: { 'third-conditional': [14, 'form'], 'past-unreal': [14, 'meaning'], 'would-have-forms': [12, 'form'] },
  [L2('u9_l4')]: { 'wish-present': [14, 'form'], 'wish-past-regrets': [14, 'meaning'], 'if-only': [12, 'form'] },
  [L2('u10_l1')]: { 'must-cant': [14, 'meaning'], 'might-may': [12, 'form'], 'be-v-ing': [14, 'form'] },
  [L2('u10_l3')]: { 'must-have': [14, 'meaning'], 'might-could-have': [12, 'form'], 'cant-have': [14, 'meaning'] },
```

   The totals test becomes «are 21 lessons and 840 items, 308 of them meaning-decided» (21 / 840 / 308; `grammarUnitsForGrade(10).length === 21`). The form-doc test: `class="unit"` count `21`, meaning chips `308`, form chips `532`, plus `assert.ok(html.includes('>s2-nccd-u10_l3<'))`. Add a speculation guard:

```ts
  it('never write must of or could of in a past-speculation sentence or its twin', () => {
    for (const x of sentencesOf(L2('u10_l3'))) {
      assert.ok(!/\b(must|might|could|can't) of\b/i.test(x.text + ' ' + x.claim!.falseText), x.text);
    }
  });
```

  - `englishGrammarG10.test.ts`: `IDS` gains the other five Semester 2 ids (ten in all).
  - `englishHub.test.ts`: `GRAMMAR_ONLY` gains the five ids (sixteen), title «sixteen lessons are grammar-only (five in Grade 9, Articles and the ten Semester 2 lessons in Grade 10): …», counts `[10, 9, 8, 9, 10, 41, 31]`, test title «41 Grade 9 and 31 Grade 10 lessons».

- [ ] **Step 2: Run to verify they fail** (the same three files): FAIL, only 16 lessons.

- [ ] **Step 3: Author the five lessons** exactly as in Task 1 (statements verbatim from the list above; sizes, kinds, rules and example rows from the contract), append them to `G10_ITEM_LESSONS`, add the five ids to `GRAMMAR_ONLY_LESSONS`, and add their `NOT_COVERED_G10` entries (final text):
    - `u8_l6`: `have something done للخدمات (I had my car repaired) و get something done في الكلام غير الرسمي. وجملة مثل I had repaired my car سليمة بمعنى آخر، فلا تُستعمل مموِّهًا إلا حيث تستبعدها كلمة في الجملة (myself أو by experts). في صفوف الخدمة مقابل الفعل بنفسك راجعوا كل جملة.`
    - `u9_l1`: `الشرط الثالث للماضي غير الواقع (If I had known, I would have called). الشرط المختلط (If I knew, I would have called) جملة سليمة، فلا يُستعمل مموِّهًا في صفوف الشكل، وفي صفوف المعنى تستبعده جملة تذكر الواقع الماضي أو كلمة ماضٍ. و would have يُختبر بصيغ خاطئة (would had، would have call).`
    - `u9_l4`: `I wish و if only للأمنيات والندم: wish مع الماضي البسيط للحاضر ومع الماضي التام للماضي. If only I listened جملة سليمة لأمنية حاضرة، فلا تُستعمل مموِّهًا إلا حيث تستبعدها كلمة ماضٍ مثل last year. لا اختيار بين were و was.`
    - `u10_l1`: `التخمين عن الحاضر: must للاستنتاج الإيجابي و can't للنفي القاطع، و might أو may لاحتمال أضعف. صفوف must و can't يُحدِّدها دليل في الجملة (so they must be home)، ولا مقابلة بين might و could لأن كلتيهما تصلح غالبًا.`
    - `u10_l3`: `التخمين عن الماضي: must have و can't have و might have مع التصريف الثالث للفعل. يُحدِّد النوع دليل في الجملة؛ ولا يُستعمل شكل must of غير الرسمي لا صحيحًا ولا مموِّهًا.`
  Update the `englishHub.ts` comment if it still says «first five».

- [ ] **Step 4: Regenerate and run.** The command block of Task 1 Step 4. Expected PASS with 21 lessons and 840 items, only the Grade 10 documents changed. If the glued-«و» test fails on a note, add the space; do not weaken the test. If a `meaning` sub-topic was switched to `form` (rule 2), the pinned kinds and the 308/532 numbers in the tests, in this plan's report and in the spec's counts must follow; report it.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG10Items.ts lib/curriculum/src/englishGrammarG10.ts lib/curriculum/src/englishHub.ts lib/curriculum/src/__tests__/englishGrammarG10Items.test.ts lib/curriculum/src/__tests__/englishGrammarG10.test.ts lib/curriculum/src/__tests__/englishHub.test.ts docs/english-grammar-g10-review.html docs/english-grammar-g10-sheet.md
git diff --cached --stat
git commit -m "Grade 10 Semester 2 grammar: the other five lessons (hidden); 840 Grade 10 items in all"
```

---

### Task 3: The app plays them, and the form looks right

**Files:**
- Modify: `artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts`
- Modify: nothing else expected. If a test fails because an app file assumes Semester 1 only, fix that file minimally and say so in the commit message.

- [ ] **Step 1: Extend the test.** In `englishGrammarG10ItemGames.test.ts` change `LESSONS` to the 21 ids: the eleven Semester 1 ids as now plus
  `['u6_l1', 'u6_l4', 'u7_l1', 'u7_l5', 'u8_l1', 'u8_l6', 'u9_l1', 'u9_l4', 'u10_l1', 'u10_l3'].map(s => \`kbl-eng-s2-nccd-${s}\`)`. Keep it as one list built from two maps, `LESSONS.length` → `21`, and update the titles/doc comment (Grade 10, both semesters, spec paths). Keep every behaviour assertion (Choose, Build and True or false offered on every lesson and Yes or No on none; the right option equals the answer; Build judged right in order; True or false has no picture, is half true and silent; no authored twin voiced; each round has at least six questions).

- [ ] **Step 2: Run it.**
  `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG10ItemGames.test.ts`
  Expected: PASS straight away (the engine is shared). If it fails, read why before changing anything and report.

- [ ] **Step 3: Run the neighbouring files** (`englishGrammarGames`, `englishGrammarG2Games`, `…G3Games`, `…G4Games`, `…G5ItemGames`, `…G9Games`, `…G9ItemGames`, `englishHubGames`, `englishTrueFalseDesc`) with the same command shape. Expected PASS. (`englishHubGames` loops lessons with words: the ten Semester 2 lessons are grammar-only and must not break it; `englishTrueFalseDesc` checks the subtitle against real lesson data and should say «right or wrong» for the new lessons.) Do not run the full mobile suite here.

- [ ] **Step 4: Look at the form.** Open `docs/english-grammar-g10-review.html` in the pre-installed Chromium (Playwright, `/opt/pw-browsers`; never `playwright install`; scripts in the scratchpad directory) at 390 px and A4 landscape print emulation. Check: 21 unit pages, each labelled with its semester and unit title (the Semester 2 titles «Do the right thing», «In the spotlight», «The evolution of advertising», «The power of nature», «Food for thought»), the id shown as `s2-nccd-u6_l1`, form and meaning chips in two colours, no horizontal page scroll at 390 px, and in print no cell edge off the page and no sign-off box over a row. Read the screenshots of the first Semester 2 page, `u8_l6` and `u10_l3`. If the unit heading does not show the semester or unit title, report it (do not change the renderer without the controller).

- [ ] **Step 5: Commit.**

```bash
git add artifacts/mobile/services/__tests__/englishGrammarG10ItemGames.test.ts
git diff --cached --stat
git commit -m "Grade 10 Semester 2 grammar: the app plays the ten lessons (tests)"
```

---

### Task 4: Verify, document

**Files:**
- Modify: `docs/status-log.md` (top), `STATUS.md`, the spec's status line.

- [ ] **Step 1: Whole verification.** `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test` (with the `env -u R2_…` prefix; also `pnpm --filter @workspace/curriculum run verify`); start the full mobile suite in the background (`cd artifacts/mobile && pnpm test > <scratchpad>/mobile-g10s2.log 2>&1 &`; it prints only at the end, about ten minutes; do not edit any source or sign-off file while it runs). Report both `r2.test.ts` results if relevant. Any other failure: read it, report it, fix if this work caused it.

- [ ] **Step 2: Browser check at 390 px, Arabic and English** (after the suite finishes). Build web (`cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), serve with `WEB_PORT=8098 node e2e/serve.mjs` (note its pid; kill it afterwards). Unsigned: the Grade 10 index lacks every Semester 2 lesson and `…/curriculum/english/kbl-eng-s2-nccd-u6_l1` says «lesson not found». Then temporarily set `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-24' }` on the Semester 2 units in `englishGrammarG10.ts` (the `UNITS_G10` map) with the Edit tool, rebuild, and with a Playwright script in the scratchpad check: a Semester 2 lesson appears in the Grade 10 index under its unit with the «grammar activities» row and only Choose, Build and True or false; no Yes or No; Choose/Build play the sentence after answering; True or false has no speaker button; a nine-word sentence wraps with no horizontal scroll; both languages render. Read the screenshots. Restore: `git checkout lib/curriculum/src/englishGrammarG10.ts`, kill the server, confirm `grep -rc "LOCAL CHECK"` finds no non-zero count and `git status --short` is clean.

- [ ] **Step 3: Docs.** Add the entry «Grade 10 grammar (Semester 2) in the English corner — built, shown to nobody yet» at the top of `docs/status-log.md` (what was built: ten grammar-only lessons, 400 items, sub-topics, the meaning/form counts as finally pinned, the hub going from 21 to 31 lessons, the wording change in `GRADE_COPY[10]`; what was verified with the real counts; what was not: no teacher has read a sentence, no audio, no device; the teacher's open points and the risky lessons; any `meaning` sub-topic that switched to `form`) and the title as the first line of «Recent changes» in `STATUS.md` (drop the oldest line so it stays at 30; update «The log has N sections» by the same rule as the neighbouring lines). Change the spec's status line to «implemented (this PR)».

- [ ] **Step 4: Commit.**

```bash
git add docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-24-english-corner-grammar-g10-s2-design.md docs/superpowers/plans/2026-10-24-english-corner-grammar-g10-s2.md
git diff --cached --stat
git commit -m "docs: Grade 10 Semester 2 grammar status-log entry"
```

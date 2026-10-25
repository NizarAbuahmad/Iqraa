# English corner: Grade 5 grammar, the ten hub lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ten Grade 5 grammar hub lessons (S1 U1–U5, S2 U6–U10) grammar activities built from 400 hand-written items, hidden until a teacher signs off.

**Architecture:** The Grade 9 authored-items engine (`GrammarUnit.items`, `unitSentences`, silent True or false, `buildCap(5)` = 9) already does everything the app needs, so Grade 5 is data plus the teacher's form: two new data files, `GRAMMAR_UNITS` gaining the Grade 5 units, and the authored-unit form page generalised from Grade 9 only to take the unit's grade. No app, server or schema change.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script, Expo web for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md`

## Global Constraints

- All ten units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs set with the Edit tool and restored with `git checkout <file>`; `grep -c "LOCAL CHECK"` must print 0 afterwards).
- The Grade 1–4 and Grade 9 grammar sheets and forms and the four reading forms stay byte-identical (their tests pin them).
- Every sentence is 9 words or fewer (`buildCap(5)` is 9), so Build always takes it whole.
- A distractor is `form` (ungrammatical in standard English). No `meaning` item in Grade 5. Never a form that could fit; present perfect items never use the past simple («saw», «did») as the distractor.
- True or false on authored items is silent, true and false alike; false twins are never voiced (`allGrammarSpoken` omits them).
- No real or book-character name in any sentence (not Jameela, Katy, Alice…); a family word (`Mum`, `Dad`, `Granny`) is fine. Nothing religious, political or sensitive.
- Arabic not-covered notes: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No `sed -i`/`perl -pi` on source; use the Edit tool or Write. After editing, `git diff --stat` must show no `Bin N -> M bytes` line, and `grep -c $'\x00'` on new files must be 0.
- Stage named paths only (never `git add -A` or `.`) and check `git diff --cached --stat` before each commit.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- The Latin product name is «Iqrra» in any copy (PR title, form text); repo and package names stay Iqraa.

## File Structure

- Create `lib/curriculum/src/englishGrammarG5Items.ts`: `G5_ITEM_LESSONS` (lesson id, book statement, items), ten entries in hub order.
- Create `lib/curriculum/src/englishGrammarG5.ts`: `GRAMMAR_UNITS_G5` (ten units, `patterns: []`, `reviewedBy: null`) and `NOT_COVERED_G5`.
- Modify `lib/curriculum/src/englishGrammar.ts`: import and spread `GRAMMAR_UNITS_G5` into `GRAMMAR_UNITS`.
- Modify `lib/curriculum/src/englishGrammarReview.ts`: `renderAuthoredUnit` reads its statement from both authored lists, its not-covered notes by the unit's grade and its lesson id with any grade's prefix; `NOT_COVERED` gains `5`; `GRADE_COPY[5]`.
- Modify `lib/curriculum/scripts/grammar-sheet.ts`: grades `[1, 2, 3, 4, 5, 9]`, and the header comment.
- Generate `docs/english-grammar-g5-review.html`, `docs/english-grammar-g5-sheet.md`.
- Tests: create `lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts`, `…/englishGrammarG5.test.ts`, `artifacts/mobile/services/__tests__/englishGrammarG5ItemGames.test.ts`.
- Docs: top of `docs/status-log.md`, `STATUS.md` index line and the «Recent changes» list, spec status line.

Reference files to read first: `lib/curriculum/src/englishGrammarG9Items.ts` (the item helper and data shape), `lib/curriculum/src/__tests__/englishGrammarG9Items.test.ts` (the tests this plan copies), `artifacts/mobile/services/__tests__/englishGrammarG9ItemGames.test.ts`.

## The content contract (Tasks 1 and 2)

Sub-topics and sizes (each lesson sums to 40; 400 in all). `statement` is the lesson's `objectives[0]` copied from `lib/curriculum/src/data/iqra_curriculum_g5_english_sem{1,2}.json` (the lesson key is the id after `-nccd-`, e.g. `u1_l1`); a test reads it back.

| Lesson id (`kbl-g5-eng-…`) | Sub-topics (id: count) | Three example items: `text` / answer / distractor |
| --- | --- | --- |
| `s1-nccd-u1_l1` Welcome Back, present simple with before/after/when | `third-person-s`: 14, `before-after`: 14, `when-clauses`: 12 | «She plays tennis every Saturday.» / plays / play · «Before he eats, he washes his hands.» / washes / wash · «When it rains, we stay inside.» / rains / will rain |
| `s1-nccd-u2_l1` Talent Show, comparative and superlative adjectives | `taller-forms`: 10, `more-forms`: 10, `superlatives`: 12, `irregular`: 8 | «My mum is shorter than me.» / shorter / more short · «Maths is more difficult than art.» / more difficult / difficulter · «She is the kindest girl here.» / the kindest / the most kindest |
| `s1-nccd-u3_l1` Then and Now, past simple (was/were, did) | `was-were`: 14, `did-questions`: 14, `regular-irregular`: 12 | «The computers were very big.» / were / was · «Did you have a phone?» / have / had · «Ten years ago, I sent a letter.» / sent / sended |
| `s1-nccd-u4_l1` Let's Explore!, will / won't | `will`: 14, `wont`: 12, `will-questions`: 14 | «I will visit the Moon one day.» / will visit / will to visit · «We won't see the Sun at night.» / won't see / don't will see · «Will you travel in a rocket?» / Will you travel / Will you to travel |
| `s1-nccd-u5_l1` Off to the Shops, relative clauses (who, where, which) | `who`: 14, `where`: 14, `which`: 12 | «She is the girl who sells fish.» / who / where · «This is the shop where I buy shoes.» / where / who · «The wallet which I bought is red.» / which / who |
| `s2-nccd-u6_l1` Welcome Back, past simple (irregular verbs, did) | `irregular`: 16, `did-negatives`: 12, `questions`: 12 | «Last week, I learnt how to cook.» / learnt / learn · «I didn't go to school yesterday.» / didn't go / didn't went · «What did you do yesterday?» / did you do / you did |
| `s2-nccd-u7_l1` Animals in Danger, past continuous | `was-were-ing`: 14, `when-while`: 14, `questions`: 12 | «The shark was looking for fish.» / was looking / was look · «While I was sleeping, the phone rang.» / was sleeping / was sleep · «What were you doing at nine?» / were you doing / you were doing |
| `s2-nccd-u8_l1` Staying Healthy, should / shouldn't | `should`: 14, `shouldnt`: 14, `advice-questions`: 12 | «You should go to the doctor.» / should go / should to go · «You shouldn't eat so much junk food.» / shouldn't eat / shouldn't to eat · «Should I take some medicine?» / Should I take / Should I to take |
| `s2-nccd-u9_l1` Curtain Up!, present perfect | `have-has`: 16, `havent-hasnt`: 12, `questions`: 12 | «I have read that poem before.» / have read / has read · «She hasn't seen the show.» / hasn't seen / hasn't see · «Has he finished the costumes?» / Has he finished / Have he finished |
| `s2-nccd-u10_l1` Let's Get Creative!, present perfect with ever/never | `ever-questions`: 14, `never`: 14, `short-answers`: 12 | «Have you ever made chocolates?» / made / make · «I have never used a sewing machine.» / used / use · «Has she ever baked? Yes, she has.» / has / have |

Authoring rules, every item:

1. Nine words or fewer; one grammar point; what decides the answer is in the sentence (a time word, a subject, a clause).
2. Vocabulary from the unit's own hub lesson or the function-word list (`FUNCTION_WORDS` in `englishGrammarReview.ts`); a word outside both is printed on the form for the teacher, so keep these few.
3. `answer` appears exactly once, as whole words, case-sensitive; trailing punctuation stays in `text` (the engine moves it to the distractor).
4. `distractor` is ungrammatical in the sentence, from this list only: the bare verb for a participle or past form, a doubled or missing auxiliary, the wrong agreement (`has` for `I`), `to` after a modal, the wrong relative word (a person word for a thing, `where` for a person), a question in statement word order, `more` on a short adjective or `-er`/`-est` on a long one, `will` inside a time clause (`when it will rain`), the bare verb for a third-person form (`she wash`), a regular ending on an irregular verb, a tensed or -ing verb after a modal or `did`, a misplaced negative, a doubled comparative marker (`more worse`, `the most kindest`). Never `the most` + a short adjective (`the most kind`), `-fuller`/`-fullest` on a -ful adjective, `saw`/`did` for a participle, or `which` for a person.
5. No name; no repeated `text` within the lesson; a twin (the sentence with the distractor in place) must never equal another true sentence of the lesson.
6. Kind is `form` for every item.

Use this helper at the top of the data file (the same shape as the Grade 9 file):

```ts
type Row = [text: string, answer: string, distractor: string];
const items = (topic: string, rows: Row[]): GrammarItem[] =>
  rows.map(([text, answer, distractor]) => ({ topic, kind: 'form' as const, text, answer, distractor }));
```

---

### Task 1: Semester 1 lessons (U1–U5) and the item rules

**Files:**
- Create: `lib/curriculum/src/englishGrammarG5Items.ts`, `lib/curriculum/src/englishGrammarG5.ts`
- Modify: `lib/curriculum/src/englishGrammar.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts` (create)

**Interfaces:**
- Consumes: `GrammarItem`, `GrammarUnit` (types from `englishGrammar.ts`), `hubLessonsForGrade` (`englishHub.ts`).
- Produces: `G5_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[]`; `GRAMMAR_UNITS_G5: GrammarUnit[]`; `NOT_COVERED_G5: Record<string, string[]>`.

- [ ] **Step 1: Write the failing test**, `englishGrammarG5Items.test.ts`:

```ts
/**
 * Grade 5 grammar on the ten authored hub lessons (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor is a teacher's
 * call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { G5_ITEM_LESSONS } from '../englishGrammarG5Items.ts';
import { hubLesson } from '../englishHub.ts';

const dataFile = (sem: 1 | 2) => JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g5_english_sem${sem}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g5-eng-${s}`;
const S1 = ['s1-nccd-u1_l1', 's1-nccd-u2_l1', 's1-nccd-u3_l1', 's1-nccd-u4_l1', 's1-nccd-u5_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G5_ITEM_LESSONS.map(l => l.lessonId);

const SIZES: Record<string, Record<string, number>> = {
  [L('s1-nccd-u1_l1')]: { 'third-person-s': 14, 'before-after': 14, 'when-clauses': 12 },
  [L('s1-nccd-u2_l1')]: { 'taller-forms': 10, 'more-forms': 10, superlatives: 12, irregular: 8 },
  [L('s1-nccd-u3_l1')]: { 'was-were': 14, 'did-questions': 14, 'regular-irregular': 12 },
  [L('s1-nccd-u4_l1')]: { will: 14, wont: 12, 'will-questions': 14 },
  [L('s1-nccd-u5_l1')]: { who: 14, where: 14, which: 12 },
};

describe('Grade 5 authored lessons', () => {
  it('start with the five Semester 1 hub lessons, unsigned and offered to nobody', () => {
    assert.deepEqual(ids().slice(0, 5), S1);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grammarOnly, undefined, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G5_ITEM_LESSONS) {
      const sem = l.lessonId.includes('-s1-') ? 1 : 2;
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile(sem).units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson in the pinned sub-topic sizes', () => {
    for (const [id, sizes] of Object.entries(SIZES)) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      const by = new Map<string, number>();
      for (const x of s) by.set(x.patternId, (by.get(x.patternId) ?? 0) + 1);
      assert.deepEqual(Object.fromEntries(by), sizes, id);
    }
  });

  it('are buildable, picture-free, unique, form-only and never a Yes or No', () => {
    for (const id of ids()) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id} ${x.text}`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.equal(x.kind, 'form', x.text);
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
    const ok = new Set(['I', "I'm", "I'd", "I'll", "I've", 'Dad', 'Mum', 'Granny', 'TV', 'Jordan', 'Amman', 'Aqaba', 'Petra', 'Sun', 'Moon', 'Earth', 'Mars', 'Saturday', 'Sunday', 'Monday', 'Friday', 'English', 'Science']);
    for (const id of ids()) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
      for (const name of ['Jameela', 'Katy', 'Alice', 'Hamed']) assert.ok(!x.text.includes(name), x.text);
    }
  });

  it('never use the past simple as a present perfect distractor', () => {
    for (const id of [L('s2-nccd-u9_l1'), L('s2-nccd-u10_l1')].filter(i => ids().includes(i))) {
      for (const x of sentencesOf(id)) assert.ok(!/^(saw|did|went|ate|took|made|wrote)$/.test(x.choose!.wrong), `${id}: ${x.text}`);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 5', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(5).length, ids().length);
  });
});
```

(The `U9`/`U10` "never use the past simple" test iterates only the lessons that exist yet; Task 2 completes the lists.)

- [ ] **Step 2: Run to verify it fails.**
  Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG5Items.test.ts`
  Expected: FAIL (`Cannot find module '../englishGrammarG5Items.ts'`).

- [ ] **Step 3: Author the Semester 1 data.** Create `englishGrammarG5Items.ts`:
  - header comment: what it is (the ten authored Grade 5 lessons), the spec path, the distractor rule (all `form`, from the list in the contract), «every sentence is nine words or fewer», «`statement` is the book's own line for the lesson id, read back by a test», «imports only types from the engine: `englishGrammar.ts` imports `englishGrammarG5.ts`, which imports this file»;
  - the `items` helper above and `const L = (s: string) => \`kbl-g5-eng-${s}\`;`;
  - `export const G5_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [ … ]` with five entries now (U1–U5), each `{ lessonId: L('s1-nccd-uN_l1'), statement: '<objectives[0] verbatim>', items: [ ...items('<sub-topic>', [ [text, answer, distractor], … ]), … ] }`. Read the five statements with:
    `python3 -c "import json;d=json.load(open('lib/curriculum/src/data/iqra_curriculum_g5_english_sem1.json'));[print(l['id'],'|',l['objectives'][0]) for u in d['units'] for l in u['lessons']]"`
  - write the rows to the sizes in the contract table, using the example rows as the first row of each sub-topic.

  Create `englishGrammarG5.ts`:

```ts
/**
 * Grade 5 grammar for the English corner: the ten authored hub lessons (spec:
 * docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md), each a unit of hand-written items from
 * `englishGrammarG5Items.ts`. Nothing is pictured. Every unit ships `reviewedBy: null`: offered to nobody until a teacher
 * signs the printed form (`docs/english-grammar-g5-review.html`). `NOT_COVERED_G5` is what the form says is left out.
 *
 * Imports only types from the engine, and the hub (which does not import the engine): `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';
import { G5_ITEM_LESSONS } from './englishGrammarG5Items.ts';
import { hubLessonsForGrade } from './englishHub.ts';

const HUB_ORDER = new Map(hubLessonsForGrade(5).map((l, i) => [l.id, i]));

const UNITS_G5: GrammarUnit[] = G5_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items }) satisfies GrammarUnit);

/** In the book's order, so the sheet reads unit by unit. */
export const GRAMMAR_UNITS_G5: GrammarUnit[] = [...UNITS_G5].sort((a, b) => HUB_ORDER.get(a.lessonId)! - HUB_ORDER.get(b.lessonId)!);

const SHARED = [
  'لا صور ولا «نعم أم لا» في هذا الدرس: الجملة تُحدِّد الصيغة، والأسئلة عن القواعد لا عن المعلومات.',
  '«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها. «اختر الكلمة» و«رتّب الجملة» يقرآن الجملة الصحيحة بعد الإجابة.',
];

/** What a Grade 5 lesson does not cover, and why — printed on the teacher's form. One bullet per item, no `"`, `&`, `<` or `>`. */
export const NOT_COVERED_G5: Record<string, string[]> = {
  // one entry per lesson id: [...SHARED, '<lesson-specific bullet>']
};
```

  and fill `NOT_COVERED_G5` for the five lessons now (key `kbl-g5-eng-s1-nccd-uN_l1`; value `[...SHARED, one bullet]`): U1 «جمل before وafter وwhen تُحدِّد صيغة الفعل مع he وshe وit (washes) وأن will لا تأتي بعد when، دون سؤال عن ترتيب الأحداث نفسه.»; U2 «الصفات الشاذة (good وbad) في موضوع واحد صغير، ولا مقارنة بـ as … as.»; U3 «الخيارات الخاطئة أخطاء في الصيغة (had بعد did، sended)، لا اختيار بين الماضي البسيط والماضي المستمر.»; U4 «will وwon't فقط، دون going to، لأن الاختيار بينها وبين will كثيرًا ما يقبل الإجابتين.»; U5 «who للأشخاص وwhich للأشياء وwhere للأماكن؛ وwho دائمًا فاعلٌ في جملة الصلة، أما who بصفة مفعول (the man who we saw) فغير مختبَر.»

  In `englishGrammar.ts` add `import { GRAMMAR_UNITS_G5 } from './englishGrammarG5.ts';` after the G4 import and change `GRAMMAR_UNITS` to `[...GRAMMAR_UNITS_G1, ...GRAMMAR_UNITS_G2, ...GRAMMAR_UNITS_G3, ...GRAMMAR_UNITS_G4, ...GRAMMAR_UNITS_G5, ...GRAMMAR_UNITS_G9]`.

- [ ] **Step 4: Run to verify it passes.**
  Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG5Items.test.ts`, then `pnpm --filter @workspace/curriculum test`.
  Expected: PASS for the Semester 1 assertions (the "are in GRAMMAR_UNITS" count equals 5 for now). If a count or a rule fails, fix the data, not the test. Any capital the name test flags that is a real place or hub word may be added to its `ok` set; a person's name may not.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG5Items.ts lib/curriculum/src/englishGrammarG5.ts lib/curriculum/src/englishGrammar.ts lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts
git diff --cached --stat
git commit -m "Grade 5 grammar data: Semester 1, five lessons of hand-written items (hidden)"
```

---

### Task 2: Semester 2 lessons (U6–U10) and the totals

**Files:**
- Modify: `lib/curriculum/src/englishGrammarG5Items.ts`, `lib/curriculum/src/englishGrammarG5.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts` (extend), `lib/curriculum/src/__tests__/englishGrammarG5.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's `G5_ITEM_LESSONS`, `NOT_COVERED_G5`.
- Produces: `G5_ITEM_LESSONS` with ten entries (U1–U5 then U6–U10); `NOT_COVERED_G5` with ten entries.

- [ ] **Step 1: Extend the test.** In `englishGrammarG5Items.test.ts` add `S2 = ['s2-nccd-u6_l1', 's2-nccd-u7_l1', 's2-nccd-u8_l1', 's2-nccd-u9_l1', 's2-nccd-u10_l1'].map(L)`; add to `SIZES`:

```ts
  [L('s2-nccd-u6_l1')]: { irregular: 16, 'did-negatives': 12, questions: 12 },
  [L('s2-nccd-u7_l1')]: { 'was-were-ing': 14, 'when-while': 14, questions: 12 },
  [L('s2-nccd-u8_l1')]: { should: 14, shouldnt: 14, 'advice-questions': 12 },
  [L('s2-nccd-u9_l1')]: { 'have-has': 16, 'havent-hasnt': 12, questions: 12 },
  [L('s2-nccd-u10_l1')]: { 'ever-questions': 14, never: 14, 'short-answers': 12 },
```

  change the first test to `assert.deepEqual(ids(), [...S1, ...S2])`, and add:

```ts
  it('are ten lessons and 400 items', () => {
    assert.equal(G5_ITEM_LESSONS.length, 10);
    assert.equal(G5_ITEM_LESSONS.reduce((n, l) => n + sentencesOf(l.lessonId).length, 0), 400);
    assert.equal(grammarUnitsForGrade(5).length, 10);
  });
```

  Create `englishGrammarG5.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G5, NOT_COVERED_G5 } from '../englishGrammarG5.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { offeredGrammar } from '../englishGrammar.ts';

describe('Grade 5 grammar units', () => {
  it('are the ten grammar lessons of the hub, in hub order, all unsigned', () => {
    const hubIds = hubLessonsForGrade(5).map(l => l.id);
    assert.deepEqual(GRAMMAR_UNITS_G5.map(u => u.lessonId), hubIds.filter(id => GRAMMAR_UNITS_G5.some(u => u.lessonId === id)));
    for (const u of GRAMMAR_UNITS_G5) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    for (const u of GRAMMAR_UNITS_G5) {
      const notes = NOT_COVERED_G5[u.lessonId];
      assert.ok(notes && notes.length >= 3, u.lessonId);
      for (const n of notes) assert.ok(!/["&<>]/.test(n), `${u.lessonId}: ${n}`);
    }
    assert.deepEqual(Object.keys(NOT_COVERED_G5).sort(), GRAMMAR_UNITS_G5.map(u => u.lessonId).sort());
  });
});
```

- [ ] **Step 2: Run to verify it fails** (`node --experimental-strip-types --test src/__tests__/englishGrammarG5Items.test.ts src/__tests__/englishGrammarG5.test.ts`): FAIL, only five lessons.

- [ ] **Step 3: Author Semester 2.** Append the five entries (U6–U10) to `G5_ITEM_LESSONS` the same way, statements from `…_sem2.json`, sizes and examples from the contract table. Extra care: U6 distractors are the bare verb after a past marker («yesterday», «last week», «ago») or a regular ending on an irregular verb («goed»), or a past form after `did`/`didn't`; U9 and U10 distractors follow rule 4 (bare verb for the participle, wrong `has`/`have`, `Have he`), and every `short-answers` item is a two-clause text (`Has she ever baked? Yes, she has.`) whose lower-case answer appears once. Add the five `NOT_COVERED_G5` entries (`[...SHARED, bullet]`): U6 «الماضي البسيط للأفعال الشاذة (learnt وwent) وdid في السؤال والنفي؛ والخيارات الخاطئة أخطاء في الصيغة (didn't went)، لا اختيار بين الماضي والمضارع التام.»; U7 «الماضي المستمر مع while وwhen؛ لا اختيار بينه وبين الماضي البسيط لأن للجملة أحيانًا أكثر من صيغة مقبولة.»; U8 «should وshouldn't للنصيحة فقط، دون must وhave to، والخيارات الخاطئة أخطاء في الصيغة (should to go).»; U9 «المضارع التام بـ have وhas والتصريف الثالث للفعل؛ لا اختيار بينه وبين الماضي البسيط، والخيارات الخاطئة أخطاء في الصيغة (has read مقابل have read مع I).»; U10 «ever في السؤال وnever في الجملة والإجابات القصيرة (Yes, I have. / No, I haven't.)؛ لا اختيار بين المضارع التام والماضي البسيط.»

- [ ] **Step 4: Run to verify it passes.** The two test files, then `pnpm --filter @workspace/curriculum test`. Expected PASS with 10 lessons and 400 items.

- [ ] **Step 5: Typecheck and commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarG5Items.ts lib/curriculum/src/englishGrammarG5.ts lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts lib/curriculum/src/__tests__/englishGrammarG5.test.ts
git diff --cached --stat
git commit -m "Grade 5 grammar data: Semester 2, five more lessons (hidden); 400 items in all"
```

---

### Task 3: The teacher's form takes a grade

**Files:**
- Modify: `lib/curriculum/src/englishGrammarReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`
- Generate: `docs/english-grammar-g5-review.html`, `docs/english-grammar-g5-sheet.md`
- Test: `lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts` (append)

**Interfaces:**
- Consumes: `G5_ITEM_LESSONS`, `NOT_COVERED_G5`, `unitGrade` (`englishGrammar.ts`).
- Produces: `renderGrammarReviewHtml(5)`; `renderAuthoredUnit` working for any authored unit.

- [ ] **Step 1: Failing test (append to `englishGrammarG5Items.test.ts`)**

```ts
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { renderGrammarSheet } from '../englishGrammar.ts';

describe('the Grade 5 teacher form', () => {
  const html = renderGrammarReviewHtml(5);
  const docs = (name: string) => readFileSync(new URL(`../../../../docs/${name}`, import.meta.url), 'utf8');
  it('equals the committed form and sheet', () => {
    assert.equal(docs('english-grammar-g5-review.html'), html);
    assert.equal(docs('english-grammar-g5-sheet.md'), renderGrammarSheet(5));
  });
  it("prints each lesson's book statement and the first check, a kind for every item and the not-covered notes", () => {
    for (const l of G5_ITEM_LESSONS) assert.ok(html.includes(l.statement.replace(/'/g, '&#39;')) || html.includes(l.statement), l.lessonId);
    assert.ok(html.includes('تأكدوا أولًا'));
    assert.ok(html.includes('الكلمات خارج قوائم المفردات'));
    assert.equal(html.split('class="unit"').length - 1, 10);
    assert.ok(html.includes('الصف الخامس'));
  });
  it('lists every sentence once', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) assert.ok(html.includes(x.text.replace(/'/g, '&#39;')) || html.includes(x.text), x.text);
  });
  it('leaves the other grades alone', () => {
    for (const g of [1, 2, 3, 4, 9]) assert.equal(docs(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `grade ${g}`);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (`GRADE_COPY[5]` is undefined, so `renderGrammarReviewHtml(5)` throws).

- [ ] **Step 3: Implement** in `englishGrammarReview.ts`:
  - imports: `import { NOT_COVERED_G5 } from './englishGrammarG5.ts';` and `import { G5_ITEM_LESSONS } from './englishGrammarG5Items.ts';`; `unitGrade` from `./englishGrammar.ts` (add to the existing import list).
  - `NOT_COVERED`: add `5: NOT_COVERED_G5`.
  - `renderAuthoredUnit`: replace `G9_ITEM_LESSONS.find(…)` with `[...G5_ITEM_LESSONS, ...G9_ITEM_LESSONS].find(l => l.lessonId === u.lessonId)!.statement`; `lesson.id.replace(/^kbl-g9-eng-/, '')` with `lesson.id.replace(/^kbl-g\d+-eng-/, '')`; `NOT_COVERED[9]?.[u.lessonId]` with `NOT_COVERED[unitGrade(u)]?.[u.lessonId]`.
  - Add `GRADE_COPY[5]` after `[4]` (the Grade 5 object, same keys as `[9]`; `extraCss` repeats the `.kind`, `.kind-form`, `.kind-meaning`, `.topic-row th` and `.lesson-id` rules of `[9]` — copy the same five lines — and nothing else):

```ts
  5: {
    title: 'مراجعة قواعد الصف الخامس',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الخامس',
    lead: (total, units) => `هذه مراجعة قواعد الصف الخامس: ${AR_DIGITS(units)} دروس كُتبت جملها واحدةً واحدة، لكل جملة إجابتها الصحيحة وخيار مموِّه غير سليم لغويًا. الكتاب يعطي موضوع كل درس وجملة نموذجية واحدة فقط، فكل جملة هنا كتبناها نحن، وتُراجَع هنا قبل أي ظهور لها. لا صور في أي درس. <b>لن يرى الطلاب أي درس قبل أن توافقوا عليه.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ، وخياران: الصحيح أمام المموِّه، مثل <span dir="ltr">washes / wash</span> أو <span dir="ltr">was looking / was look</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. حتى ٩ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>تُعرض الجملة نفسها، أو توأمها الخاطئ باستبدال الإجابة بالمموِّه. <b>هذا النشاط صامت:</b> لا يُسمَع فيه أي جملة، صحيحة أو خاطئة، حتى لا يسمع الطالب إنجليزية خاطئة ولا تدل الصامتة على الجواب.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل رقم الدرس يطابق صفحة الكتاب؟ (يقول الكتاب بالإنجليزية في أعلى كل صفحة.)',
      'هل أي مموِّه مقبول أحيانًا في صفك؟',
      'في «الكلمات خارج قوائم المفردات»: وافقوا على الكلمات المناسبة للصف الخامس واشطبوا الباقي.',
      'هل جمل المضارع التام واضحة دون مقارنة بالماضي البسيط؟',
      'هل طول الجمل مناسب لـ «رتّب الجملة»؟',
    ],
    extraCss: `
  .kind { font-family: var(--latin); font-size: .82rem; border-radius: 6px; padding: 1px 8px; border: 1px solid var(--rule); }
  .kind-form { background: var(--wrong-bg); color: var(--wrong); }
  .kind-meaning { background: var(--tint); color: var(--teal); }
  .topic-row th { text-align: start; background: var(--tint); font-family: var(--latin); font-weight: 600; }
  .lesson-id { font-family: var(--latin); font-size: .8rem; color: var(--muted); font-weight: 400; }`,
  },
```

  Check how `[9]`'s `checks`/`acts` are consumed (`copy.acts`, `copy.checks`, `copy.lead(total, units)`); the shape above matches `GradeCopy`. The page has no data page for Grade 5 (the `grade === 4 ? … : grade === 9 ? … : ''` tail already yields `''`).

  In `scripts/grammar-sheet.ts` change the loop to `for (const grade of [1, 2, 3, 4, 5, 9])` and the header comment «for Grades 1 to 4 and 9» to «for Grades 1 to 5 and 9», adding `src/englishGrammarG5.ts, src/englishGrammarG5Items.ts` to the «re-run after any change to» list.

- [ ] **Step 4: Generate and run.**

```bash
cd lib/curriculum && node --experimental-strip-types scripts/grammar-sheet.ts
git status --short docs/
```

  Expected: only `docs/english-grammar-g5-review.html` and `docs/english-grammar-g5-sheet.md` are new (`git status` shows nothing modified for g1–g4, g9 or the reading forms; if a grade 1–4 or 9 file changed, the refactor changed output — revert it and fix `renderAuthoredUnit`). Then `pnpm --filter @workspace/curriculum test` — PASS.

- [ ] **Step 5: Look at it.** Serve or open `docs/english-grammar-g5-review.html` in Chromium at 390 px and at A4 landscape (print emulation) with the Playwright pattern of the earlier `g9form.mjs` script in the scratchpad: ten unit pages, topic rows, the kind chips, the book statement line at the top of each page, no horizontal page scroll; take a screenshot of the first unit and one later unit and read them.

- [ ] **Step 6: Commit.**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammarReview.ts lib/curriculum/scripts/grammar-sheet.ts lib/curriculum/src/__tests__/englishGrammarG5Items.test.ts docs/english-grammar-g5-review.html docs/english-grammar-g5-sheet.md
git diff --cached --stat
git commit -m "Grade 5 grammar: the teacher's form for the ten authored lessons"
```

---

### Task 4: The app plays them

**Files:**
- Test: `artifacts/mobile/services/__tests__/englishGrammarG5ItemGames.test.ts` (create)
- Modify: nothing expected. If a test fails because an app file assumes Grade 9 only, fix that file minimally and say so in the commit message.

**Interfaces:**
- Consumes: `grammarActivityAvailable`, `buildChooseRound`, `buildSentenceRound`, `buildTrueFalseRound`, `isSentenceBuilt`, `isSilentTrueFalse` (`artifacts/mobile/services/englishHub/games.ts`).

- [ ] **Step 1: Write the test.** Copy `englishGrammarG9ItemGames.test.ts` to `englishGrammarG5ItemGames.test.ts` and change: the doc comment («The ten authored Grade 5 lessons on the app side (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md)…»); `LESSONS` to the ten Grade 5 ids (`s1-nccd-u1_l1`, `s1-nccd-u2_l1`, `s1-nccd-u3_l1`, `s1-nccd-u4_l1`, `s1-nccd-u5_l1`, `s2-nccd-u6_l1`, `s2-nccd-u7_l1`, `s2-nccd-u8_l1`, `s2-nccd-u9_l1`, `s2-nccd-u10_l1`) mapped with `` `kbl-g5-eng-${s}` ``; every describe/it title from «Grade 9» to «Grade 5»; and delete any assertion that refers to a Grade 9 lesson id (for example the Unit 4 claim check) or to a count of nineteen. Keep all behaviour assertions: Choose, Build and True or false offered on every lesson and Yes or No on none; the right option equals the answer; Build judges the sentence in order right; True or false has no picture, is half true and is silent.

- [ ] **Step 2: Run it.**
  Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG5ItemGames.test.ts`
  Expected: PASS straight away (the engine is shared). If it fails, read why before changing anything: a failure is an assumption about Grade 9 in `games.ts` or in an existing round builder.

- [ ] **Step 3: Run the neighbouring mobile files** to catch an enumerate-all-grades assumption: `services/__tests__/englishGrammarGames.test.ts`, `englishGrammarG2Games`, `…G3Games`, `…G4Games`, `…G9Games`, `…G9ItemGames`, `englishHubGames`, plus `cd lib/curriculum && pnpm test`. Expected PASS.

- [ ] **Step 4: Commit.**

```bash
git add artifacts/mobile/services/__tests__/englishGrammarG5ItemGames.test.ts
git diff --cached --stat
git commit -m "Grade 5 grammar: the app plays the ten lessons (tests)"
```

---

### Task 5: Verify, document, push

**Files:**
- Modify: `docs/status-log.md` (top), `STATUS.md`, the spec's status line.

- [ ] **Step 1: Whole-suite verification.** `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test` and its `verify`; start the full mobile suite in the background: `cd artifacts/mobile && pnpm test > <scratchpad>/mobile-g5.log 2>&1 &` (it prints only at the end, about ten minutes — do not edit sign-offs or source files that tests read while it runs). Read the log's pass and fail counts when it finishes; the run before this change had 6906 passing and 2 failing, both fixed since, so any failure is read, not assumed.

- [ ] **Step 2: Browser check at 390 px, Arabic and English.** (Run after the suite has finished.) Build the web app and serve it: `cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`, then `WEB_PORT=8098 node e2e/serve.mjs` (note its pid to kill it).
  - Unsigned: open `/curriculum/english/kbl-g5-eng-s1-nccd-u1_l1` — no grammar cards.
  - Set `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-23' }` on the ten units in `englishGrammarG5.ts` with the Edit tool (one place: the `.map` in `UNITS_G5`), rebuild, and with a Playwright script in the scratchpad (model: `g9items-browser.mjs`) visit two Grade 5 lessons (one S1 and one S2): Choose, Build and True or false appear, no Yes or No; Choose and Build play the sentence after answering; True or false shows no speaker button and plays nothing; a sentence with a long-ish text (nine words) wraps without horizontal scroll; Arabic and English both render. Read the screenshots.
  - Restore: `git checkout lib/curriculum/src/englishGrammarG5.ts`, rebuild is not needed, kill the server, and confirm `grep -rc "LOCAL CHECK" lib/curriculum/src artifacts/mobile/services | grep -v ":0"` prints nothing.

- [ ] **Step 3: Docs.** Add «Grade 5 grammar in the English corner — built, shown to nobody yet» at the top of `docs/status-log.md` (what was built: ten lessons, 400 items, sub-topics, all `form`; the form generalised from Grade 9 to any grade with `GRADE_COPY[5]`; what was verified, with the real counts from the runs above; what was not: a teacher has not read a sentence, no audio, no device; the limits from the spec). Add the entry's title as the first line of «Recent changes» in `STATUS.md` (and drop the oldest line so the list stays at 30); edit nothing else there unless a line stopped being true. Change the spec's status line to «implemented (this PR)».

- [ ] **Step 4: Commit and push.**

```bash
git add docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md docs/superpowers/plans/2026-10-23-english-corner-grammar-g5.md
git diff --cached --stat
git commit -m "docs: Grade 5 grammar status-log entry"
git push -u origin ccr-d9db5f6c-mgwkuo
```

  If the push is rejected because `main` moved and the branch conflicts, merge `origin/main` into the branch (never rebase or force-push), resolve `docs/status-log.md`/`STATUS.md` by keeping both sides (this change on top), rerun the curriculum tests, push.

- [ ] **Step 5: PR.** Branch `ccr-d9db5f6c-mgwkuo` already has draft PR #1212 (Grade 9). Unless the user has said to split, add a section to its description for Grade 5 (what, how verified, not done: teacher sign-off, audio, device) and retitle it to cover both; otherwise open a new draft PR from the restarted branch. Check CI on the pushed head and fix anything red.

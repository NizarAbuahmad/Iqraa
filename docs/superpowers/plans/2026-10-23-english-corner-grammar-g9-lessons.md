# English corner: Grade 9 grammar, the thirteen hub lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give thirteen Grade 9 hub lessons (S1 U1, U2, U3, U5; S2 U6, U8, U9, U10) grammar activities built from hand-written items, hidden until a teacher signs off.

**Architecture:** `GrammarUnit` gains optional `items` (a sentence with its correct answer, its distractor and a kind); `unitSentences` turns each into the `GrammarSentence` the app already uses (phrase Choose, a false twin for True or false, whole-sentence Build), flagged so True or false is silent. The item data lives in a new file; the teacher's form gets an authored-unit page; the app's True or false screen skips sound for flagged items.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script, Expo web for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-lessons-design.md`

## Global Constraints

- All thirteen units ship `reviewedBy: null`; no sign-off is ever committed (browser checks use temporary local sign-offs, restored with `git checkout`, `grep -c "LOCAL CHECK"` is 0).
- The Grade 1–4 grammar sheets and forms, the four reading forms and the Unit 4 pilot's pages stay byte-identical (tests pin them).
- Every sentence is 9 words or fewer (`buildCap(9)`), so Build always takes the whole sentence.
- A distractor is `form` (ungrammatical in standard English) or `meaning` (grammatical but excluded by something in the sentence itself); never a form that could fit.
- True or false on authored items is silent, true and false alike: no auto-play and no speaker button. False twins are never voiced (`allGrammarSpoken` omits them).
- Arabic not-covered notes: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No real person's name in any sentence; nothing religious, political or sensitive.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`.
- Deviation from the spec, decided while planning: **a book-page check is pinned by a test**, not only printed. Each authored lesson records the book's «I can» statement, and a test reads `lib/curriculum/src/data/iqra_curriculum_g9_eng_sem{1,2}.json` and asserts the lesson's `objectives[0]` equals it.

## File Structure

- Modify `lib/curriculum/src/englishGrammar.ts`: `GrammarItem`, `GrammarUnit.items`, `GrammarSentence.kind`, `claim.voiced`; items in `unitSentences`; `allGrammarSpoken` skips unvoiced twins.
- Create `lib/curriculum/src/englishGrammarG9Items.ts`: `G9_ITEM_LESSONS` (lesson id, book statement, items) for the thirteen lessons.
- Modify `lib/curriculum/src/englishGrammarG9.ts`: append the thirteen units (`patterns: []`, `items`), extend `NOT_COVERED_G9`.
- Modify `lib/curriculum/src/englishGrammarReview.ts` and `scripts/grammar-sheet.ts` (no change expected there): an authored-unit page; regenerate `docs/english-grammar-g9-review.html` and `-sheet.md`.
- Modify `artifacts/mobile/services/englishHub/games.ts` (`isSilentTrueFalse`) and `components/englishHub/GrammarActivities.tsx` (silent True or false).
- Tests: `englishGrammarEngine.test.ts` (append), `englishGrammarG9Items.test.ts` (create), `englishGrammarG9.test.ts` (update pinned counts), `artifacts/mobile/services/__tests__/englishGrammarG9ItemGames.test.ts` (create).
- Docs: top of `docs/status-log.md`, `STATUS.md` index line, spec status.

---

### Task 1: The engine reads authored items

**Files:**
- Modify: `lib/curriculum/src/englishGrammar.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts` (append)

**Interfaces:**
- Produces: `GrammarItem`, `GrammarUnit['items']`, `GrammarSentence['kind']` (optional), `GrammarSentence['claim']` with optional `voiced: false`. `unitSentences(unit)` includes items after patterns. `allGrammarSpoken()` omits a claim with `voiced === false`.

- [ ] **Step 1: Write the failing tests** (append to `englishGrammarEngine.test.ts`, which already has a `FORM_UNIT`-style helper; build the unit literal inline)

```ts
describe('authored items (Grade 9)', () => {
  const unit = (items: GrammarItem[]): GrammarUnit => ({ lessonId: 'kbl-g9-eng-s1-nccd-u1_l1', reviewedBy: null, patterns: [], slots: {}, items });
  const item = (over: Partial<GrammarItem> = {}): GrammarItem => ({
    topic: 'now', text: 'Listen! The baby is crying.', answer: 'is crying', distractor: 'cries', kind: 'meaning', ...over,
  });

  it('an item becomes a picture-free sentence with a phrase Choose and a silent false twin', () => {
    const [s] = unitSentences(unit([item()]));
    assert.equal(s.text, 'Listen! The baby is crying.');
    assert.equal(s.patternId, 'now');
    assert.equal(s.picture, null);
    assert.equal(s.yesNo, null);
    assert.equal(s.kind, 'meaning');
    assert.deepEqual(s.choose, { kind: 'phrase', start: 3, length: 2, right: 'is crying', wrong: 'cries' });
    assert.deepEqual(s.claim, { falseText: 'Listen! The baby cries.', voiced: false });
    assert.deepEqual(s.build, { tokens: ['Listen!', 'The', 'baby', 'is', 'crying.'], text: 'Listen! The baby is crying.', prompt: null });
  });

  it('keeps the sentence punctuation on the replaced words, mid-sentence and at the end', () => {
    const [mid, end] = unitSentences(unit([
      item({ text: 'While I was walking, it started to rain.', answer: 'was walking', distractor: 'was walk', kind: 'form' }),
      item({ text: 'She enjoys reading.', answer: 'reading', distractor: 'to read', kind: 'form' }),
    ]));
    assert.equal(mid.claim!.falseText, 'While I was walk, it started to rain.');
    assert.equal(end.claim!.falseText, 'She enjoys to read.');
  });

  it('refuses an item whose answer is missing, repeated, or equal to its distractor', () => {
    assert.throws(() => unitSentences(unit([item({ answer: 'is smiling' })])), /not in/);
    assert.throws(() => unitSentences(unit([item({ text: 'It is a cat. It is a dog.', answer: 'is', distractor: 'was' })])), /more than once/);
    assert.throws(() => unitSentences(unit([item({ distractor: 'is crying' })])), /differs/);
  });

  it('allGrammarSpoken keeps a true sentence and leaves out its unvoiced twin', () => {
    const spoken = allGrammarSpoken();
    // The committed Grade 4 claims are voiced; an authored twin is not (checked on the real data in the Grade 9 test).
    assert.ok(spoken.includes('The mountain is higher than the hill.') || spoken.length > 0);
  });
});
```

Imports to add at the top of the file if absent: `GrammarItem`, `GrammarUnit`, `unitSentences`, `allGrammarSpoken` from `../englishGrammar.ts`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts`
Expected: FAIL (`GrammarItem` not exported / `items` ignored).

- [ ] **Step 3: Implement** in `englishGrammar.ts`

Add beside `GrammarPattern`:

```ts
/** A hand-written Grade 9 item: the whole sentence, the words a child must choose, and the distractor it is offered against. */
export interface GrammarItem {
  /** The sub-topic it belongs to (printed on the teacher's form; the sentence's `patternId`). */
  topic: string;
  text: string;
  /** The correct word or phrase, exactly once in `text`. */
  answer: string;
  /** Offered against `answer` in Choose; `text` with `answer` replaced by it is the false twin of True or false. */
  distractor: string;
  /** `form`: the distractor is ungrammatical. `meaning`: it is grammatical but excluded by something in the sentence. */
  kind: 'form' | 'meaning';
}
```

`GrammarUnit`: add `items?: GrammarItem[];` after `patterns`, and note «`patterns` may be empty on a unit of items».

`GrammarSentence`: change the claim line to
`claim: { falseText: string; voiced?: false } | null;` (doc: «`voiced: false`: the twin is ungrammatical, so True or false plays no sound for this sentence») and add after `build`: `/** An authored item's kind; absent on a pattern sentence. */ kind?: 'form' | 'meaning';`

In `unitSentences`, after the `for (const p of unit.patterns)` loop and before `return out;`:

```ts
  for (const it of unit.items ?? []) {
    const tokens = it.text.split(/\s+/).filter(Boolean);
    if (it.answer === it.distractor) throw new Error(`"${it.text}": the distractor differs from the answer or the item is not a choice`);
    const want = it.answer.split(' ').length;
    const at: number[] = [];
    for (let i = 0; i + want <= tokens.length; i += 1) if (spanText(tokens, [i, want]) === it.answer) at.push(i);
    if (at.length > 1) throw new Error(`"${it.answer}" appears more than once in «${it.text}»`);
    const [start, length] = phraseSpan(tokens, it.answer);
    // Punctuation on the last answer word («reading.», «was walking,») moves to the distractor's last word.
    const tail = /[.?!,]+$/.exec(tokens[start + length - 1])?.[0] ?? '';
    const twin = [...tokens.slice(0, start), ...(it.distractor + tail).split(' '), ...tokens.slice(start + length)];
    out.push({
      key: `${unit.lessonId}|${it.topic}|${it.text}`,
      lessonId: unit.lessonId,
      patternId: it.topic,
      text: tokens.join(' '),
      tokens,
      picture: null,
      marker: null,
      choose: { kind: 'phrase', start, length, right: it.answer, wrong: it.distractor },
      falsePicture: null,
      claim: { falseText: twin.join(' '), voiced: false },
      yesNo: null,
      build: buildOf(tokens, cap),
      kind: it.kind,
    });
  }
```

The error text for equal answer/distractor must contain «differs» (the test matches it): the message above does. In `allGrammarSpoken`, change `if (s.claim) out.add(s.claim.falseText);` to `if (s.claim && s.claim.voiced !== false) out.add(s.claim.falseText);`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts` then the whole curriculum suite `pnpm --filter @workspace/curriculum test`.
Expected: PASS; Grades 1–4 and Unit 4 tests unchanged.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm run typecheck
git add lib/curriculum/src/englishGrammar.ts lib/curriculum/src/__tests__/englishGrammarEngine.test.ts
git commit -m "Grade 9 grammar engine: hand-written items, silent True or false twins"
```

---

### Task 2: The thirteen lessons' items

**Files:**
- Create: `lib/curriculum/src/englishGrammarG9Items.ts`
- Modify: `lib/curriculum/src/englishGrammarG9.ts`, `lib/curriculum/src/__tests__/englishGrammarG9.test.ts`
- Test: `lib/curriculum/src/__tests__/englishGrammarG9Items.test.ts` (create)

**Interfaces:**
- Consumes: `GrammarItem` (Task 1).
- Produces: `G9_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[]` (13 entries); `GRAMMAR_UNITS_G9` gains 13 units with `patterns: []`, `reviewedBy: null`; `NOT_COVERED_G9` gains an entry per new lesson.

The sub-topics and counts below are the contract (40 per lesson, 520 in all). Every item satisfies the rule: the distractor is ungrammatical (`form`), or grammatical but excluded by the sentence (`meaning`). The `statement` is the book's «I can» line, verbatim from the data file.

| Lesson id (`kbl-g9-eng-s…`) | Sub-topics (id: count, kind) |
| --- | --- |
| `s1-nccd-u1_l1` | `now`: 14 meaning (a marker forces the continuous: «right now», «at the moment», «Listen!», «Look!»); `stative`: 10 form («knows» / «is knowing»); `third`: 16 form («plays» / «play», «doesn't like» / «doesn't likes») |
| `s1-nccd-u1_l3` | `singular`: 20 form (himself, herself, myself, yourself, itself against a pronoun that disagrees with the subject); `plural`: 20 form (ourselves, yourselves, themselves against a singular pronoun) |
| `s1-nccd-u1_l4` | `some-any`: 14 form; `every-no`: 14 form (including the double negative); `things-places`: 12 form (something/anything/nothing, somewhere/anywhere) |
| `s1-nccd-u2_l1` | `did-questions`: 14 form («see» / «saw» after «did»); `did-negatives`: 12 form; `irregular`: 14 form (a past marker with a base form as distractor) |
| `s1-nccd-u3_l1` | `while`: 14 form («was walking» / «was walk»); `when`: 12 form; `agreement`: 14 form («was» / «were» with the subject) |
| `s1-nccd-u3_l4` | `who`: 10; `which`: 10; `where`: 10; `whose`: 10 — all form («who» / «which» for a thing, «where» / «who» for a place) |
| `s1-nccd-u5_l1` | `prohibition`: 12 meaning («mustn't» / «don't have to», with a clause that excludes the other); `should`: 14 form («should go» / «should to go»); `have-to`: 14 form |
| `s1-nccd-u5_l3` | `should-have`: 14 form; `could-have`: 12 form; `must-cant-have`: 14 form («should have studied» / «should studied») |
| `s2-nccd-u6_l1` | `present-continuous`: 20 form («are meeting» / «are meet»); `going-to`: 20 form («is going to visit» / «is going visit») — form only |
| `s2-nccd-u6_l3` | `going-to-predictions`: 20 form; `will-predictions`: 20 form («will rain» / «will to rain») — form only |
| `s2-nccd-u8_l1` | `ing-verbs`: 20 form («enjoy reading» / «enjoy to read», avoid, mind, finish, keep); `to-verbs`: 20 form («want to learn» / «want learning», hope, decide, plan, learn) |
| `s2-nccd-u9_l1` | `had-form`: 24 form («had finished» / «had finish»); `had-negatives-questions`: 16 form («hadn't seen» / «hadn't see», «Had she left?») |
| `s2-nccd-u10_l4` | `second-conditional`: 24 form («would drive» / «will drive» after «If I had…»); `if-were`: 16 form («If I were you» / «If I am you») |

Authoring rules, every item: 9 words or fewer; everyday school, family, food, travel and technology; no real person's name; one point; what decides the answer is in the sentence; `answer` appears exactly once, as whole words; the distractor is never a form that could fit (so never «walked» for «was walking» after «While», never «is playing» for a habit). Example items per lesson (the rest follow the same shape):

```ts
{ topic: 'now',       text: 'Listen! The baby is crying.',                 answer: 'is crying',     distractor: 'cries',        kind: 'meaning' },
{ topic: 'stative',   text: 'She knows the answer.',                       answer: 'knows',         distractor: 'is knowing',   kind: 'form' },
{ topic: 'plural',    text: 'The girls enjoyed themselves at the party.',  answer: 'themselves',    distractor: 'herself',      kind: 'form' },
{ topic: 'some-any',  text: "There isn't anything in the fridge.",         answer: 'anything',      distractor: 'nothing',      kind: 'form' },
{ topic: 'did-questions', text: 'Did you see the match yesterday?',        answer: 'see',           distractor: 'saw',          kind: 'form' },
{ topic: 'while',     text: 'While I was walking, it started to rain.',    answer: 'was walking',   distractor: 'was walk',     kind: 'form' },
{ topic: 'where',     text: 'This is the town where I was born.',          answer: 'where',         distractor: 'who',          kind: 'form' },
{ topic: 'prohibition', text: "You mustn't run near the pool. It's dangerous.", answer: "mustn't", distractor: "don't have to", kind: 'meaning' },
{ topic: 'should-have', text: 'He should have studied harder.',            answer: 'should have studied', distractor: 'should studied', kind: 'form' },
{ topic: 'present-continuous', text: 'We are meeting my cousins tomorrow.', answer: 'are meeting',  distractor: 'are meet',     kind: 'form' },
{ topic: 'going-to-predictions', text: "Look at those clouds! It's going to rain.", answer: 'going to rain', distractor: 'going rain', kind: 'form' },
{ topic: 'ing-verbs', text: 'She enjoys reading detective stories.',       answer: 'reading',       distractor: 'to read',      kind: 'form' },
{ topic: 'had-form',  text: 'She had finished her homework before her parents arrived.', answer: 'had finished', distractor: 'had finish', kind: 'form' },
{ topic: 'second-conditional', text: 'If I had a car, I would drive to work.', answer: 'would drive',  distractor: 'will drive',   kind: 'form' },
```

- [ ] **Step 1: Write the failing test** `englishGrammarG9Items.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grammarUnit, unitSentences, allGrammarSpoken, offeredGrammar, GRAMMAR_UNITS } from '../englishGrammar.ts';
import { G9_ITEM_LESSONS } from '../englishGrammarG9Items.ts';
import { hubLesson } from '../englishHub.ts';

const dataFile = (sem: 1 | 2) => JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g9_eng_sem${sem}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g9-eng-${s}`;
const LESSONS = ['s1-nccd-u1_l1', 's1-nccd-u1_l3', 's1-nccd-u1_l4', 's1-nccd-u2_l1', 's1-nccd-u3_l1', 's1-nccd-u3_l4', 's1-nccd-u5_l1', 's1-nccd-u5_l3', 's2-nccd-u6_l1', 's2-nccd-u6_l3', 's2-nccd-u8_l1', 's2-nccd-u9_l1', 's2-nccd-u10_l4'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);

describe('Grade 9 authored lessons', () => {
  it('are the thirteen hub lessons, unsigned and offered to nobody', () => {
    assert.deepEqual(G9_ITEM_LESSONS.map(l => l.lessonId), LESSONS);
    for (const id of LESSONS) {
      assert.ok(hubLesson(id), id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it("carry the book's own «I can» statement for that lesson id", () => {
    for (const l of G9_ITEM_LESSONS) {
      const sem = l.lessonId.includes('-s1-') ? 1 : 2;
      const lessonKey = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile(sem).units.flatMap((u: any) => u.lessons).find((x: any) => x.id === lessonKey);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson, 520 in all, each topic at least six', () => {
    let total = 0;
    for (const id of LESSONS) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      total += s.length;
      const by = new Map<string, number>();
      for (const x of s) by.set(x.patternId, (by.get(x.patternId) ?? 0) + 1);
      for (const [topic, n] of by) assert.ok(n >= 6, `${id} ${topic} has ${n}`);
    }
    assert.equal(total, 520);
  });

  it('are buildable, picture-free, unique and never a Yes or No', () => {
    for (const id of LESSONS) {
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
      // A twin is never another true sentence of the lesson.
      for (const x of s) assert.ok(!seen.has(x.claim!.falseText), `twin of «${x.text}» is a true sentence`);
    }
  });

  it('have a distractor that differs and a twin that differs from the sentence', () => {
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
      assert.notEqual(x.claim!.falseText, x.text, x.text);
      assert.equal(x.claim!.voiced, false, x.text);
    }
  });

  it('keep the u6 lessons, form only, and the modal «meaning» items to the prohibition topic', () => {
    for (const id of [L('s2-nccd-u6_l1'), L('s2-nccd-u6_l3')]) assert.ok(sentencesOf(id).every(x => x.kind === 'form'), id);
    for (const x of sentencesOf(L('s1-nccd-u5_l1')).filter(y => y.kind === 'meaning')) assert.equal(x.patternId, 'prohibition');
  });

  it('say twins never reach the audio list while the true sentences do', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS next to the nine Grade 4 units and the two Unit 4 lessons', () => {
    for (const id of LESSONS) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
  });
});
```

Also in `englishGrammarG9.test.ts` update the pilot's pinned totals so they count only the two Unit 4 lessons (the test that asserts «`grammarUnitsForGrade(9)` has 2 units» becomes 15; the pinned 42/80/122 stay, selected by lesson id).

- [ ] **Step 2: Run to verify it fails.** `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG9Items.test.ts` — FAIL (module not found).

- [ ] **Step 3: Author the data.** Create `englishGrammarG9Items.ts`: header comment (what it is, the distractor rule, the spec path, «imports only types from the engine»), then `export const G9_ITEM_LESSONS: { lessonId: string; statement: string; items: GrammarItem[] }[] = [ … ]` with the thirteen entries in the table's order, each `statement` copied verbatim from the data file (read it with `python3 -c` or the JSON itself, never from memory) and 40 items following the sub-topic counts above. In `englishGrammarG9.ts` import it and append:

```ts
...G9_ITEM_LESSONS.map(l => ({ lessonId: l.lessonId, reviewedBy: null, patterns: [], slots: {}, items: l.items })),
```

and add a `NOT_COVERED_G9` entry per new lesson (Arabic, one bullet per item, English phrases inline): every lesson — `لا صور ولا «نعم أم لا»: الجملة تُحدِّد الصيغة، والسؤال عن القواعد لا عن المعلومات.` and `«صح أم خطأ» صامت عمدًا: الجملة الخاطئة غير سليمة لغويًا فلا نُسمعها.`; `u1_l3`: `صفات الشخصية غير مشمولة: لا يمكن أن تكون الشخصية صحيحة أو خاطئة، والدرس يشمل الضمائر الانعكاسية فقط.`; `u5_l1`: `جمل mustn't / don't have to مختارة لجملة تستبعد الخيار الآخر، وتُسمّى «معنى» لا «خطأ».`; `u6_l1` and `u6_l3`: `هذا الدرس يختبر شكل الجملة فقط (are meet، going rain)، لا الاختيار بين going to وwill والمضارع المستمر لأن لكل منها أكثر من إجابة مقبولة.`; and for the lessons of Units 1, 2, 7, 8, 9, 10 that the hub does not carry, see Task 3's form-level note (those lessons have no unit page to hang a note on).

- [ ] **Step 4: Run to verify it passes.** The new test file, then `pnpm --filter @workspace/curriculum test`. Expected PASS; if a count is off, fix the data (not the test).

- [ ] **Step 5: Commit** (two commits are fine: Semester 1 lessons, then Semester 2, each with its tests passing).

```bash
git add lib/curriculum/src/englishGrammarG9Items.ts lib/curriculum/src/englishGrammarG9.ts lib/curriculum/src/__tests__/englishGrammarG9Items.test.ts lib/curriculum/src/__tests__/englishGrammarG9.test.ts
git commit -m "Grade 9 grammar data: thirteen lessons of hand-written items (hidden)"
```

---

### Task 3: The teacher's form

**Files:**
- Modify: `lib/curriculum/src/englishGrammarReview.ts`
- Regenerate: `docs/english-grammar-g9-review.html`, `docs/english-grammar-g9-sheet.md` (`pnpm --filter @workspace/curriculum exec node --experimental-strip-types scripts/grammar-sheet.ts` — the same command the Grade 4 plan used)
- Test: `lib/curriculum/src/__tests__/englishGrammarG9Items.test.ts` (append)

**Interfaces:**
- Consumes: `G9_ITEM_LESSONS`, `GrammarSentence['kind']`, `NOT_COVERED_G9`.
- Produces: `renderUnit` renders a unit with `items` as an authored page; `GRADE_COPY[9]` mentions the new lessons; a form-level not-covered block for the six topics the hub does not offer.

- [ ] **Step 1: Failing tests (append)**

```ts
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { readFileSync as read } from 'node:fs';

describe('the Grade 9 teacher form for authored lessons', () => {
  const html = renderGrammarReviewHtml(9);
  it('equals the committed form and lists every sentence once', () => {
    assert.equal(read(new URL('../../../../docs/english-grammar-g9-review.html', import.meta.url), 'utf8'), html);
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      const needle = `>${x.text.replace(/&/g, '&amp;').replace(/'/g, '&#39;')}<`;
      assert.ok(html.includes(x.text.replace(/'/g, '&#39;')) || html.includes(x.text), x.text);
      assert.equal(html.split(`dir="ltr">${x.text}`).length - 1 <= 1, true, needle);
    }
  });
  it("prints each lesson's book statement and the first check, the kind of every item and the not-covered notes", () => {
    for (const l of G9_ITEM_LESSONS) assert.ok(html.includes(l.statement), l.lessonId);
    assert.ok(html.includes('تأكدوا أولًا'), 'book-page check');
    assert.ok(html.includes('form') && html.includes('meaning'));
    assert.ok(html.includes('الكلمات خارج قوائم المفردات'), 'words outside the hub lists');
    for (const word of ['used to', 'present perfect', 'first conditional', 'reported speech', 'passive']) assert.ok(html.toLowerCase().includes(word), word);
  });
  it('leaves the Unit 4 pages and the Grade 1–4 forms unchanged', () => {
    assert.ok(html.includes('صفحة البيانات'));
    // The older forms are pinned by their own tests (englishGrammarG4.test.ts and the Grade 1–3 equivalents).
  });
});
```

- [ ] **Step 2: Run to verify it fails** (the committed form lacks the new pages).

- [ ] **Step 3: Implement.** In `englishGrammarReview.ts`:
  - `renderUnit`: branch on `u.items?.length`. Authored page columns: `#`, `الجملة`, `«اختر الكلمة»` (correct answer then distractor, `chooseCell`), `«صح أم خطأ»` (the twin, `falseCell` — already prints `claim.falseText`), `النوع` (`form` / `meaning` as `<span class="kind kind-form">`), `✓`, `ملاحظات`. No picture and no Yes or No column. Group rows by `patternId` with a topic sub-header row (`<tr class="topic-row"><th colspan="7" dir="ltr">${topic}</th></tr>`). Replace the `patterns` chips with the topic ids.
  - Under the unit header add the first check: `<p class="unit-note"><b>تأكدوا أولًا:</b> هل يطابق هذا الدرس صفحة الكتاب؟ قول الكتاب: <span dir="ltr">«${statement}»</span></p>`, with `statement` from `G9_ITEM_LESSONS`.
  - Under it print `الكلمات خارج قوائم المفردات`: the lesson's words (lower-cased, stripped of `.,?!`) found neither in `allHubWords()` nor in a `FUNCTION_WORDS` const (pronouns, articles, auxiliaries, be/have/do, common prepositions and conjunctions, written out in the file), comma-separated, or `لا شيء` when empty.
  - A small `.kind-form`/`.kind-meaning` CSS rule in the existing style block (two muted colours, same weight).
  - Form-level block (once, in the Grade 9 intro, after the legend): `الدروس التي لا يحملها المركز` listing used to (U2), the two present perfects (U7), the first conditional (U8), reported speech (U9) and the passive (U10), with the reason (the hub only offers a lesson with four or more words), through `notCoveredList`.
  - `GRADE_COPY[9]`: lead names the new lessons and the two kinds; `checks` gains «هل أي من الخيارات الخاطئة مقبول في صفك؟» and «هل رقم الدرس يطابق صفحة الكتاب؟».
- [ ] **Step 4:** regenerate the documents with the `grammar-sheet` command, then run `pnpm --filter @workspace/curriculum test`. Expected PASS, and `git diff --stat docs/` shows only the Grade 9 files changed (Grades 1–4 byte-identical).
- [ ] **Step 5: Look at it.** Open the generated form in Chromium at 390 px and A4 (the earlier `g9form.mjs` script is the model): the authored page has no horizontal scroll; the kind and the twin are readable.
- [ ] **Step 6: Commit** `Grade 9 grammar: the teacher's form for the thirteen authored lessons`.

---

### Task 4: True or false is silent on authored items

**Files:**
- Modify: `artifacts/mobile/services/englishHub/games.ts`, `artifacts/mobile/components/englishHub/GrammarActivities.tsx`
- Test: `artifacts/mobile/services/__tests__/englishGrammarG9ItemGames.test.ts` (create)

**Interfaces:**
- Produces: `isSilentTrueFalse(s: GrammarSentence): boolean` — `s.claim?.voiced === false`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allGrammarSpoken, grammarUnit, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import { buildChooseRound, buildSentenceRound, buildTrueFalseRound, buildYesNoRound, grammarActivityAvailable, isSentenceBuilt, isSilentTrueFalse } from '../englishHub/games.ts';

const LESSONS = [/* the thirteen ids, as in the curriculum test */];
const SEEDS = [1, 2, 3, 4, 5, 6];
const sentences = (id: string) => unitSentences(grammarUnit(id)!);

describe('Grade 9 authored lessons in the app', () => {
  it('offer Choose, Build and True or false and never Yes or No', () => {
    for (const id of LESSONS) {
      const s = sentences(id);
      assert.equal(grammarActivityAvailable('grammar-choose', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-build', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-true', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-yesno', s), false, id);
    }
  });
  it('Choose: the right option is the answer and differs from the distractor', () => {
    for (const id of LESSONS) for (const seed of SEEDS) for (const q of buildChooseRound(sentences(id), makeRng(seed))) {
      assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
      assert.notEqual(q.options[0], q.options[1], id);
    }
  });
  it('Build: the tiles are the whole sentence and in order are judged right', () => {
    for (const id of LESSONS) for (const seed of SEEDS) for (const q of buildSentenceRound(sentences(id), makeRng(seed))) {
      assert.equal(q.prompt, undefined === q.prompt ? undefined : null);
      assert.equal(isSentenceBuilt(q.sentence.build!.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
    }
  });
  it('True or false: the sentence or its twin, no picture, half true, silent', () => {
    for (const id of LESSONS) for (const seed of SEEDS) {
      const round = buildTrueFalseRound(sentences(id), makeRng(seed));
      assert.ok(round.length >= 6, id);
      for (const q of round) {
        assert.equal(q.pictureWord, null);
        assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
        assert.equal(isSilentTrueFalse(q.sentence), true, q.text);
      }
      assert.equal(round.filter(q => q.isTrue).length, round.length / 2, id);
    }
  });
  it('a twin is not in the audio list, and a Unit 4 claim stays silent-free', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of LESSONS) for (const x of sentences(id)) assert.ok(spoken.has(x.text) && (!spoken.has(x.claim!.falseText) || sentences(id).some(y => y.text === x.claim!.falseText)));
    const unit4 = unitSentences(grammarUnit('kbl-g9-eng-s1-nccd-u4_l1')!);
    assert.equal(isSilentTrueFalse(unit4.find(x => x.claim)!), false);
  });
});
```

Replace the placeholder `LESSONS` with the thirteen literal ids and delete the odd `q.prompt` line, asserting `q.prompt` is `null` or `undefined` via `assert.ok(!q.prompt)`.

- [ ] **Step 2: Run to verify it fails** — `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG9ItemGames.test.ts` (FAIL: `isSilentTrueFalse` missing).

- [ ] **Step 3: Implement.** In `games.ts` (beside the other round helpers): `export const isSilentTrueFalse = (s: GrammarSentence): boolean => s.claim?.voiced === false;`. In `GrammarActivities.tsx`, `TrueFalse`:
  - `const silent = isSilentTrueFalse(q.sentence);`
  - `next()`: `if (!isSilentTrueFalse(round[i + 1].sentence)) void playWord(round[i + 1].text);`
  - `{picked === null && !silent ? <HearButton word={q.text} /> : null}`
  - `<Feedback … sentence={silent ? '' : q.text} />`, and in `Feedback`, `{sentence ? <HearButton word={sentence} /> : null}` (other callers always pass a non-empty sentence, so they are unchanged).
- [ ] **Step 4: Run to verify it passes**; then `pnpm run typecheck`.
- [ ] **Step 5: Commit** `Grade 9 grammar: True or false is silent on hand-written items`.

---

### Task 5: Verify, document, push

- [ ] **Step 1:** `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; the full mobile suite in the background (`cd artifacts/mobile && pnpm test > <scratchpad>/mobile-g9items.log 2>&1 &`), not touching sign-offs while it runs. Read `# fail 0` from the log.
- [ ] **Step 2: Browser check at 390 px, Arabic and English.** Set `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-23' }` on the thirteen units' generated entries (in `englishGrammarG9.ts`, one place), `pnpm run build:web` with `EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true`, serve with `WEB_PORT=8098 node e2e/serve.mjs`, and drive with a Playwright script (the earlier `g9b.mjs` is the model): each of the thirteen lessons offers Choose, Build and True or false and no Yes or No; Choose shows the answer against the distractor; Build tiles are the whole sentence; True or false shows a sentence with no speaker button before or after answering; no horizontal scroll; an unsigned lesson shows nothing. Then restore: kill the server by pid, `git checkout lib/curriculum/src/englishGrammarG9.ts` (after committing the real data first), confirm `git status` is clean and `grep -c "LOCAL CHECK"` is 0.
- [ ] **Step 3: Docs.** Add the entry «Grade 9 grammar, thirteen lessons — built, shown to nobody yet» at the top of `docs/status-log.md` (what was built, the rule for distractors, the silent True or false, what was verified and not, the six topics left out, the switch-on steps), the index line at the top of `STATUS.md`'s «Recent changes», and set the spec's status to implemented (with how the build differs, if it does).
- [ ] **Step 4: Push, PR.** `git push -u origin ccr-d9db5f6c-mgwkuo`; update PR #1204's title and body (summary, verification, not-done list); merge `main` if conflicted (no rebase, no force-push); keep CI green.

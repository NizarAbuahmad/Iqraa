# English corner: Grade 9 grammar pilot (Unit 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give two Grade 9 hub lessons (S1 U4 `u4_l1` comparatives and superlatives, `u4_l3` quantifiers) grammar activities, hidden until a teacher signs off.

**Architecture:** The Grade 4 engine as it stands, plus eight `ADJECTIVE_FORMS` entries and a `claim` swap that accepts more than one pair. Data in a new `englishGrammarG9.ts`; a Grade 9 teacher form with a data page. No pictures anywhere.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script, Expo web for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-pilot-design.md`

## Global Constraints

- Both Grade 9 units ship `reviewedBy: null`; no sign-off is ever committed.
- The Grade 1–4 grammar sheets and forms and all four reading forms stay byte-identical (tests pin them).
- Build the sentence keeps `buildCap` = 9; every sentence must be buildable (whole, or an answer half).
- A Choose option is always a real form. Slot words come from this lesson, an earlier Grade 9 lesson, or an earlier grade; row-only free text lives in slots named in the test's `FREE_SLOTS`.
- Arabic not-covered notes: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`; push only to `ccr-d9db5f6c-mgwkuo`; run `pnpm run typecheck` before committing a task; never commit a sign-off.
- Deviations from the spec, decided while planning: the quantifier lesson has **five** patterns per class (the spec's table lists four; the fifth is «Are there many {foods}?» / «Is there much {food}?»), which is what makes the designed ~80 sentences; the data page is built in `englishGrammarReview.ts` (as Grade 4's was).

## File Structure

- Modify `lib/curriculum/src/englishGrammar.ts`: eight `ADJECTIVE_FORMS` entries; `claim.swap` accepts a list of pairs; import `GRAMMAR_UNITS_G9`.
- Create `lib/curriculum/src/englishGrammarG9.ts`: `GRAMMAR_UNITS_G9`, `NOT_COVERED_G9`, `G9_TABLES`.
- Modify `lib/curriculum/src/englishGrammarReview.ts` and `scripts/grammar-sheet.ts`; generate `docs/english-grammar-g9-sheet.md` and `-review.html`.
- Tests: `englishGrammarEngine.test.ts` (append), `englishGrammarG9.test.ts` (create), `artifacts/mobile/services/__tests__/englishGrammarG9Games.test.ts` (create).
- Docs: top of `docs/status-log.md`, `STATUS.md` index line, spec status.

---

### Task 1: Adjective entries and a multi-pair `claim` swap

**Files:** Modify `englishGrammar.ts`; Test `englishGrammarEngine.test.ts`.

**Interfaces:** Produces eight `ADJECTIVE_FORMS` entries; `GrammarPattern.claim?: { swap: [string, string] | [string, string][] }` (a single pair behaves exactly as today).

- [ ] **Step 1: Write the failing test** — append to `englishGrammarEngine.test.ts`:

```ts
test('the Grade 9 adjectives have their forms', () => {
  for (const [adj, c, s] of [
    ['cheap', 'cheaper', 'cheapest'], ['healthy', 'healthier', 'healthiest'], ['tasty', 'tastier', 'tastiest'],
    ['expensive', 'more expensive', 'most expensive'], ['fattening', 'more fattening', 'most fattening'],
    ['filling', 'more filling', 'most filling'], ['nutritious', 'more nutritious', 'most nutritious'],
    ['popular', 'more popular', 'most popular'],
  ] as const) {
    assert.equal(comparativeOf(adj), c, adj);
    assert.equal(superlativeOf(adj), s, adj);
  }
});

test('a claim can swap two pairs of slots, so a capitalised first word swaps with its lower-case twin', () => {
  const [s] = unitSentences(FORM_UNIT([{
    id: 'c', text: '{bigC} are {cmp:adj} than {small}.',
    rows: [{ bigC: 'Carrots', big: 'carrots', smallC: 'Doughnuts', small: 'doughnuts', adj: 'healthy' }],
    claim: { swap: [['bigC', 'smallC'], ['big', 'small']] },
  }]));
  assert.equal(s.text, 'Carrots are healthier than doughnuts.');
  assert.deepEqual(s.claim, { falseText: 'Doughnuts are healthier than carrots.' });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts` → FAIL (`no comparative for «cheap»`; the swap throws).
- [ ] **Step 3: Implement** in `englishGrammar.ts`: add to `ADJECTIVE_FORMS`
  `cheap: ['cheaper', 'cheapest'], healthy: ['healthier', 'healthiest'], tasty: ['tastier', 'tastiest'], expensive: ['more expensive', 'most expensive'], fattening: ['more fattening', 'most fattening'], filling: ['more filling', 'most filling'], nutritious: ['more nutritious', 'most nutritious'], popular: ['more popular', 'most popular']`;
  change the pattern type to `claim?: { swap: [string, string] | [string, string][] }` and the sentence code to
  ```ts
  const claim = p.claim
    ? (() => {
        const pairs = (Array.isArray(p.claim.swap[0]) ? p.claim.swap : [p.claim.swap]) as [string, string][];
        const swapped = { ...fill };
        for (const [a, b] of pairs) { swapped[a] = fill[b]; swapped[b] = fill[a]; }
        return { falseText: realise(p.text, swapped).tokens.join(' ') };
      })()
    : null;
  ```
  (update the doc comment: several pairs may be swapped).
- [ ] **Step 4: Run → PASS**; `pnpm --filter @workspace/curriculum test` (Grade 1–4 output unchanged).
- [ ] **Step 5: Typecheck and commit** — `Grade 9 grammar engine: adjective forms and a multi-pair claim swap`.

---

### Task 2: Unit 4 data — comparatives (`u4_l1`) and quantifiers (`u4_l3`)

**Files:** Create `englishGrammarG9.ts`; Modify `englishGrammar.ts` (import and merge); Test `englishGrammarG9.test.ts`.

**Interfaces:** Produces `GRAMMAR_UNITS_G9` (two units), `NOT_COVERED_G9`, `G9_TABLES` (the rows the form's data page prints).

Data, written into the file as below:

```ts
const L = (unit: number, lesson: number) => `kbl-g9-eng-s1-nccd-u${unit}_l${lesson}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Plainly true comparisons. Both foods share a class (plural or uncountable), so the verb agrees in the swapped twin. Every pair is on the teacher's form. */
const PLURAL_PAIRS = [
  { big: 'carrots', small: 'doughnuts', adj: 'healthy' }, { big: 'cucumbers', small: 'muffins', adj: 'healthy' },
  { big: 'doughnuts', small: 'cucumbers', adj: 'fattening' }, { big: 'croissants', small: 'melons', adj: 'fattening' },
  { big: 'carrots', small: 'croissants', adj: 'nutritious' },
];
const MASS_PAIRS = [
  { big: 'salmon', small: 'bread', adj: 'expensive' }, { big: 'honey', small: 'sugar', adj: 'expensive' },
  { big: 'bread', small: 'salmon', adj: 'cheap' }, { big: 'sugar', small: 'honey', adj: 'cheap' },
  { big: 'porridge', small: 'water', adj: 'filling' },
];
const withCaps = (rows: { big: string; small: string; adj: string }[]) =>
  rows.map(r => ({ ...r, bigC: cap(r.big), smallC: cap(r.small) }));
const swapped = (rows: { big: string; small: string; adj: string }[]) => rows.map(r => ({ big: r.small, small: r.big, adj: r.adj }));
const SWAP = [['bigC', 'smallC'], ['big', 'small']] as [string, string][];
const FACT = (be: 'Is' | 'Are') => ({
  question: `${be} {big} {cmp:adj} than {small}?`,
  yes: be === 'Is' ? 'Yes, it is.' : 'Yes, they are.',
  no: be === 'Is' ? "No, it isn't." : "No, they aren't.",
});
/** Superlatives: rows are claims about «here», not facts a child is asked to judge. */
const SUPER_ROWS = [
  { x: 'Salmon', adj: 'expensive', n: 'dish', where: 'on the menu' }, { x: 'Water', adj: 'cheap', n: 'drink', where: 'in the café' },
  { x: 'The doughnut', adj: 'fattening', n: 'snack', where: 'in the shop' }, { x: 'Porridge', adj: 'filling', n: 'breakfast', where: 'at the café' },
  { x: 'The muffin', adj: 'popular', n: 'cake', where: 'in the shop' }, { x: 'The salad', adj: 'healthy', n: 'dish', where: 'on the menu' },
];
/** Opinions: Choose and Build only, never judged. */
const OPINION_ROWS = [
  { a: 'Pancakes', be: 'are', adj: 'tasty', b: 'porridge' }, { a: 'Muffins', be: 'are', adj: 'popular', b: 'croissants' },
  { a: 'Doughnuts', be: 'are', adj: 'tasty', b: 'cucumbers' }, { a: 'Jam', be: 'is', adj: 'popular', b: 'honey' },
  { a: 'Salmon', be: 'is', adj: 'tasty', b: 'rice' }, { a: 'Grapes', be: 'are', adj: 'popular', b: 'melons' },
];
/** Hand-classed foods for the quantifiers: plurals are formed by {s:} from the singular hub word. */
const FOOD_COUNT = ['grapes', 'olive', 'mushroom', 'pancake', 'doughnut', 'croissant', 'muffin', 'carrots'];
const FOOD_MASS = ['cream', 'honey', 'jam', 'salt', 'sugar', 'porridge', 'milk', 'rice'];
const phrase = (right: string, wrong: string) => ({ kind: 'phrase' as const, right, wrong });
```

Units: `u4_l1` with patterns `cmppl` (`'{bigC} are {cmp:adj} than {small}.'`, rows `withCaps(PLURAL_PAIRS)`, `claim: { swap: SWAP }`, `choose: { kind: 'form', slot: 'adj', wrong: 'base' }`), `cmpmass` (`is`, `withCaps(MASS_PAIRS)`), `ypl` (`'Are {big} {cmp:adj} than {small}? Yes, they are.'`, rows `PLURAL_PAIRS`, `yesNo: { kind: 'fact', ...FACT('Are'), answer: true }`), `ymass` (`Is`), `npl` (`"Are {big} {cmp:adj} than {small}? No, they aren't."`, rows `swapped(PLURAL_PAIRS)`, `answer: false`), `nmass`, `sup` (`'{v:x} is the {sup:adj} {v:n} {v:where}.'`, rows `SUPER_ROWS`, `choose: { kind: 'form', slot: 'adj', wrong: 'comparative' }`), `opinion` (`'{a} {be} {cmp:adj} than {b}.'`, rows `OPINION_ROWS`, `choose: { kind: 'form', slot: 'adj', wrong: 'base' }`). `u4_l3` with patterns `howmany` (`'How many {s:pl} are there?'`, `phrase('many', 'much')`), `howmuch` (`'How much {mass} is there?'`, `phrase('much', 'many')`), `notmany` (`"There aren't many {s:pl}."`), `notmuch` (`"There isn't much {mass}."`), `toomany` (`'There are too many {s:pl}.'`), `toomuch` (`"There's too much {mass}."`), `qmany` (`'Are there many {s:pl}?'`), `qmuch` (`'Is there much {mass}?'`), `afew` (`"I'd like a few {s:pl}, please."`, `phrase('a few', 'a little')`), `alittle` (`"I'd like a little {mass}, please."`, `phrase('a little', 'a few')`); `slots: { pl: FOOD_COUNT, mass: FOOD_MASS }`. `G9_TABLES = { plural: PLURAL_PAIRS, mass: MASS_PAIRS, superRows: SUPER_ROWS, opinionRows: OPINION_ROWS, foodCount: FOOD_COUNT, foodMass: FOOD_MASS }`. `NOT_COVERED_G9` (Arabic, form-safe): `u4_l1` — no pictures; comparisons judged only from the written pairs; opinion rows never judged; the Choose options are real forms; `u4_l3` — no pictures; the foods are classed by hand (the data page); «some», «any» and «enough» are not covered.

- [ ] **Step 1: Write the failing test** — create `englishGrammarG9.test.ts` asserting: `grammarUnitsForGrade(9)` is the two lessons, `reviewedBy: null`, `offeredGrammar` null; every sentence buildable; no unit prints a sentence twice; slot words (and row words outside `FREE_SLOTS = new Set(['big', 'small', 'bigC', 'smallC', 'x', 'n', 'where', 'a', 'b', 'be'])`) come from this lesson, an earlier Grade 9 lesson, or an earlier grade (hubs of Grades 1–4); every `cmp*` sentence has a claim whose twin is not itself a true row and whose verb agreement is unchanged («Doughnuts are healthier than carrots.»); `ypl`/`ymass` are `fact` answer true and `npl`/`nmass` answer false, none with a picture; every food is in exactly one class; the Choose pairs (`healthier`/`healthy`, `more expensive`/`expensive`, `the cheapest`/`the cheaper`, `many`/`much`, `a few`/`a little`) read as designed; every adjective used is in `ADJECTIVE_FORMS`; the opinion rows carry no claim; the per-lesson counts and the total (pinned in Step 4); no picture anywhere.
- [ ] **Step 2: Run → FAIL** (module missing).
- [ ] **Step 3: Implement** — create the file with the data above, header comment pointing to the spec; add `import { GRAMMAR_UNITS_G9 } from './englishGrammarG9.ts'` to `englishGrammar.ts` and merge it into `GRAMMAR_UNITS`.
- [ ] **Step 4: Run, read the measured counts, pin them in the test, run again → PASS**; `pnpm --filter @workspace/curriculum test` (change the existing «no Grade N units» assertion only if it names Grade 9).
- [ ] **Step 5: Typecheck and commit** — `Grade 9 grammar data: S1 U4 comparatives and quantifiers (hidden)`.

---

### Task 3: The Grade 9 form, data page and sheet

**Files:** Modify `englishGrammarReview.ts`, `scripts/grammar-sheet.ts`; Generate `docs/english-grammar-g9-sheet.md`, `-review.html`; Test `englishGrammarG9.test.ts` (append).

- [ ] **Step 1: Failing tests** — append: the Grade 9 form lists every sentence once (`<td class="sentence" dir="ltr">` count equals the total), has 2 `<section class="unit"` pages and one `<section class="data"` with 4 `<table class="data-table"` (ranking pairs with their twins, adjective forms, food classes, opinion rows), prints `Doughnuts are healthier than carrots.` in the True or false cell and a picture-free Yes or No row, shows the note for each lesson; the committed Grade 9 form and sheet equal their generators; Grades 1–4 sheets and forms and the four reading forms equal theirs.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** in `englishGrammarReview.ts`: import `G9_TABLES`, `NOT_COVERED_G9`; add `9: NOT_COVERED_G9` to `NOT_COVERED`; add `GRADE_COPY[9]` (title «مراجعة قواعد الصف التاسع», eyebrow, a lead saying this is the first Grade 9 unit, that the sentences are written by us because the book gives objectives only, that comparisons and food classes are on the data page, and the count; the four activities; checks naming the ranking pairs, the Choose forms, the food classes, whether context-free sentences are acceptable, and the opinion rows; `extraCss: YESNO_CSS` plus the data-page CSS Grade 4 uses); factor Grade 4's `data page` rendering helper so both grades share `dataTable`; add `gradeNineDataPage()` and render it for grade 9; loop the script over `[1, 2, 3, 4, 9]`. Grade 1–4 output must not change: change only what Grade 9 adds.
- [ ] **Step 4: Generate** — `pnpm --filter @workspace/curriculum run grammar-sheet`; `git status` shows only the two new Grade 9 files and **no change** to any other doc; the suite is green.
- [ ] **Step 5: Typecheck and commit** — `Grade 9 grammar: the teacher's printable form, data page and sheet`.

---

### Task 4: The round builders on Grade 9

**Files:** Test `artifacts/mobile/services/__tests__/englishGrammarG9Games.test.ts`; `games.ts` only if a test shows a real defect.

- [ ] **Step 1: Write the test** over `grammarUnitsForGrade(9)`: the activity matrix (`u4_l1`: Choose, Build, True or false, Yes or No; `u4_l3`: Choose and Build, no True or false, no Yes or No); Choose's right option is the blanked word and the two options differ; Build's tiles are the build tokens, at most nine, judged right in order; a True or false round on `u4_l1` is at most 8 items, half true, with no picture word, a true item showing its sentence and a false item its swapped twin; a Yes or No round on `u4_l1` is picture-free `fact` items, half yes, each question once; every sentence, prompt, twin and exchange is in `allGrammarSpoken()`.
- [ ] **Step 2: Run** (`cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG9Games.test.ts`) → PASS without changing `games.ts`.
- [ ] **Step 3: Typecheck (root) and commit** — `Grade 9 grammar: round builder tests on the Unit 4 lessons`.

---

### Task 5: Browser check, docs, PR

- [ ] **Step 1: Full verification** — `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test` (about 5 minutes, in the background; do not edit sign-offs until it finishes).
- [ ] **Step 2: Browser check** (390 px, Arabic and English). With the suite finished, set a local `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-23' }` on both units in `englishGrammarG9.ts` (working tree only), build the web bundle, serve with `WEB_PORT=8098 node e2e/serve.mjs` (kill by PID) and drive: both Grade 9 lessons show their cards (`u4_l1` all four, `u4_l3` Choose and Build); a comparison True or false (true sentence and swapped twin, no picture); a Yes or No (no picture, half yes); a quantifier Choose («many / much»); no horizontal scroll; an unsigned Grade 9 lesson shows no grammar cards. Then **restore** the file with `git checkout`, confirm `grep -c "LOCAL CHECK"` is 0 and `git status` is clean.
- [ ] **Step 3: Docs** — a «Grade 9 grammar pilot (Unit 4) — built, shown to nobody yet» section at the **top** of `docs/status-log.md`, one index line in `STATUS.md`, the spec's status set to implemented (with its quantifier table aligned: five patterns per class).
- [ ] **Step 4: Commit, push to `ccr-d9db5f6c-mgwkuo`, update the PR body** of #1171 (it stays a draft; do not mark ready or merge), merge `main` if it conflicts (no rebase or force-push), and check CI.

/**
 * Grade 4 grammar sentences (spec: docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G4 = hubLessonsForGrade(4);
const UNITS = grammarUnitsForGrade(4);
const L = (sem: number, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;
const order = new Map(G4.map((l, i) => [l.id, i]));
/** Slots that hold free text from the book's examples or a written row, not hub words: checked on the teacher's form instead. */
const FREE_SLOTS = new Set(['time', 'when', 'subj', 'obj', 'big', 'small', 'where', 'n', 'a', 'b', 'rule', 'cont', 'adj', 'colour', 'verb', 'day']);

test('every Grade 4 lesson that has data has a unit, all unsigned, none offered', () => {
  assert.equal(G4.length, 9);
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
    assert.ok(grammarUnit(u.lessonId));
  }
  assert.deepEqual(UNITS.map(u => u.lessonId), G4.map(l => l.id).slice(0, UNITS.length));
});

test('slot words come from this lesson, an earlier Grade 4 lesson, or an earlier grade; rows too, bar the free-text slots', () => {
  const earlier = new Set(hubLessonsForGrade(1).concat(hubLessonsForGrade(2), hubLessonsForGrade(3)).flatMap(l => l.words.map(w => w.en)));
  for (const u of UNITS) {
    const allowed = new Set([...earlier, ...G4.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en))]);
    for (const [slot, words] of Object.entries(u.slots)) for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    for (const p of u.patterns) {
      for (const row of p.rows ?? []) {
        for (const [slot, w] of Object.entries(row)) if (!FREE_SLOTS.has(slot)) assert.ok(allowed.has(w), `${u.lessonId} ${p.id} row ${slot}: ${w}`);
      }
    }
  }
});

test('every sentence can be built, and none is dropped for length', () => {
  for (const u of UNITS) for (const s of unitSentences(u)) assert.ok(s.build, `${s.text} (${s.tokens.length} tiles)`);
});

test('no unit prints one sentence twice', () => {
  for (const u of UNITS) {
    const texts = unitSentences(u).map(s => s.text);
    assert.equal(new Set(texts).size, texts.length, u.lessonId);
  }
});

test('pictures only carry a word that has one', () => {
  for (const u of UNITS) for (const s of unitSentences(u)) if (s.picture) assert.ok(wordPicture(s.picture.word), s.text);
});

test('S1 U1: flags for «from», match Yes or No on «Are you from…?», nationalities by row', () => {
  const s = unitSentences(grammarUnit(L(1, 1))!);
  const byId = (id: string) => s.filter(x => x.patternId === id);
  assert.equal(byId('from').length, 6);
  assert.ok(byId('from').every(x => x.picture && x.choose?.kind === 'slot'));
  assert.ok(byId('isfrom').every(x => x.yesNo?.kind === 'match'));
  assert.deepEqual(byId('nat').map(x => x.text), ["I'm Egyptian.", "I'm Jordanian.", "I'm Qatari.", "I'm Spanish.", "I'm British.", "I'm Emirati."]);
  const long = s.find(x => x.text === "Where are you from? I'm from the United Arab Emirates.")!;
  assert.equal(long.build!.prompt, 'Where are you from?');
});

test('S1 U2 has no pictures; its Choose asks on / at, a verb form and do / does', () => {
  const s = unitSentences(grammarUnit(L(1, 2))!);
  assert.ok(s.every(x => x.picture === null && x.yesNo === null));
  assert.deepEqual(s.find(x => x.patternId === 'timetable')!.choose && [s[0].choose!.right, s[0].choose!.wrong], ['on', 'at']);
  const he = s.find(x => x.text === 'He often plays tennis.')!;
  assert.deepEqual([he.choose!.right, he.choose!.wrong], ['plays', 'play']);
});

test('S1 U3 classes the foods: a countable plural takes are, an uncountable takes is; milkshake is left out', () => {
  const s = unitSentences(grammarUnit(L(1, 3))!);
  assert.ok(!s.some(x => /milkshake/.test(x.text)));
  assert.ok(s.some(x => x.text === "There's a lot of salad."));
  assert.ok(s.some(x => x.text === 'There are a lot of cupcakes.'));
  assert.ok(!s.some(x => x.text === "There's a lot of cupcakes." || x.text === 'There are a lot of salad.'));
  const little = s.find(x => x.text === "There's a little salad.")!;
  assert.deepEqual([little.choose!.right, little.choose!.wrong], ['a little', 'a few']);
  for (const x of s.filter(y => y.yesNo)) assert.equal(x.yesNo!.hint, 'there');
});

test('the generator produces the designed sentences: 454 in all', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [
    [L(1, 1), 60], [L(1, 2), 42], [L(1, 3), 56], [L(1, 4), 29], [L(1, 5), 42], [L(2, 7), 59], [L(2, 8), 104], [L(2, 9), 32], [L(2, 10), 30],
  ]);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 454);
});

test('S1 U4: comparisons come from written rows; the swapped twin of a true row is never a true row', async () => {
  const { ADJECTIVE_FORMS } = await import('../englishGrammar.ts');
  const unit = grammarUnit(L(1, 4))!;
  const s = unitSentences(unit);
  assert.ok(s.every(x => x.picture === null));
  const cmp = s.filter(x => x.patternId === 'cmp');
  assert.ok(cmp.length >= 5);
  assert.ok(cmp.every(x => x.claim && x.claim.falseText !== x.text), 'every comparison has a false twin');
  const trueTexts = new Set(cmp.map(x => x.text));
  for (const x of cmp) assert.ok(!trueTexts.has(x.claim!.falseText), `${x.text}: the twin is also a true row`);
  assert.deepEqual(cmp[0].claim, { falseText: 'The hill is higher than the mountain.' });
  // Yes and No questions are the same rows, true and swapped.
  const yes = s.filter(x => x.patternId === 'cmpy');
  const no = s.filter(x => x.patternId === 'cmpn');
  assert.ok(yes.every(x => x.yesNo!.kind === 'fact' && x.yesNo!.answer && x.picture === null));
  assert.ok(no.every(x => x.yesNo!.kind === 'fact' && !x.yesNo!.answer && x.picture === null));
  assert.equal(yes.length, no.length);
  const noQuestions = new Set(no.map(x => x.yesNo!.question));
  for (const x of yes) assert.ok(!noQuestions.has(x.yesNo!.question), `${x.yesNo!.question} is asked as both yes and no`);
  // Every adjective compared is in the table; every form Choose offers two different real forms.
  for (const u of [unit]) for (const p of u.patterns) for (const row of p.rows ?? []) if (row.adj) assert.ok(ADJECTIVE_FORMS[row.adj], row.adj);
  for (const x of s.filter(y => y.choose?.kind === 'form')) assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
  const sup = s.find(x => x.text === 'This is the deepest lake in Jordan.')!;
  assert.deepEqual([sup.choose!.right, sup.choose!.wrong], ['deepest', 'deeper']);
  const long = s.find(x => x.text === 'Swimming is more exciting than walking.')!;
  assert.deepEqual([long.choose!.right, long.choose!.wrong, long.choose!.length], ['more exciting', 'exciting', 2]);
});

test('S1 U5: jobs by picture, must / mustn\'t from written rules, clothes with colours', () => {
  const s = unitSentences(grammarUnit(L(1, 5))!);
  const by = (id: string) => s.filter(x => x.patternId === id);
  assert.equal(by('hejob').length, 11);
  assert.ok(by('hejob').every(x => x.marker === 'boy') && by('shejob').every(x => x.marker === 'girl'));
  const must = by('must').map(x => x.text);
  const mustnt = by('mustnt').map(x => x.text);
  assert.deepEqual(must, ['You must arrive on time.', 'You must be quiet in class.', 'You must follow the rules.', 'You must put litter in the bin.']);
  assert.deepEqual(mustnt, ["You mustn't be late.", "You mustn't break the rules.", "You mustn't drop litter.", "You mustn't shout in class."]);
  assert.deepEqual([by('must')[0].choose!.right, by('must')[0].choose!.wrong], ['must', "mustn't"]);
  const coat = by('wear').find(x => x.text === "I'm wearing a green coat.")!;
  assert.equal(coat.picture!.word, 'coat');
  assert.equal(by('wear').find(x => /jacket/.test(x.text))!.picture, null, 'jacket has no picture');
  assert.ok(by('wearq').filter(x => x.picture).every(x => x.yesNo!.kind === 'match'));
});

test('picture-free Yes or No facts exist only on S1 U4', () => {
  for (const u of UNITS) {
    const free = unitSentences(u).filter(x => x.yesNo && !x.picture);
    if (u.lessonId === L(1, 4)) assert.ok(free.length > 0);
    else assert.equal(free.length, 0, u.lessonId);
  }
});

test('all nine Grade 4 hub lessons have a unit, all unsigned, none offered', () => {
  assert.equal(UNITS.length, 9);
  assert.deepEqual(UNITS.map(u => u.lessonId), G4.map(l => l.id));
  for (const u of UNITS) assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
});

test('S2 U7: can / can\'t and manner adverbs, no pictures; Choose only where the sentence gives evidence', () => {
  const s = unitSentences(grammarUnit(L(2, 7))!);
  assert.ok(s.every(x => x.picture === null && x.yesNo === null));
  const by = (id: string) => s.filter(x => x.patternId === id);
  assert.deepEqual(by('adv').map(x => x.text).slice(0, 2), ['She can knit carefully.', 'She can kick badly.']);
  assert.ok(by('well').some(x => x.text === 'She can sew well.'));
  assert.deepEqual([by('well')[0].choose!.right, by('well')[0].choose!.wrong], ['well', 'good']);
  assert.deepEqual([by('youyes')[0].choose!.right, by('youyes')[0].choose!.wrong], ['Can', 'Do']);
  assert.ok(by('ican').every(x => x.choose === null), '«I can sew.» gives no evidence to choose by');
});

test('S2 U8: pictures only for there was / wasn\'t / were, the hint «it was there», and was / were Choose', () => {
  const s = unitSentences(grammarUnit(L(2, 8))!);
  for (const id of ['she', 'they', 'where']) assert.ok(s.filter(x => x.patternId === id).every(x => x.picture === null), id);
  const pictured = new Set(s.filter(x => x.picture).map(x => x.patternId));
  assert.deepEqual([...pictured].sort(), ['adj', 'qn', 'qy', 'was', 'wasnt', 'were']);
  for (const x of s.filter(y => y.yesNo)) assert.equal(x.yesNo!.hint, 'was');
  const she = s.find(x => x.text === 'She was at the zoo last week.')!;
  assert.deepEqual([she.choose!.right, she.choose!.wrong], ['was', 'were']);
  assert.ok(s.some(x => x.text === 'There was an expensive clothes shop.'));
  assert.ok(s.some(x => x.text === 'There were two bus stops.'));
  assert.equal(s.find(x => x.text === 'Where were you yesterday morning? I was at the museum.')!.build!.prompt, 'Where were you yesterday morning?');
});

test('S2 U9 and U10: past forms are the rule or the table, and Choose offers the past against the base', () => {
  const regular = unitSentences(grammarUnit(L(2, 9))!);
  const irregular = unitSentences(grammarUnit(L(2, 10))!);
  for (const x of [...regular, ...irregular]) assert.equal(x.picture, null, x.text);
  const past = (list: typeof regular, id: string) => list.filter(x => x.patternId === id);
  assert.equal(past(regular, 'past').length, 10);
  assert.equal(past(irregular, 'past').length, 10);
  const rightWrong = (list: typeof regular, text: string) => { const x = list.find(y => y.text === text)!; return [x.choose!.right, x.choose!.wrong]; };
  assert.deepEqual(rightWrong(regular, 'People in the past used clay.'), ['used', 'use']);
  assert.deepEqual(rightWrong(regular, "People in the past didn't use clay."), ['use', 'used']);
  assert.deepEqual(rightWrong(regular, 'The bus stopped at the bus stop.'), ['stopped', 'stop']);
  assert.deepEqual(rightWrong(irregular, 'I wore this dress at our wedding.'), ['wore', 'wear']);
  assert.deepEqual(rightWrong(irregular, "We didn't see the ring again."), ['see', 'saw']);
  assert.deepEqual(rightWrong(irregular, 'They ate a big cake.'), ['ate', 'eat']);
  // Eight words fit the cap, so the whole exchange is built; only a longer pair builds its answer half.
  assert.deepEqual(irregular.find(x => x.text === 'Did you get any presents? Yes, I did.')!.build!.prompt, null);
});

test('the activity matrix: pictures on S1 U1, U3, U5 and S2 U8; Yes or No on S1 U1, U3, U4, U5 and S2 U8', () => {
  const withPictures = UNITS.filter(u => unitSentences(u).some(x => x.picture)).map(u => u.lessonId);
  assert.deepEqual(withPictures, [L(1, 1), L(1, 3), L(1, 5), L(2, 8)]);
  const withYesNo = UNITS.filter(u => unitSentences(u).some(x => x.yesNo)).map(u => u.lessonId);
  assert.deepEqual(withYesNo, [L(1, 1), L(1, 3), L(1, 4), L(1, 5), L(2, 8)]);
  for (const u of UNITS) assert.ok(unitSentences(u).some(x => x.choose), `${u.lessonId} has a Choose`);
});

test('the verbs and adjectives the patterns use have the forms the spec lists', async () => {
  const { ADJECTIVE_FORMS, pastTense } = await import('../englishGrammar.ts');
  const verbs = new Map<string, string>();
  for (const id of [L(2, 9), L(2, 10)]) for (const p of grammarUnit(id)!.patterns) for (const row of p.rows ?? []) if (row.verb) verbs.set(row.verb, pastTense(row.verb));
  assert.deepEqual(Object.fromEntries([...verbs].sort()), {
    arrive: 'arrived', buy: 'bought', eat: 'ate', get: 'got', give: 'gave', go: 'went', live: 'lived', make: 'made', need: 'needed',
    see: 'saw', start: 'started', stop: 'stopped', use: 'used', visit: 'visited', wear: 'wore', work: 'worked',
  });
  const adjectives = new Set<string>();
  for (const p of grammarUnit(L(1, 4))!.patterns) for (const row of p.rows ?? []) if (row.adj) adjectives.add(row.adj);
  for (const a of adjectives) assert.ok(ADJECTIVE_FORMS[a], a);
});

test('the false twin of every comparison is voiced', async () => {
  const { allGrammarSpoken } = await import('../englishGrammar.ts');
  const spoken = new Set(allGrammarSpoken());
  for (const x of unitSentences(grammarUnit(L(1, 4))!).filter(y => y.claim)) assert.ok(spoken.has(x.claim!.falseText), x.claim!.falseText);
});

const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 4 form lists every sentence once, a data page of everything to check, and a note on S2 U6', async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml(4);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 454);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 9);
  assert.equal((html.match(/<section class="data"/g) ?? []).length, 1);
  assert.equal((html.match(/<table class="data-table"/g) ?? []).length, 8);
  assert.ok(html.includes('مراجعة قواعد الصف الرابع'));
  // The data page prints what a teacher must check.
  for (const text of ['higher', 'more exciting', 'stopped', 'wore', 'milkshake', 'Jordanian', 'Social Studies', 'carefully', 'The mountain is higher than the hill.', 'The hill is higher than the mountain.']) {
    assert.ok(html.includes(text), `the data page lacks «${text}»`);
  }
  // A picture-free comparison: its false twin sits in the True or false cell, its fact in the Yes or No cell.
  assert.ok(html.includes('<span class="yn yn-no" dir="ltr">The hill is higher than the mountain.</span>'));
  assert.ok(html.includes('<span class="yn yn-yes" dir="ltr">Is the mountain higher than the hill? → Yes, it is.</span>'));
  assert.ok(html.includes('Hello from Hamed'), 'S2 U6 has no hub lesson, so the intro says it is not covered');
  assert.ok(html.includes('<small class="build-half" dir="ltr">Build: I\'m from the United Arab Emirates.</small>'));
});

test('the committed Grade 4 sheet and form are exactly what the generators produce; Grades 1-3 and the reading forms are untouched', async () => {
  const { renderGrammarSheet } = await import('../englishGrammar.ts');
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const read = (f: string) => readFileSync(new URL(f, docs), 'utf8');
  assert.equal(read('english-grammar-g4-sheet.md'), renderGrammarSheet(4), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(read('english-grammar-g4-review.html'), renderGrammarReviewHtml(4), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  for (const g of [1, 2, 3]) {
    assert.equal(read(`english-grammar-g${g}-sheet.md`), renderGrammarSheet(g), `Grade ${g} sheet changed`);
    assert.equal(read(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `Grade ${g} form changed`);
    assert.equal(read(`english-reading-g${g}-review.html`), renderReadingReviewHtml(g), `Grade ${g} reading form changed`);
  }
});

test('the Grade 4 pattern chips show «…» for every slot form, and Grade 3 keeps its older chips', async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const g4 = renderGrammarReviewHtml(4);
  assert.ok(g4.includes('<li>The … is … than the ….</li>'));
  assert.ok(!/\{(?:v|3|cmp|sup|ed|a|s):\w+\}/.test(g4.replace(/<style>[\s\S]*<\/style>/, '')), 'a raw slot is printed');
  assert.ok(renderGrammarReviewHtml(3).includes('{v:act}'), 'Grade 3 chips are unchanged');
});

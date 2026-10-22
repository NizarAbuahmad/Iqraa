/**
 * Grade 4 grammar sentences (spec: docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('the generator produces the designed sentences, lesson by lesson', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  const designed: [string, number][] = [[L(1, 1), 60], [L(1, 2), 42], [L(1, 3), 56], [L(1, 4), 29], [L(1, 5), 42]];
  assert.deepEqual([...counts].slice(0, designed.length), designed);
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

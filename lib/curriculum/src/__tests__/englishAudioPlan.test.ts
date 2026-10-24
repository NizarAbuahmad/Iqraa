import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ENGLISH_HUB_LESSONS, allHubWords, audioSlug, hubLesson } from '../englishHub.ts';
import { GRAMMAR_UNITS, allGrammarSpoken, unitSpoken } from '../englishGrammar.ts';
import {
  AUDIO_MODEL,
  AUDIO_VOICE,
  ENGLISH_AUDIO_BACKUP_PREFIX,
  ENGLISH_AUDIO_MANIFEST_KEY,
  ENGLISH_AUDIO_PREFIX,
  PROCESS_VERSION_METADATA,
  PRONUNCIATION,
  metadataProcessVersion,
  TEEN_INSTRUCTIONS,
  YOUNG_INSTRUCTIONS,
  audioPlan,
  emptyManifest,
  instructionsFor,
  needsReprocess,
  parseManifest,
} from '../englishAudioPlan.ts';

const plan = audioPlan();
const bySlug = new Map(plan.map(i => [i.slug, i]));

/** Slugs a Grade 1–4 lesson or grammar unit uses — the young register's whole domain. */
const youngWords = new Set(ENGLISH_HUB_LESSONS.filter(l => l.grade <= 4).flatMap(l => l.words.map(w => audioSlug(w.en))));
const unitGrade = (lessonId: string) => hubLesson(lessonId)!.grade;
const youngGrammar = new Set(GRAMMAR_UNITS.filter(u => unitGrade(u.lessonId) <= 4).flatMap(u => unitSpoken(u).map(audioSlug)));

describe('audioPlan', () => {
  it('has one item per slug, and every slug is its own text slugged', () => {
    assert.equal(new Set(plan.map(i => i.slug)).size, plan.length);
    for (const i of plan) assert.equal(i.slug, audioSlug(i.text));
    for (const i of plan) assert.ok(i.slug.length > 0, `empty slug for «${i.text}»`);
  });

  it('covers every hub word and every grammar string', () => {
    for (const w of allHubWords()) assert.ok(bySlug.has(audioSlug(w)), `hub word «${w}» missing`);
    for (const s of allGrammarSpoken()) assert.ok(bySlug.has(audioSlug(s)), `grammar string «${s}» missing`);
    const expected = new Set([...allHubWords(), ...allGrammarSpoken()].map(audioSlug));
    assert.equal(plan.length, expected.size, 'nothing but hub words and grammar strings');
  });

  it('keeps the first text seen, hub words before grammar strings', () => {
    const words = new Set(allHubWords().map(audioSlug));
    for (const i of plan) assert.equal(i.source, words.has(i.slug) ? 'word' : 'grammar', i.slug);
    const firstWord = new Map<string, string>();
    for (const w of allHubWords()) if (!firstWord.has(audioSlug(w))) firstWord.set(audioSlug(w), w);
    for (const [slug, text] of firstWord) assert.equal(bySlug.get(slug)!.text, text);
  });

  it('voices every grammar string only Grade 5, 9 or 10 uses in the teen register', () => {
    let n = 0;
    for (const u of GRAMMAR_UNITS) {
      const g = unitGrade(u.lessonId);
      if (g <= 4) continue;
      assert.ok([5, 9, 10].includes(g), `unexpected grammar grade ${g}`);
      for (const t of unitSpoken(u)) {
        const slug = audioSlug(t);
        if (youngGrammar.has(slug) || youngWords.has(slug)) continue;
        assert.equal(bySlug.get(slug)!.register, 'teen', `G${g} «${t}» must be teen`);
        n += 1;
      }
    }
    // The bug this guards: every one of these used to be read as if to a six-year-old.
    assert.ok(n > 1500, `only ${n} Grade 5/9/10 grammar strings checked`);
  });

  it('voices every Grade 1–4 grammar string and hub word in the young register', () => {
    assert.ok(youngGrammar.size > 1000 && youngWords.size > 400);
    for (const slug of youngGrammar) assert.equal(bySlug.get(slug)!.register, 'young', slug);
    for (const slug of youngWords) assert.equal(bySlug.get(slug)!.register, 'young', slug);
  });

  it('voices Grade 5+ hub words that no Grade 1–4 lesson uses in the teen register', () => {
    const older = ENGLISH_HUB_LESSONS.filter(l => l.grade >= 5).flatMap(l => l.words.map(w => audioSlug(w.en)));
    const teen = older.filter(s => !youngWords.has(s) && !youngGrammar.has(s));
    assert.ok(teen.length > 700);
    for (const slug of teen) assert.equal(bySlug.get(slug)!.register, 'teen', slug);
    // A word shared with a Grade 1–4 lesson keeps the young voice of that lesson.
    const shared = older.filter(s => youngWords.has(s));
    assert.ok(shared.length > 0);
    for (const slug of shared) assert.equal(bySlug.get(slug)!.register, 'young', slug);
  });

  it('records every grade that uses a slug', () => {
    for (const i of plan) {
      assert.ok(i.grades.length > 0, i.slug);
      assert.deepEqual(i.grades, [...i.grades].sort((a, b) => a - b));
      assert.equal(i.register === 'young', i.grades.some(g => g <= 4), i.slug);
    }
  });
});

describe('unitSpoken', () => {
  it('leaves allGrammarSpoken() exactly as it was: the union over every unit, in order', () => {
    assert.deepEqual(allGrammarSpoken(), [...new Set(GRAMMAR_UNITS.flatMap(u => unitSpoken(u)))]);
  });

  it('has no repeats within a unit', () => {
    for (const u of GRAMMAR_UNITS) assert.equal(new Set(unitSpoken(u)).size, unitSpoken(u).length, u.lessonId);
  });
});

describe('instructionsFor', () => {
  it('reads to a six-year-old only in the young register', () => {
    assert.match(instructionsFor({ text: 'cat', register: 'young' }), /six-year-old/);
    assert.doesNotMatch(instructionsFor({ text: 'cat', register: 'teen' }), /six-year-old/);
    assert.match(instructionsFor({ text: 'cat', register: 'teen' }), /teenage/);
    assert.equal(instructionsFor({ text: 'cat', register: 'young' }), YOUNG_INSTRUCTIONS);
    assert.equal(instructionsFor({ text: 'cat', register: 'teen' }), TEEN_INSTRUCTIONS);
  });

  it('appends a pronunciation hint, whatever the case and spacing', () => {
    for (const text of ['eraser', ' Eraser ']) {
      const s = instructionsFor({ text, register: 'young' });
      assert.ok(s.startsWith(YOUNG_INSTRUCTIONS));
      assert.ok(s.endsWith(PRONUNCIATION.eraser));
    }
    assert.equal(bySlug.get('eraser')!.register, 'young', 'eraser is a Grade 1 word');
  });

  it('keeps the model and voice the 1,050 stored clips were made with', () => {
    assert.equal(AUDIO_MODEL, 'gpt-4o-mini-tts');
    assert.equal(AUDIO_VOICE, 'coral');
  });
});

describe('manifest', () => {
  it('round-trips and refuses anything else', () => {
    const m = emptyManifest();
    m.items.cat = { text: 'cat', register: 'young', model: AUDIO_MODEL, voice: AUDIO_VOICE, processVersion: 1, speechS: 0.42, bytes: 3200 };
    assert.deepEqual(parseManifest(JSON.stringify(m)), m);
    assert.throws(() => parseManifest('null'));
    assert.throws(() => parseManifest('{"version":2,"items":{}}'));
    assert.throws(() => parseManifest('{"version":1,"items":[]}'));
    assert.throws(() => parseManifest('{"version":1,"items":{"cat":{"text":"cat"}}}'));
    assert.throws(() => parseManifest('{"version":1,'));
  });

  it('reprocesses a clip with no entry or an older version, and nothing else', () => {
    const m = emptyManifest();
    m.items.cat = { text: 'cat', register: 'young', model: AUDIO_MODEL, voice: AUDIO_VOICE, processVersion: 1, speechS: 0.42, bytes: 3200 };
    m.items.dog = { ...m.items.cat, text: 'dog', processVersion: 0, speechS: null };
    assert.equal(needsReprocess(m, 'cat', 1), false);
    assert.equal(needsReprocess(m, 'cat', 2), true);
    assert.equal(needsReprocess(m, 'dog', 1), true);
    assert.equal(needsReprocess(m, 'pig', 1), true);
  });

  it('lives next to the clips and is not an .mp3, so the bucket listing never counts it', () => {
    assert.equal(ENGLISH_AUDIO_MANIFEST_KEY, 'english-audio/_manifest.json');
    assert.ok(!ENGLISH_AUDIO_MANIFEST_KEY.endsWith('.mp3'));
  });
});

describe('backups and object metadata', () => {
  it('backs up to a sibling prefix the clip listing (`english-audio/`) never reaches', () => {
    assert.equal(ENGLISH_AUDIO_BACKUP_PREFIX, 'english-audio-original');
    assert.ok(!`${ENGLISH_AUDIO_BACKUP_PREFIX}/cat.mp3`.startsWith(`${ENGLISH_AUDIO_PREFIX}/`));
  });

  it('reads the process version an object was stamped with, 0 when it has none', () => {
    assert.equal(PROCESS_VERSION_METADATA, 'process-version');
    assert.equal(metadataProcessVersion({ 'process-version': '1' }), 1);
    assert.equal(metadataProcessVersion({ 'process-version': '3' }), 3);
    assert.equal(metadataProcessVersion({ 'process-version': '0' }), 0);
    assert.equal(metadataProcessVersion({}), 0);
    assert.equal(metadataProcessVersion(undefined), 0);
    assert.equal(metadataProcessVersion({ 'process-version': 'x' }), 0);
    assert.equal(metadataProcessVersion({ 'process-version': '-1' }), 0);
    assert.equal(metadataProcessVersion({ 'process-version': '1.5' }), 0);
  });
});

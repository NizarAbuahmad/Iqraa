/**
 * A deck reopened from موادي has to come back as a deck.
 *
 * «تعديل» pushed the slides screens a `savedId` plus the saved form fields,
 * and neither screen read the id: the form came back and the deck — the thing
 * the teacher had built and edited — did not, so they were one press away from
 * generating a different one over it. These pin the pure half: reading the
 * stored content defensively, and the link a reopened deck starts with.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseSavedDeck, reopenedDeckLink } from '../savedDeck.ts';
import { pendingSync, saveAction, showsSaved } from '../deckSaveLink.ts';
import { readFlagParam } from '../materialParams.ts';

const deck = {
  activityName: 'عرض الدرس',
  activityType: 'slides',
  grade: 'العاشر',
  subject: 'الرياضيات',
  lesson: 'المعادلات',
  duration: 40,
  difficulty: 'standard',
  groupType: 'whole-class',
  learningObjective: '',
  materials: [],
  teacherPreparation: '',
  slides: [{ type: 'title', title: 'المعادلات', content: '' }],
  teacherNotes: [],
  answerKey: [],
};

describe('parseSavedDeck', () => {
  it('reads a stored deck back', () => {
    assert.deepEqual(parseSavedDeck(JSON.stringify(deck)), deck);
  });

  it('refuses what is not a deck, so the screen falls back to its form', () => {
    for (const bad of ['', 'not json', 'null', '42', '[]', '"x"', '{}', '{"slides":[]}', '{"slides":"x"}']) {
      assert.equal(parseSavedDeck(bad), null, bad);
    }
  });

  it('refuses a deck with no title or with a slide that is not an object', () => {
    assert.equal(parseSavedDeck(JSON.stringify({ ...deck, activityName: '' })), null);
    assert.equal(parseSavedDeck(JSON.stringify({ ...deck, slides: [null] })), null);
    assert.equal(parseSavedDeck(JSON.stringify({ ...deck, slides: [{ type: 'title' }, 'x'] })), null);
  });

  it('fills in the lists an older deck did not store, rather than refusing it', () => {
    const { teacherNotes: _n, answerKey: _a, materials: _m, ...bare } = deck;
    const read = parseSavedDeck(JSON.stringify(bare))!;
    assert.deepEqual(read.teacherNotes, []);
    assert.deepEqual(read.answerKey, []);
    assert.deepEqual(read.materials, []);
    assert.equal(read.slides.length, 1);
  });
});

describe('reopenedDeckLink', () => {
  const parsed = parseSavedDeck(JSON.stringify(deck))!;
  const link = reopenedDeckLink('m1', parsed);

  it('is the saved copy, so the button reads «محفوظ» and a second press removes it', () => {
    assert.equal(link.savedId, 'm1');
    assert.equal(showsSaved(link), true);
    assert.equal(saveAction(link), 'delete');
  });

  it('writes nothing until the teacher edits', () => {
    assert.equal(pendingSync(link, JSON.stringify(parsed)), null);
  });

  it('follows an edit into the same item', () => {
    const edited = JSON.stringify({ ...parsed, activityName: 'عنوان جديد' });
    assert.deepEqual(pendingSync(link, edited), { id: 'm1', content: edited });
  });
});

describe('readFlagParam', () => {
  it('reads the strings a boolean becomes in a route', () => {
    assert.equal(readFlagParam('true', false), true);
    assert.equal(readFlagParam('1', false), true);
    assert.equal(readFlagParam('false', true), false);
    assert.equal(readFlagParam('0', true), false);
  });

  it('keeps the default for an absent or unreadable value', () => {
    assert.equal(readFlagParam(undefined, true), true);
    assert.equal(readFlagParam(undefined, false), false);
    assert.equal(readFlagParam('maybe', true), true);
  });
});

/**
 * When may a deck on screen write itself into موادي?
 *
 * Slides and Prompt Slides look their deck up in the workspace by identity
 * (type, title, grade, subject, topic) so the save button survives leaving
 * the screen. They then auto-synced every change into whatever they found —
 * so regenerating a lesson the teacher had saved AND edited found the stored
 * copy by its title and overwrote the edits with a fresh deck, silently. The
 * rule now: a stored item whose content differs is adopted for its id only
 * (Save updates it, explicitly); auto-sync follows only a deck this screen
 * saved itself, or one it adopted with identical content.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_LINK,
  linkAfterSave,
  linkFromMatch,
  pendingSync,
  saveAction,
  showsSaved,
} from '../deckSaveLink.ts';

describe('linkFromMatch', () => {
  it('adopts nothing when nothing matched', () => {
    assert.equal(linkFromMatch(null, '{"a":1}'), null);
  });

  it('follows a stored item whose content is exactly what is on screen', () => {
    const link = linkFromMatch({ id: 'm1', content: '{"a":1}' }, '{"a":1}');
    assert.deepEqual(link, { savedId: 'm1', autoSync: true, savedContent: '{"a":1}' });
  });

  it('adopts a differing stored item for its id but never auto-syncs over it', () => {
    const link = linkFromMatch({ id: 'm1', content: '{"edited":true}' }, '{"fresh":true}')!;
    assert.equal(link.savedId, 'm1');
    assert.equal(link.autoSync, false);
    assert.equal(pendingSync(link, '{"fresh":true}'), null);
    assert.equal(pendingSync(link, '{"fresh":"and edited again"}'), null);
  });
});

describe('pendingSync', () => {
  it('pushes a change to a deck this screen saved', () => {
    const link = linkAfterSave('m2', 'v1');
    assert.deepEqual(pendingSync(link, 'v2'), { id: 'm2', content: 'v2' });
  });

  it('does nothing when the stored copy already matches', () => {
    assert.equal(pendingSync(linkAfterSave('m2', 'v1'), 'v1'), null);
  });

  it('does nothing for an unsaved deck', () => {
    assert.equal(pendingSync(NO_LINK, 'v1'), null);
  });
});

describe('saveAction / showsSaved', () => {
  it('creates when there is no stored item', () => {
    assert.equal(saveAction(NO_LINK), 'create');
    assert.equal(showsSaved(NO_LINK), false);
  });

  it('un-saves a deck the screen is following', () => {
    const link = linkAfterSave('m3', 'v1');
    assert.equal(saveAction(link), 'delete');
    assert.equal(showsSaved(link), true);
  });

  it('updates an adopted-but-differing item rather than deleting or duplicating it', () => {
    const link = linkFromMatch({ id: 'm4', content: 'old' }, 'new')!;
    assert.equal(saveAction(link), 'update');
    // The button must not claim "saved" over a stored copy that is not
    // what the teacher is looking at.
    assert.equal(showsSaved(link), false);
  });
});

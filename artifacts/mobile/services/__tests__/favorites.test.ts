import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteFeedback } from '../favorites.ts';
import translations from '../i18n.ts';

/*
  The bug these cover: every favourite button toasted «أضفتها إلى المفضلة» the
  moment it was tapped, on a `toggleFavorite` that returned `void` and silently
  swallowed a failed write. The star lit, the teacher was told it was saved,
  and the next reload put it out. Feedback now follows what persisted.
*/

test('a write that landed reports the state it landed on', () => {
  assert.deepEqual(
    favoriteFeedback(false, { ok: true, isFavorite: true }),
    { isFavorite: true, message: 'addedToFavorites' },
  );
  assert.deepEqual(
    favoriteFeedback(true, { ok: true, isFavorite: false }),
    { isFavorite: false, message: 'removedFromFavorites' },
  );
});

test('tapping twice ends where it started', () => {
  const on = favoriteFeedback(false, { ok: true, isFavorite: true });
  const off = favoriteFeedback(on.isFavorite, { ok: true, isFavorite: false });
  assert.equal(off.isFavorite, false);
  assert.notEqual(on.message, off.message);
});

test('a write that did not land puts the star back and says so', () => {
  // Not `result.isFavorite`: a write that failed says nothing about the store.
  assert.deepEqual(
    favoriteFeedback(false, { ok: false, isFavorite: true }),
    { isFavorite: false, message: 'favoriteFailed' },
  );
  assert.deepEqual(
    favoriteFeedback(true, { ok: false, isFavorite: false }),
    { isFavorite: true, message: 'favoriteFailed' },
  );
});

test('never claims a save it did not get', () => {
  for (const previous of [true, false]) {
    for (const isFavorite of [true, false]) {
      const { message } = favoriteFeedback(previous, { ok: false, isFavorite });
      assert.equal(message, 'favoriteFailed');
    }
  }
});

test('every message it can return is a translation key in both languages', () => {
  const messages = [
    favoriteFeedback(false, { ok: true, isFavorite: true }).message,
    favoriteFeedback(true, { ok: true, isFavorite: false }).message,
    favoriteFeedback(false, { ok: false, isFavorite: false }).message,
  ];
  for (const key of messages) {
    for (const lang of ['ar', 'en'] as const) {
      assert.ok(
        typeof (translations[lang] as Record<string, unknown>)[key] === 'string',
        `${lang}.${key} is missing`,
      );
    }
  }
});

test('the star labels exist in both languages', () => {
  for (const key of ['addToFavorites', 'inFavorites', 'favoriteShort']) {
    for (const lang of ['ar', 'en'] as const) {
      assert.ok(
        typeof (translations[lang] as Record<string, unknown>)[key] === 'string',
        `${lang}.${key} is missing`,
      );
    }
  }
});

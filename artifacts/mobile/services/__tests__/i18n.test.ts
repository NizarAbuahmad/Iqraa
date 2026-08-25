import test from 'node:test';
import assert from 'node:assert/strict';
import translations, { arCountSeconds, countSeconds, getT } from '../i18n.ts';

/*
  `TranslationKey` is `keyof typeof translations.en`, so the English block alone
  defines what a key is. Arabic is then free to be missing one and the compiler
  will not say a word — and `getT` falls back to `val ?? key`, which renders the
  key's own name into the UI. A teacher would see the literal text
  "notFoundTitle" on the screen, in the product's primary language, and nothing
  would have failed anywhere. These tests are that missing compiler check.
*/

const keysOf = (o: object) => Object.keys(o).sort();

test('Arabic and English define exactly the same keys', () => {
  assert.deepEqual(keysOf(translations.ar), keysOf(translations.en));
});

test('no translation is empty or whitespace in either language', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const [key, val] of Object.entries(translations[lang])) {
      if (typeof val === 'function') continue;
      assert.equal(typeof val, 'string', `${lang}.${key} is not a string`);
      assert.ok((val as string).trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('a key that takes arguments takes them in both languages', () => {
  for (const key of Object.keys(translations.en)) {
    const en = (translations.en as any)[key];
    const ar = (translations.ar as any)[key];
    assert.equal(
      typeof en === 'function',
      typeof ar === 'function',
      `${key} is a function in one language and a string in the other`,
    );
  }
});

test('getT resolves every key from its own language, never the fallback', () => {
  for (const lang of ['ar', 'en'] as const) {
    const t = getT(lang);
    for (const key of Object.keys(translations.en) as any[]) {
      const val = (lang === 'ar' ? translations.ar : translations.en) as any;
      // Argument-taking entries are exercised by their own call sites; this is
      // about the plain strings, where `val ?? key` is the failure mode.
      if (typeof val[key] === 'function') continue;
      // Asserting against the defined value rather than "differs from the key
      // name": `en.pts` is legitimately the string 'pts', and a name-based
      // heuristic would call that a missing translation forever.
      assert.equal(t(key), val[key], `${lang}.${key} did not resolve to its own entry`);
    }
  }
});

// ─── Strings added for the 23 Aug review fixes ───────────────────────────────

test('the failure and not-found copy exists in Arabic, and is Arabic', () => {
  const arabic = /[؀-ۿ]/;
  for (const key of ['startClassFailed', 'notFoundTitle', 'notFoundBody', 'notFoundHome', 'iqraInputLabel'] as const) {
    const val = translations.ar[key];
    assert.ok(arabic.test(val), `ar.${key} contains no Arabic characters`);
  }
});

// ─── the elapsed-seconds counter ─────────────────────────────────────────────

test('Arabic seconds follow the same four-case rule as the other counters', () => {
  // A counter that ticks once a second is the most-read string on screen while
  // a teacher waits, so "1 ثانية" and "3 ثانية" would be the most-read broken
  // Arabic in the product.
  assert.equal(arCountSeconds(1), 'ثانية واحدة');
  assert.equal(arCountSeconds(2), 'ثانيتان');
  assert.equal(arCountSeconds(3), '3 ثوانٍ');
  assert.equal(arCountSeconds(10), '10 ثوانٍ');
  assert.equal(arCountSeconds(11), '11 ثانية');
  assert.equal(arCountSeconds(59), '59 ثانية');
});

test('zero reads as a plain count, not as an absence', () => {
  // Unlike students or materials, zero seconds is a real reading on a counter
  // that just started — "لا ثواني" would be nonsense there.
  assert.equal(arCountSeconds(0), '0 ثانية');
  assert.equal(countSeconds(0, 'en'), '0s');
});

test('countSeconds picks the language', () => {
  assert.equal(countSeconds(2, 'ar'), 'ثانيتان');
  assert.equal(countSeconds(2, 'en'), '2s');
});

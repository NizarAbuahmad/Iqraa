/**
 * The Today screen writes every number in Latin digits: the readiness count
 * («1 من 5»), the saved-ago date on a board row, and the clock times. The
 * header date used plain `ar-JO`, whose default numbering is Arabic-Indic, so
 * one line read «٣ تشرين الأول» above a board that read «26 آب» — two digit
 * systems on one screen. The header date now follows the board.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dateLocale, todayLabel } from '../dateLabels.ts';

// A Saturday, built from local parts so the test does not depend on the runner's timezone.
const SATURDAY = new Date(2026, 9, 3, 13, 6);
const ARABIC_INDIC = /[٠-٩]/;

describe('todayLabel', () => {
  it('writes the Arabic date with Latin digits, matching the board beside it', () => {
    const label = todayLabel('ar', SATURDAY);
    assert.ok(!ARABIC_INDIC.test(label), `Arabic-Indic digit in «${label}»`);
    assert.match(label, /\b3\b/);
  });

  it('still names the weekday and month in Arabic', () => {
    const label = todayLabel('ar', SATURDAY);
    assert.match(label, /السبت/);
    assert.match(label, /تشرين الأول/);
  });

  it('is unchanged in English', () => {
    const label = todayLabel('en', SATURDAY);
    assert.match(label, /Saturday/);
    assert.match(label, /October/);
    assert.match(label, /\b3\b/);
  });
});

describe('dateLocale', () => {
  const day = new Date(2026, 9, 3, 13, 6);

  it('is Latin-digit Arabic for the Arabic UI and en-GB for English', () => {
    assert.equal(dateLocale('ar'), 'ar-JO-u-nu-latn');
    assert.equal(dateLocale('en'), 'en-GB');
  });

  it('formats a short date, a long date and a time without Arabic-Indic digits', () => {
    const loc = dateLocale('ar');
    for (const text of [
      day.toLocaleDateString(loc, { day: 'numeric', month: 'short' }),
      day.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }),
      day.toLocaleDateString(loc, { day: 'numeric', month: 'long' }),
      day.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
    ]) {
      assert.ok(!ARABIC_INDIC.test(text), `Arabic-Indic digit in «${text}»`);
    }
  });
});

/**
 * The rule, enforced on the source rather than remembered. Plain `ar-JO` (and
 * a locale-less `toLocaleDateString()`, which takes the device's) prints
 * Arabic-Indic digits, so one screen read «٣ تشرين الأول» while the next read
 * «3 تشرين الأول». Every date or time an interface screen prints goes through
 * `dateLocale` / `AR_LATIN`.
 *
 * Not covered, on purpose: `app/admin` and `app/dev` (staff tools that print
 * the device's own format), and book content, maths, citations and game
 * scores, which use Arabic-Indic digits deliberately and do not go through a
 * date formatter at all.
 */
describe('no interface screen prints a date in Arabic-Indic digits', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const SKIP = /[\\/](__tests__|node_modules|admin|dev)[\\/]/;
  // The one file that defines the locale, and so names the plain one in its comments.
  const DEFINITION = /services[\\/]dateLabels\.ts$/;

  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (SKIP.test(full + sep) || DEFINITION.test(full)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) sources.push(full);
    }
  };
  for (const dir of ['app', 'components', 'services', 'hooks']) walk(join(root, dir));

  it('has no plain ar-JO locale', () => {
    const offenders = sources.filter(f => /['"`]ar-JO['"`]/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(offenders.map(f => f.slice(root.length)), []);
  });

  it('has no locale-less date or time formatter', () => {
    const offenders = sources.filter(f => /toLocale(Date|Time)?String\(\s*(\[\s*\])?\s*[,)]/.test(readFileSync(f, 'utf8')) || /toLocale(Date|Time)?String\(\)/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(offenders.map(f => f.slice(root.length)), []);
  });
});

/**
 * The subject gates decide which bank a generated question comes from, so
 * getting them wrong is not a styling bug — it serves algebra to an Arabic
 * class.
 *
 * Precedence is pinned in `mathPractice.test.ts`: a resolved lesson's own
 * subject wins, in both directions, even against a disagreeing caller. What is
 * pinned here is the step BELOW that — the subject NAME lookup, which used to
 * recognise eleven of the nineteen subjects and silently fall through to a
 * keyword scan for the rest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isMathContext, subjectIdFromName } from '../index.ts';
import { isChemContext } from '../chemistry.ts';

test('a named maths subject routes to the maths bank', () => {
  assert.equal(isMathContext('أي موضوع', null, 'الرياضيات'), true);
  assert.equal(isMathContext('any topic', null, 'Mathematics'), true);
  assert.equal(isChemContext('أي موضوع', null, 'الكيمياء'), true);
});

test('a named chemistry subject is not maths, and vice versa', () => {
  assert.equal(isMathContext('المعادلة الكيميائية', null, 'الكيمياء'), false);
  assert.equal(isChemContext('المعادلات', null, 'الرياضيات'), false);
});

test('subjects the old regex omitted are now recognised', () => {
  // Geography, history, digital skills, civic/physical/creative/vocational
  // education and earth science were all missing from KNOWN_NON_MATH_SUBJECT,
  // so passing their names said nothing and the decision fell through to a
  // keyword scan — and these topics are full of maths-regex false positives.
  for (const name of [
    'الجغرافيا', 'التاريخ', 'المهارات الرقمية', 'التربية الوطنية والمدنية',
    'التربية الرياضية', 'التربية المهنية', 'علوم الأرض والبيئة',
    'Geography', 'History', 'Digital Skills',
  ]) {
    assert.equal(isMathContext('دائرة ومثلث ومعادلة', null, name), false, name);
    assert.equal(isChemContext('الذرة والإلكترون', null, name), false, name);
  }
});

test('the lesson still outranks a disagreeing caller subject', () => {
  // Pinned here too because this file is where someone will come looking after
  // hitting the guessed-lesson limitation documented on isMathContext.
  assert.equal(isMathContext('أي موضوع', null, 'اللغة العربية', 'mathematics'), true);
  assert.equal(isMathContext('أي موضوع', null, 'Mathematics', 'chemistry'), false);
});

test('an unrecognised subject leaves the decision to the text heuristic', () => {
  // null means "no opinion", not "not maths".
  assert.equal(subjectIdFromName('Something Unlisted'), null);
  assert.equal(isMathContext('حل المعادلة التربيعية', null, 'Something Unlisted'), true);
  assert.equal(isMathContext('قصيدة عن الوطن', null, 'Something Unlisted'), false);
});

test('no subject and no lesson id falls back to the text heuristic', () => {
  assert.equal(isMathContext('حل المعادلة التربيعية', null), true);
  assert.equal(isMathContext('قصيدة عن الوطن', null), false);
  assert.equal(isChemContext('تركيب الذرة والإلكترون', null), true);
});

test('subject names match despite diacritics and spacing', () => {
  assert.equal(subjectIdFromName('  الرياضيات  '), 'mathematics');
  assert.equal(subjectIdFromName('التربية الفنّيّة والموسيقيّة والمسرحيّة'), 'creative-arts');
  assert.equal(subjectIdFromName('mathematics'), 'mathematics');
  assert.equal(subjectIdFromName(undefined), null);
});

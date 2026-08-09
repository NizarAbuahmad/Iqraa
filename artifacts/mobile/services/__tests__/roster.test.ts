/**
 * Roster name parsing.
 *
 * This is the one place a teacher's register turns into student records, and a
 * mistake here is expensive in a way a UI bug isn't: a duplicated line creates
 * two students with the same name, and from then on that child's results are
 * split across two rows with no obvious sign anything is wrong.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentNames } from '../rosterNames.ts';

describe('parseStudentNames', () => {
  it('splits one name per line', () => {
    assert.deepEqual(parseStudentNames('ليان\nعمر\nسارة'), ['ليان', 'عمر', 'سارة']);
  });

  it('splits on commas, including the Arabic comma', () => {
    assert.deepEqual(parseStudentNames('ليان، عمر, سارة'), ['ليان', 'عمر', 'سارة']);
  });

  it('drops blank lines and trailing whitespace', () => {
    assert.deepEqual(parseStudentNames('  ليان  \n\n\n  عمر\n  '), ['ليان', 'عمر']);
  });

  it('strips list numbering, Latin and Arabic-Indic', () => {
    assert.deepEqual(
      parseStudentNames('1. ليان\n2) عمر\n٣- سارة'),
      ['ليان', 'عمر', 'سارة'],
    );
  });

  it('collapses duplicates within one paste', () => {
    // A doubled line would otherwise become two students with one name, and
    // that child's results would silently split between them.
    assert.deepEqual(parseStudentNames('ليان\nعمر\nليان'), ['ليان', 'عمر']);
  });

  it('treats differing internal whitespace as the same name', () => {
    assert.deepEqual(parseStudentNames('ليان  أبو أحمد\nليان أبو أحمد'), ['ليان  أبو أحمد']);
  });

  it('keeps distinct students with similar names', () => {
    assert.deepEqual(
      parseStudentNames('عمر الخطيب\nعمر النعيمي'),
      ['عمر الخطيب', 'عمر النعيمي'],
    );
  });

  it('returns nothing for empty or whitespace-only input', () => {
    assert.deepEqual(parseStudentNames(''), []);
    assert.deepEqual(parseStudentNames('   \n\n  '), []);
  });

  it('handles a full-name list with mixed separators', () => {
    assert.deepEqual(
      parseStudentNames('1. ليان أبو أحمد\n2. عمر الخطيب, سارة النعيمي\n\n3) يوسف حداد'),
      ['ليان أبو أحمد', 'عمر الخطيب', 'سارة النعيمي', 'يوسف حداد'],
    );
  });
});

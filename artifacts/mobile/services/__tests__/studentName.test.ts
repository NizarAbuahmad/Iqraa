import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { letterStudentName, nameAfterLanguageChange } from '../studentName.ts';

const both = { displayName: 'ahmad', displayNameAr: 'أحمد' };

describe('letterStudentName', () => {
  it('an Arabic letter uses the Arabic name when there is one', () => {
    assert.equal(letterStudentName(both, true), 'أحمد');
  });

  it('an English letter uses the roster name', () => {
    assert.equal(letterStudentName(both, false), 'ahmad');
  });

  it('falls back to the roster name when no Arabic name is recorded', () => {
    assert.equal(letterStudentName({ displayName: 'ahmad' }, true), 'ahmad');
    assert.equal(letterStudentName({ displayName: 'ahmad', displayNameAr: '   ' }, true), 'ahmad');
  });
});

describe('nameAfterLanguageChange', () => {
  it('swaps to the other spelling when the field still holds one of ours', () => {
    assert.equal(nameAfterLanguageChange('ahmad', both, true), 'أحمد');
    assert.equal(nameAfterLanguageChange('أحمد', both, false), 'ahmad');
  });

  it("leaves a name the teacher typed over it alone", () => {
    assert.equal(nameAfterLanguageChange('أحمد الخطيب', both, false), 'أحمد الخطيب');
  });

  it('does nothing for a student with no Arabic name', () => {
    assert.equal(nameAfterLanguageChange('ahmad', { displayName: 'ahmad' }, true), 'ahmad');
  });
});

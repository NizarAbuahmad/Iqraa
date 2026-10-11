/**
 * What this guards: the teacher's «who reacted» list. In a direct thread the
 * participant lookup holds only the OTHER person, so the viewer's own reaction
 * used to resolve to «مستخدم» — an unidentified third party in a private 1:1
 * chat. The viewer must be named «أنت» before the lookup is consulted.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reactorNames } from '../reactorNames.ts';

const labels = { you: 'أنت', unknown: 'مستخدم' };
const lookup = new Map([
  ['p1', { firstName: 'سارة', lastName: 'أحمد' }],
  ['p2', { firstName: 'علي', lastName: '' }],
  ['me', { firstName: 'المعلم', lastName: 'نزار' }],
]);

describe('reactorNames', () => {
  it('names the viewer «you» even when absent from the lookup (direct thread)', () => {
    assert.deepEqual(reactorNames(['teacher-1'], 'teacher-1', new Map(), labels), ['أنت']);
  });

  it('names a known participant, trimmed', () => {
    assert.deepEqual(reactorNames(['p1', 'p2'], 'me', lookup, labels), ['سارة أحمد', 'علي']);
  });

  it('falls back to the unknown label for an id nobody can resolve', () => {
    assert.deepEqual(reactorNames(['ghost'], 'me', lookup, labels), ['مستخدم']);
  });

  it('still says «you» when the viewer is also in the lookup', () => {
    assert.deepEqual(reactorNames(['me'], 'me', lookup, labels), ['أنت']);
  });

  it('keeps order across a mix', () => {
    assert.deepEqual(reactorNames(['p1', 'me', 'ghost'], 'me', lookup, labels), ['سارة أحمد', 'أنت', 'مستخدم']);
  });

  it('returns [] for no reactors', () => {
    assert.deepEqual(reactorNames([], 'me', lookup, labels), []);
  });

  it('does not match a missing viewer id against anything', () => {
    assert.deepEqual(reactorNames(['p1'], undefined, lookup, labels), ['سارة أحمد']);
  });
});

/**
 * What this guards: three things that fail silently in the picker UI.
 *
 * A parent quietly left out of a class selection, an Arabic name that never
 * matches what a teacher types, and a class chip that adds but cannot un-add
 * all look like "the picker is a bit odd" rather than like a bug, so none of
 * them would produce a report worth acting on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPickerContacts,
  matchesQuery,
  normalizeAr,
  toggleClassSelection,
  type PickerContact,
} from '../participantPicker.ts';
import type { ContactStudent } from '../messaging.ts';

const parent = (userId: string, firstName: string, lastName = 'الخطيب') => ({
  userId,
  firstName,
  lastName,
  role: 'parent' as const,
});

const CLASS_A = { id: 'c-a', name: '10-A', nameAr: 'عاشر أ' };
const CLASS_B = { id: 'c-b', name: '10-B', nameAr: 'عاشر ب' };

describe('buildPickerContacts', () => {
  it('returns one row per person, not one per linked student', () => {
    const rows: ContactStudent[] = [
      { studentId: 's1', studentName: 'أحمد', classes: [CLASS_A], contacts: [parent('u1', 'سارة')] },
      { studentId: 's2', studentName: 'ليث', classes: [CLASS_B], contacts: [parent('u1', 'سارة')] },
    ];
    const { contacts } = buildPickerContacts(rows);
    assert.equal(contacts.length, 1);
  });

  it('accumulates every class a person is reachable through', () => {
    const rows: ContactStudent[] = [
      { studentId: 's1', studentName: 'أحمد', classes: [CLASS_A], contacts: [parent('u1', 'سارة')] },
      { studentId: 's2', studentName: 'ليث', classes: [CLASS_B], contacts: [parent('u1', 'سارة')] },
    ];
    const { contacts } = buildPickerContacts(rows);
    // The whole point: keeping only the first student's class would drop this
    // parent out of "select 10-B" without anything looking wrong.
    assert.deepEqual([...contacts[0]!.classIds].sort(), ['c-a', 'c-b']);
  });

  it('keeps the first student as the subtitle, so row text does not depend on response order', () => {
    const rows: ContactStudent[] = [
      { studentId: 's1', studentName: 'أحمد', classes: [CLASS_A], contacts: [parent('u1', 'سارة')] },
      { studentId: 's2', studentName: 'ليث', classes: [CLASS_B], contacts: [parent('u1', 'سارة')] },
    ];
    assert.equal(buildPickerContacts(rows).contacts[0]!.studentName, 'أحمد');
  });

  it('collects each class once across students', () => {
    const rows: ContactStudent[] = [
      { studentId: 's1', studentName: 'أحمد', classes: [CLASS_A], contacts: [parent('u1', 'سارة')] },
      { studentId: 's2', studentName: 'ليث', classes: [CLASS_A], contacts: [parent('u2', 'منى')] },
    ];
    assert.deepEqual(buildPickerContacts(rows).classes.map(c => c.id), ['c-a']);
  });

  it('survives a server that predates the classes field', () => {
    // The API deploys by hand while the app deploys on merge, so this shape is
    // what the client actually meets first.
    const rows = [
      { studentId: 's1', studentName: 'أحمد', contacts: [parent('u1', 'سارة')] },
    ] as unknown as ContactStudent[];
    const { contacts, classes } = buildPickerContacts(rows);
    assert.deepEqual(classes, []);
    assert.deepEqual(contacts[0]!.classIds, []);
  });
});

describe('matchesQuery', () => {
  const c: PickerContact = {
    ...parent('u1', 'سارة'),
    studentName: 'أحمد',
    classIds: [],
  };

  it('matches a name typed without the hamza', () => {
    // «احمد» is what gets typed; «أحمد» is what is stored.
    assert.equal(matchesQuery(c, 'احمد'), true);
  });

  it('matches the person, not only the student', () => {
    assert.equal(matchesQuery(c, 'سارة'), true);
  });

  it('matches the student a contact is attached to', () => {
    assert.equal(matchesQuery(c, 'أحمد'), true);
  });

  it('refuses a name that is not there', () => {
    assert.equal(matchesQuery(c, 'خالد'), false);
  });

  it('treats an empty or whitespace query as no filter', () => {
    assert.equal(matchesQuery(c, ''), true);
    assert.equal(matchesQuery(c, '   '), true);
  });

  it('ignores tashkeel on either side', () => {
    const withHarakat: PickerContact = { ...c, firstName: 'سَارَة' };
    assert.equal(matchesQuery(withHarakat, 'ساره'), true);
  });
});

describe('normalizeAr', () => {
  it('folds the alef, ya and ta-marbuta variants', () => {
    assert.equal(normalizeAr('أإآ'), 'ااا');
    assert.equal(normalizeAr('ى'), 'ي');
    assert.equal(normalizeAr('ة'), 'ه');
  });

  it('collapses whitespace and trims', () => {
    assert.equal(normalizeAr('  أحمد   الخطيب '), 'احمد الخطيب');
  });
});

describe('toggleClassSelection', () => {
  const a = { userId: 'u1' };
  const b = { userId: 'u2' };

  it('adds a whole class when none of it is picked', () => {
    const next = toggleClassSelection(new Map(), [a, b]);
    assert.deepEqual([...next.keys()].sort(), ['u1', 'u2']);
  });

  it('removes a whole class when all of it is picked', () => {
    const all = new Map([['u1', a], ['u2', b]]);
    assert.equal(toggleClassSelection(all, [a, b]).size, 0);
  });

  it('completes the class when it is only partly picked', () => {
    // Not "clear": after hand-picking one person, tapping the class should
    // mean the whole class, not undo the pick.
    const partial = new Map([['u1', a]]);
    const next = toggleClassSelection(partial, [a, b]);
    assert.deepEqual([...next.keys()].sort(), ['u1', 'u2']);
  });

  it('leaves people outside the class alone', () => {
    const other = { userId: 'u9' };
    const next = toggleClassSelection(new Map([['u9', other]]), [a, b]);
    assert.equal(next.has('u9'), true);
  });

  it('does not mutate the map it was given', () => {
    const before = new Map([['u1', a]]);
    toggleClassSelection(before, [a, b]);
    assert.deepEqual([...before.keys()], ['u1']);
  });

  it('does nothing for an empty class rather than reading as fully picked', () => {
    const before = new Map([['u1', a]]);
    const next = toggleClassSelection(before, []);
    assert.deepEqual([...next.keys()], ['u1']);
  });
});

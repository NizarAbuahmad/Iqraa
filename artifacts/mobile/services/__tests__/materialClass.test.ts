/**
 * Naming the class a material belongs to.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/materialClass.test.ts
 *
 * The failure these guard against is not a crash: it is a class row that reads
 * `undefined`, or an English name on an Arabic screen, or — worst — a material
 * still claiming a class the teacher deleted.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { className, classNameFor } from '../materialClass.ts';
import type { ClassGroup } from '../roster.ts';

const make = (over: Partial<ClassGroup>): ClassGroup => ({
  id: 'c1',
  name: '10A',
  nameAr: 'العاشر أ',
  gradeId: '10',
  subjectId: 'mathematics',
  academicYear: '2026',
  createdAt: new Date(0).toISOString(),
  studentCount: 2,
  ...over,
});

describe('className', () => {
  it('uses the name for the active language', () => {
    const c = make({});
    assert.equal(className(c, 'ar'), 'العاشر أ');
    assert.equal(className(c, 'en'), '10A');
  });

  it('falls back rather than rendering an empty row', () => {
    assert.equal(className(make({ nameAr: '' }), 'ar'), '10A');
    assert.equal(className(make({ name: '' }), 'en'), 'العاشر أ');
    // Whitespace is not a name.
    assert.equal(className(make({ nameAr: '   ' }), 'ar'), '10A');
  });

  it('gives an empty string when a class has no name at all', () => {
    assert.equal(className(make({ name: '', nameAr: '' }), 'ar'), '');
  });
});

describe('classNameFor', () => {
  const classes = [make({ id: 'c1' }), make({ id: 'c2', name: '10B', nameAr: 'العاشر ب' })];

  it('names the class a material is filed under', () => {
    assert.equal(classNameFor(classes, 'c2', 'ar'), 'العاشر ب');
    assert.equal(classNameFor(classes, 'c2', 'en'), '10B');
  });

  it('reads an unfiled material as no class', () => {
    assert.equal(classNameFor(classes, null, 'ar'), null);
    assert.equal(classNameFor(classes, undefined, 'ar'), null);
    assert.equal(classNameFor(classes, '', 'ar'), null);
  });

  it('reads a deleted class as no class, not as a stale name', () => {
    assert.equal(classNameFor(classes, 'gone', 'ar'), null);
  });

  it('reads as no class while the roster has not loaded', () => {
    // Server-only roster, so offline this list is empty. A material must not
    // claim a class the screen could not confirm.
    assert.equal(classNameFor([], 'c1', 'ar'), null);
  });

  it('survives a roster call that answered without a class list', () => {
    // `listClasses()` returns `data.classes` unchecked, so a malformed body
    // arrives here as undefined. Found by stubbing the endpoint with a bare
    // array while driving the UI: the workspace list died on `.find`.
    assert.equal(classNameFor(undefined, 'c1', 'ar'), null);
    assert.equal(classNameFor(null, 'c1', 'ar'), null);
  });
});

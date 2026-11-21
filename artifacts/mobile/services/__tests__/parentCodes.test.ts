/**
 * «رموز أولياء الأمور»: the rows, the filter, the printable slips, and the screen's one safety rule (a code is handed
 * to one family at a time, never listed with the others in a message).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  filterRows,
  missingCount,
  normalizeClassCodes,
  parentCodeRows,
  slipsHtml,
  studentName,
  type ParentCodeRow,
} from '../parentCodes.ts';
import type { RosterLink } from '../rosterLinks.ts';

const link = (relation: 'self' | 'guardian'): RosterLink => ({ userId: `u-${relation}`, relation, firstName: 'A', lastName: 'B', linkedAt: '2026-11-01T00:00:00.000Z' });

const STUDENTS = [
  { id: 's1', displayName: 'Ahmad', displayNameAr: 'أحمد', links: [] },
  { id: 's2', displayName: 'Bushra', displayNameAr: '', links: [link('self')] },
  { id: 's3', displayName: 'Jood', displayNameAr: 'جود', links: [link('guardian')] },
];

describe('normalizeClassCodes', () => {
  it('reads codes, and a code-less row as null', () => {
    const out = normalizeClassCodes({
      codes: [
        { studentId: 's1', claimCode: 'ABC234', claimCodeExpiresAt: '2026-12-13T00:00:00.000Z' },
        { studentId: 's2', claimCode: null, claimCodeExpiresAt: null },
        { studentId: 's3', claimCode: '', claimCodeExpiresAt: '2026-12-13T00:00:00.000Z' },
        { claimCode: 'ZZZ222' },
        'nonsense',
      ],
    });
    assert.deepEqual(out, [
      { studentId: 's1', claimCode: 'ABC234', claimCodeExpiresAt: '2026-12-13T00:00:00.000Z' },
      { studentId: 's2', claimCode: null, claimCodeExpiresAt: null },
      { studentId: 's3', claimCode: null, claimCodeExpiresAt: null },
    ]);
  });

  it('a body that is not a list is null, never «no codes» (which would offer to mint)', () => {
    for (const body of [null, {}, { codes: 'x' }, []]) assert.equal(normalizeClassCodes(body), null);
  });
});

describe('parentCodeRows', () => {
  const codes = [{ studentId: 's1', claimCode: 'ABC234', claimCodeExpiresAt: '2026-12-13T00:00:00.000Z' }, { studentId: 'ghost', claimCode: 'GHO222', claimCodeExpiresAt: null }];

  it('follows the roster, joins each code, and says who already has a parent', () => {
    const rows = parentCodeRows(STUDENTS, codes, 'ar');
    assert.deepEqual(rows.map(r => r.studentId), ['s1', 's2', 's3'], 'roster order; a code for nobody on it is dropped');
    assert.equal(rows[0]!.code, 'ABC234');
    assert.equal(rows[1]!.code, null);
    // Only a guardian link counts as «a parent»: the student's own account does not.
    assert.deepEqual(rows.map(r => r.hasParent), [false, false, true]);
  });

  it('names a child in Arabic when recorded, else the roster name', () => {
    assert.equal(studentName(STUDENTS[0]!, 'ar'), 'أحمد');
    assert.equal(studentName(STUDENTS[1]!, 'ar'), 'Bushra');
    assert.equal(studentName(STUDENTS[0]!, 'en'), 'Ahmad');
  });

  it('counts the codes still to mint, and filters to the children with no parent', () => {
    const rows = parentCodeRows(STUDENTS, codes, 'ar');
    assert.equal(missingCount(rows), 2);
    assert.deepEqual(filterRows(rows, 'waiting').map(r => r.studentId), ['s1', 's2']);
    assert.deepEqual(filterRows(rows, 'all').map(r => r.studentId), ['s1', 's2', 's3']);
  });
});

describe('slipsHtml', () => {
  const text = { title: 'T', studentLabel: 'N', codeLabel: 'C', expiresLabel: 'E', howTo: 'H', privateNote: 'P' };
  const rows: ParentCodeRow[] = [
    { studentId: 'a', name: '<b>سارة</b> & "co"', code: 'ABC234', expiresAt: '2026-12-13T00:00:00.000Z', hasParent: false },
    { studentId: 'b', name: 'بلا رمز', code: null, expiresAt: null, hasParent: false },
  ];
  const html = slipsHtml(rows, { lang: 'ar', className: '10A', teacherName: 'أ. ليلى', formatDate: () => '13/12/2026', text });

  it('one slip per child with a code; a child with none gets no slip', () => {
    assert.equal(html.match(/class="slip"/g)?.length, 1);
    assert.doesNotMatch(html, /بلا رمز/);
  });

  it('escapes every roster string', () => {
    assert.match(html, /&lt;b&gt;سارة&lt;\/b&gt; &amp; &quot;co&quot;/);
    assert.doesNotMatch(html, /<b>سارة<\/b>/);
  });

  it('is a right-to-left page in Arabic, and the code sits in a left-to-right box', () => {
    assert.match(html, /<html lang="ar" dir="rtl">/);
    assert.match(html, /<div class="code" dir="ltr">ABC234<\/div>/);
  });
});

describe('the screen hands a code to one family at a time', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const screen = readFileSync(path.resolve(here, '../../app/classes/[id]/parent-codes.tsx'), 'utf8');

  it('composes a message only from one row, never from the list', () => {
    const calls = [...screen.matchAll(/composeClaimCodeMessage\(/g)];
    assert.equal(calls.length, 1);
    const at = screen.indexOf('composeClaimCodeMessage(');
    const send = screen.lastIndexOf('const send = async (r: ParentCodeRow)', at);
    assert.ok(send >= 0 && at - send < 200, 'the only message is built inside `send`, for one row');
    assert.doesNotMatch(screen, /\.map\([^)]*=>\s*r\.code\)\.join|codes\.join|rows\.map\(r => r\.code\)/);
  });

  it('mints through the class route that never overwrites, not the per-student one that does', () => {
    assert.match(screen, /mintClassClaimCodes\(classId\)/);
    assert.doesNotMatch(screen, /generateClaimCode\(/);
  });

  it('follows the shared design rules', () => {
    assert.doesNotMatch(screen, /\bpalette\b/);
    assert.match(screen, /useSurface\(/);
    assert.match(screen, /maxWidth: CONTENT_MAX_WIDTH/);
    assert.doesNotMatch(screen, /'#fff'|"#fff"/);
    for (const el of [...screen.matchAll(/<Ionicons\b[\s\S]*?\/>/g)].map(m => m[0])) assert.match(el, /size=\{ICON\.\w+\}/, el);
    assert.doesNotMatch(screen, /accessibilityState=/);
  });
});

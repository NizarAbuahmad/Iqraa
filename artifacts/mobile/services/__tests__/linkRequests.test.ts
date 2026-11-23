/** Competing join requests: two or more accounts asking for the same roster name. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  arJoinRequestsLine,
  competingCount,
  competingWarning,
  enJoinRequestsLine,
  linkRequestRows,
  type LinkRequestSummary,
} from '../linkRequests.ts';

const reqs = [{ studentId: 'a' }, { studentId: 'b' }, { studentId: 'a' }, { studentId: 'a' }];

describe('competingCount', () => {
  it('counts the requests that ask for the same name', () => {
    assert.equal(competingCount(reqs, 'a'), 3);
    assert.equal(competingCount(reqs, 'b'), 1);
  });
  it('is 0 for a name nobody asked for and for an empty list', () => {
    assert.equal(competingCount(reqs, 'z'), 0);
    assert.equal(competingCount([], 'a'), 0);
  });
});

describe('competingWarning', () => {
  it('warns only when two or more requests compete', () => {
    assert.equal(competingWarning(reqs, 'a'), 3);
    assert.equal(competingWarning(reqs, 'b'), 0);
    assert.equal(competingWarning([{ studentId: 'a' }, { studentId: 'a' }], 'a'), 2);
  });
});

describe("the bell's join-request row", () => {
  const one: LinkRequestSummary = { total: 2, classes: [{ classId: 'c1', name: '10A', nameAr: 'العاشر أ', count: 2 }] };
  const two: LinkRequestSummary = {
    total: 3,
    classes: [
      { classId: 'c1', name: '10A', nameAr: 'العاشر أ', count: 2 },
      { classId: 'c2', name: '9B', nameAr: '', count: 1 },
    ],
  };

  it('gives one row per class, each opening that class', () => {
    assert.deepEqual(linkRequestRows(one, 'ar'), [{ key: 'c1', route: '/classes/c1', className: 'العاشر أ', count: 2 }]);
    assert.deepEqual(linkRequestRows(two, 'en').map(r => [r.route, r.className, r.count]), [
      ['/classes/c1', '10A', 2],
      ['/classes/c2', '9B', 1],
    ]);
  });

  it('falls back to the class name when it has no Arabic one', () => {
    assert.equal(linkRequestRows(two, 'ar')[1]!.className, '9B');
    assert.equal(linkRequestRows({ total: 1, classes: [{ classId: 'c2', name: '9B', nameAr: ' ', count: 1 }] }, 'ar')[0]!.className, '9B');
  });

  it('declines the Arabic count', () => {
    assert.equal(arJoinRequestsLine(1, ''), 'طلب واحد بانتظار موافقتك');
    assert.equal(arJoinRequestsLine(2, 'العاشر أ'), 'طلبان بانتظار موافقتك في العاشر أ');
    assert.equal(arJoinRequestsLine(5, ''), '5 طلبات بانتظار موافقتك');
    assert.equal(arJoinRequestsLine(12, ''), '12 طلبًا بانتظار موافقتك');
    assert.equal(enJoinRequestsLine(1, '10A'), '1 request waiting for your approval in 10A');
  });
});

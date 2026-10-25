/**
 * The «حساب: …» line on a roster row. The pure part: which link is shown, how
 * its name is written, and how its date is formatted.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLinkedOn, linkDisplayName, selfLink, type RosterLink } from '../rosterLinks.ts';

const link = (relation: RosterLink['relation'], firstName: string, lastName = ''): RosterLink => ({
  userId: `${relation}-${firstName}`,
  relation,
  firstName,
  lastName,
  linkedAt: '2026-10-23T12:00:00.000Z',
});

describe('selfLink', () => {
  it('picks the student account, not a parent', () => {
    const got = selfLink([link('guardian', 'ولي أمر', 'خالد'), link('self', 'خالد', 'التيس')]);
    assert.equal(got?.relation, 'self');
  });

  it('is null when only parents are linked, or the server sent no links', () => {
    assert.equal(selfLink([link('guardian', 'ولي أمر')]), null);
    assert.equal(selfLink([]), null);
    assert.equal(selfLink(undefined), null);
  });
});

describe('linkDisplayName', () => {
  it('joins first and last name and collapses stray whitespace', () => {
    assert.equal(linkDisplayName({ firstName: 'خالد', lastName: ' التيس ' }), 'خالد التيس');
  });

  it('has no trailing space for a one-word name', () => {
    assert.equal(linkDisplayName({ firstName: 'ميمي', lastName: '' }), 'ميمي');
  });
});

describe('formatLinkedOn', () => {
  it('writes a short day and month', () => {
    assert.equal(formatLinkedOn('2026-10-23T12:00:00.000Z', 'en'), '23 Oct');
  });

  it('is empty for an unreadable date rather than "Invalid Date"', () => {
    assert.equal(formatLinkedOn('not a date', 'en'), '');
  });
});

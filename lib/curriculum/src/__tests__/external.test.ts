/**
 * The external-resource manifest (`external.ts`).
 *
 * What this guards is not shape for its own sake. Every entry here is
 * somebody else's work, used under a licence someone read on a stated date,
 * and the two ways this goes wrong are both silent: a copy taken under a
 * licence that never granted one, and a credit that never renders. Both look
 * like a working feature.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTERNAL_RESOURCES,
  LICENSE_CHECK_MAX_AGE_DAYS,
  externalResourcesForLesson,
  getExternalResource,
  isLicenseCheckStale,
  isRedistributable,
  validateExternalResources,
  type ExternalResource,
} from '../external.ts';
import { usePolicy } from '../bank.ts';

const base: ExternalResource = {
  id: 'test-resource',
  lessonIds: ['kbl-eng-s1-nccd-u1_l1'],
  kind: 'text',
  titleEn: 'A title',
  titleAr: 'عنوان',
  provider: 'voa',
  license: 'public-domain',
  licenseUrl: 'https://example.invalid/licence',
  sourceUrl: 'https://example.invalid/article',
  attribution: 'Voice of America',
  licenseCheckedAt: '2026-09-10',
  authority: 'third-party',
};

describe('the shipped manifest', () => {
  it('is structurally valid', () => {
    assert.deepEqual(validateExternalResources(), []);
  });

  it('gives every resource a licence that decides its policy', () => {
    // The whole reason this manifest is separate from G10_SOURCES: `authority`
    // is 'third-party' on all of them, which under the old rule alone would
    // make every one reference-only regardless of how freely it was published.
    for (const r of EXTERNAL_RESOURCES) {
      assert.notEqual(usePolicy(r), undefined, r.id);
      if (r.license === 'public-domain') assert.equal(usePolicy(r), 'quotable', r.id);
    }
  });

  it('has not gone stale', () => {
    // Fails loudly when a licence has not been re-read within the window. That
    // is the point: PhET moved its whole library to CC BY-NC on 2026-03-29,
    // and a manifest nobody re-checks is a manifest that is quietly wrong.
    const stale = EXTERNAL_RESOURCES.filter(r => isLicenseCheckStale(r)).map(r => r.id);
    assert.deepEqual(stale, [], `licence check older than ${LICENSE_CHECK_MAX_AGE_DAYS} days`);
  });

  it('never carries a copy it has no right to take', () => {
    for (const r of EXTERNAL_RESOURCES) {
      if (r.ingest) assert.ok(isRedistributable(r), `${r.id} was ingested under ${r.license}`);
    }
  });
});

describe('lookup', () => {
  it('finds resources by lesson id', () => {
    const r = EXTERNAL_RESOURCES[0];
    assert.ok(r, 'manifest is empty — this test proves nothing');
    assert.ok(externalResourcesForLesson(r.lessonIds[0]!).some(x => x.id === r.id));
  });

  it('returns nothing for an unknown or empty lesson', () => {
    assert.deepEqual(externalResourcesForLesson('kbl-does-not-exist'), []);
    assert.deepEqual(externalResourcesForLesson(''), []);
  });

  it('looks a resource up by id', () => {
    const r = EXTERNAL_RESOURCES[0]!;
    assert.equal(getExternalResource(r.id)?.id, r.id);
    assert.equal(getExternalResource('nope'), undefined);
  });
});

describe('validation catches what would ship silently', () => {
  const check = (patch: Partial<ExternalResource>) =>
    validateExternalResources([{ ...base, ...patch }]);

  it('rejects an ingest block under a licence granting no redistribution', () => {
    const errors = check({
      license: 'embed-terms',
      ingest: { r2Key: 'k', sha256: 'abc', bytes: 1, ingestedAt: '2026-09-10' },
    });
    assert.match(errors.join('\n'), /grants no redistribution right/);
  });

  it('rejects a missing attribution, because every licence here requires one', () => {
    assert.match(check({ attribution: '  ' }).join('\n'), /no attribution/);
  });

  it('rejects a lesson anchor that is not a kbl-* id', () => {
    // A title does not identify a lesson, and neither does a unit id.
    assert.match(check({ lessonIds: ['Looking good'] }).join('\n'), /not a kbl-\* lesson id/);
    assert.match(check({ lessonIds: [] }).join('\n'), /attached to no lesson/);
  });

  it('rejects a malformed or missing licence date', () => {
    assert.match(check({ licenseCheckedAt: 'last week' }).join('\n'), /not an ISO date/);
  });

  it('rejects a non-https source', () => {
    assert.match(check({ sourceUrl: 'http://example.invalid/a' }).join('\n'), /must be https/);
  });

  it('catches a duplicate id', () => {
    assert.match(validateExternalResources([base, base]).join('\n'), /duplicate id/);
  });

  it('accepts a well-formed entry', () => {
    assert.deepEqual(check({}), []);
  });
});

describe('licence staleness', () => {
  const at = (iso: string) => ({ licenseCheckedAt: iso });
  const now = new Date('2026-09-10T00:00:00Z');

  it('accepts a check inside the window', () => {
    assert.equal(isLicenseCheckStale(at('2026-09-01'), now), false);
  });

  it('refuses one outside it', () => {
    assert.equal(isLicenseCheckStale(at('2025-01-01'), now), true);
  });

  it('treats an unparseable date as stale, not as fresh', () => {
    // Fails closed: a date nobody can read is not evidence that anybody looked.
    assert.equal(isLicenseCheckStale(at('not-a-date'), now), true);
  });
});

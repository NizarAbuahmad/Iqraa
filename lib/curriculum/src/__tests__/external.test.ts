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
  ingestRefusal,
  isLicenseCheckStale,
  isRedistributable,
  REDISTRIBUTABLE_LICENSES,
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

/**
 * The gate `fetch-external.ts` runs before taking a copy of anything.
 *
 * Ingesting is redistribution, so each refusal here is a case where copying
 * would be the wrong thing to do — and the failure mode of letting one through
 * is a working feature serving material we had no right to serve.
 */
describe('the two licence lists cannot disagree', () => {
  it('treats exactly the redistributable licences as quotable', () => {
    /*
     * `REDISTRIBUTABLE_LICENSES` (here) decides what may be copied into our R2;
     * `POLICY_BY_LICENSE` (bank.ts) decides what may be reproduced in a
     * worksheet. They are different questions with, so far, the same answer —
     * and they are maintained in two files, so adding a licence to one and
     * forgetting the other is a matter of time.
     *
     * Getting it wrong is silent in the direction that matters: a licence
     * marked redistributable but not quotable would have its bytes copied and
     * then be refused at the point of use, which reads as a broken feature
     * rather than a licence decision.
     */
    for (const license of REDISTRIBUTABLE_LICENSES) {
      assert.equal(
        usePolicy({ authority: 'third-party', license }),
        'quotable',
        `${license} is redistributable but not quotable`,
      );
    }
  });
});

describe('ingest refusal', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const ok: ExternalResource = { ...base, fetchUrl: 'https://example.invalid/a.mp3' };

  it('permits a fresh, openly-licensed resource with a named asset', () => {
    assert.equal(ingestRefusal(ok, now), null);
  });

  it('refuses a licence that grants no redistribution right', () => {
    for (const license of ['embed-terms', 'CC-BY-SA-4.0'] as const) {
      assert.match(
        ingestRefusal({ ...ok, license }, now) ?? '',
        /grants no redistribution right/,
        license,
      );
    }
  });

  it('refuses a stale licence check', () => {
    // The PhET case exactly: accurate when written, wrong a week later.
    const stale = { ...ok, licenseCheckedAt: '2025-01-01' };
    assert.match(ingestRefusal(stale, now) ?? '', /licence last checked/);
  });

  it('refuses an unparseable licence date without claiming it is old', () => {
    const bad = ingestRefusal({ ...ok, licenseCheckedAt: 'whenever' }, now) ?? '';
    assert.match(bad, /unparseable date/);
    assert.doesNotMatch(bad, /NaN/);
  });

  it('refuses to guess the asset from the article page', () => {
    const { fetchUrl: _drop, ...noFetch } = ok;
    assert.match(ingestRefusal(noFetch, now) ?? '', /never inferred from the page/);
  });

  it('refuses a non-https asset', () => {
    assert.match(ingestRefusal({ ...ok, fetchUrl: 'http://x.invalid/a.mp3' }, now) ?? '', /not https/);
  });

  it('checks the licence before the mechanics', () => {
    // Order matters for the message a person reads: a CC-BY-NC resource with
    // no fetchUrl should say the licence forbids copying, not that a field is
    // missing — fixing the field would not make it fetchable.
    const both = { ...ok, license: 'embed-terms' as const, fetchUrl: undefined };
    assert.match(ingestRefusal(both, now) ?? '', /grants no redistribution right/);
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

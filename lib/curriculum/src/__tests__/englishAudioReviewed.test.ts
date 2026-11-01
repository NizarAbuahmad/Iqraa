import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { audioPlan } from '../englishAudioPlan.ts';
import { REVIEWED_BY_EAR } from '../englishAudioReviewed.ts';

describe('REVIEWED_BY_EAR', () => {
  it('names only recordings the app plays, and each by a quoted MD5 ETag', () => {
    const slugs = new Set(audioPlan().map(i => i.slug));
    for (const [slug, etag] of Object.entries(REVIEWED_BY_EAR)) {
      assert.ok(slugs.has(slug), `${slug} is not in audioPlan()`);
      assert.match(etag, /^"[0-9a-f]{32}"$/, `${slug}: ${etag}`);
    }
  });
  it('holds the 24 words heard on 2026-10-31, none twice', () => {
    assert.equal(Object.keys(REVIEWED_BY_EAR).length, 24);
    assert.equal(new Set(Object.values(REVIEWED_BY_EAR)).size, 24);
  });
});

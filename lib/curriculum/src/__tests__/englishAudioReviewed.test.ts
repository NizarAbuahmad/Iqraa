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
  // 24 were heard on 2026-10-31; 'been' and 'burned' left on 2026-11-15 with the irregular-verbs rows they came from.
  it('holds the 22 words heard on 2026-10-31 that the app still plays, none twice', () => {
    assert.equal(Object.keys(REVIEWED_BY_EAR).length, 22);
    assert.equal(new Set(Object.values(REVIEWED_BY_EAR)).size, 22);
  });
});

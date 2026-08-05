import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSupportResourcesBlock,
  searchSupportResources,
  supportResourcesStats,
} from '../mathSupportResources.ts';

describe('mathSupportResources', () => {
  it('loads math + chemistry catalogs', () => {
    const stats = supportResourcesStats();
    assert.ok(stats.total >= 50);
    assert.ok((stats.bySubject.mathematics ?? 0) >= 30);
    assert.ok((stats.bySubject.chemistry ?? 0) >= 20);
    assert.ok((stats.byType.worksheet ?? 0) >= 1);
    assert.ok((stats.byType.quiz ?? 0) >= 1);
  });

  it('finds circle worksheets by query', () => {
    const hits = searchSupportResources({ query: 'ورقة عمل الدائرة', limit: 5 });
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => /دائر/.test(h.titleAr)));
  });

  it('finds chemistry Bohr worksheets', () => {
    const hits = searchSupportResources({
      query: 'ورقة عمل نظرية بور كيمياء',
      subjectId: 'chemistry',
      limit: 5,
    });
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => /بور|كيمياء/.test(h.titleAr)));
  });

  it('formats an Arabic block', () => {
    const hits = searchSupportResources({ query: 'الدائرة', limit: 2 });
    const block = formatSupportResourcesBlock(hits, 'ar');
    assert.match(block, /مواد مساندة/);
  });
});

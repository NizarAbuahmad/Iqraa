/**
 * The unified resource view-model (`resourceCatalog.ts`).
 *
 * The resources tab shows four unrelated things in one list — frozen practice
 * sheets, classroom activities, licensed third-party media, and the QR codes
 * printed in the NCCD books — and every one of them arrives in a different
 * shape from a different place. What this guards is the seam:
 *
 * - a key that collides across sources silently drops a row from a keyed list;
 * - an action offered on the wrong kind is a dead button (printing a video) or
 *   a broken promise (attaching something with nothing to attach);
 * - an attribution dropped in the adapter is a licence breach that renders as
 *   a perfectly ordinary row.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addToClassPlan,
  buildResourceCatalog,
  filterResources,
  groupBySource,
  type ResourceCatalogInput,
} from '../resourceCatalog.ts';

const input: ResourceCatalogInput = {
  premade: [
    {
      id: 'pw-kbl-math-s1-nccd-u1_l1-medium',
      lessonId: 'kbl-math-s1-nccd-u1_l1',
      gradeId: 'grade-10',
      subjectId: 'mathematics',
      level: 'medium',
      titleAr: 'حل نظام مكوَّن من معادلة خطية ومعادلة تربيعية',
      titleEn: 'Solving a linear-quadratic system',
      content: { title: 'ورقة عمل', instructions: '', sections: [], answerKey: [] },
      keyVerification: [],
      generatedAt: '2026-09-15T00:00:00.000Z',
      promptVersion: 'v1',
      model: 'test',
    },
  ],
  activities: [{ id: 'bingo', titleAr: 'بينغو', titleEn: 'Bingo' }],
  external: [
    {
      id: 'voa-le-plastic-oceans',
      lessonIds: ['kbl-math-s1-nccd-u1_l1'],
      kind: 'video',
      titleEn: 'Plastic oceans',
      titleAr: 'المحيطات البلاستيكية',
      attribution: 'Voice of America, public domain',
      sourceUrl: 'https://example.invalid/oceans',
    },
    {
      id: 'phet-thing',
      lessonIds: [],
      kind: 'simulation',
      titleEn: 'A simulation',
      titleAr: 'محاكاة',
      attribution: 'PhET',
      sourceUrl: 'https://example.invalid/sim',
    },
  ] as ResourceCatalogInput['external'],
  qr: [
    {
      title: 'الرياضيات — الفصل الأول',
      subjectId: 'mathematics',
      resources: [
        { kind: 'video', url: 'https://example.invalid/v1', pdfPage: 12, isHttp: false },
        { kind: 'audio', url: 'https://example.invalid/a1', pdfPage: 31, isHttp: true },
      ],
    },
  ],
};

describe('building the catalog', () => {
  it('gives every item a key unique across all four sources', () => {
    const keys = buildResourceCatalog(input).map(item => item.key);
    assert.equal(new Set(keys).size, keys.length, 'a key collided');
  });

  it('namespaces each key by its source', () => {
    for (const item of buildResourceCatalog(input)) {
      assert.ok(item.key.startsWith(`${item.source}:`), `${item.key} is not namespaced`);
    }
  });

  it('offers a pre-made sheet for printing and for a class', () => {
    const sheet = buildResourceCatalog(input).find(i => i.source === 'premade-sheet');
    assert.ok(sheet, 'no sheet in the catalog');
    assert.equal(sheet.kind, 'worksheet');
    assert.deepEqual([...sheet.actions].sort(), ['add-to-class', 'print']);
    assert.equal(sheet.lessonId, 'kbl-math-s1-nccd-u1_l1');
  });

  it('runs a game rather than printing it', () => {
    const game = buildResourceCatalog(input).find(i => i.source === 'activity');
    assert.ok(game, 'no activity in the catalog');
    assert.equal(game.kind, 'game');
    assert.ok(game.actions.includes('run'));
    assert.ok(!game.actions.includes('print'), 'a game is not a worksheet');
  });

  it('carries a licence attribution through verbatim', () => {
    const media = buildResourceCatalog(input).find(i => i.source === 'curriculum-media');
    assert.ok(media, 'no curated media in the catalog');
    assert.equal(media.attribution, 'Voice of America, public domain');
  });

  it('drops simulations, which there is no lawful way to embed', () => {
    const sim = buildResourceCatalog(input).find(i => i.key.includes('phet-thing'));
    assert.equal(sim, undefined, 'a simulation reached the catalog');
  });

  it('offers only opening for the book QR rows', () => {
    const rows = buildResourceCatalog(input).filter(i => i.source === 'book-qr');
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.deepEqual(row.actions, ['open'], 'the ministry host cannot be embedded');
      assert.ok(row.url, 'a QR row with no url is a dead row');
      assert.ok(typeof row.page === 'number', 'the printed page is the locator');
    }
  });

  it('carries the insecure-link flag per row, so the warning can be shown per row', () => {
    const rows = buildResourceCatalog(input).filter(i => i.source === 'book-qr');
    assert.equal(rows.find(r => r.page === 31)?.insecure, true);
    assert.equal(rows.find(r => r.page === 12)?.insecure, false);
  });

  it('never offers an action it cannot carry out', () => {
    for (const item of buildResourceCatalog(input)) {
      if (item.actions.includes('open')) assert.ok(item.url, `${item.key} opens nothing`);
      if (item.actions.includes('add-to-class')) {
        assert.ok(addToClassPlan(item).length > 0, `${item.key} has no way to attach`);
      }
    }
  });
});

describe('filtering', () => {
  it('filters by kind', () => {
    for (const item of filterResources(buildResourceCatalog(input), { kinds: ['video'] })) {
      assert.equal(item.kind, 'video');
    }
  });

  it('filters by source', () => {
    const only = filterResources(buildResourceCatalog(input), { sources: ['book-qr'] });
    assert.equal(only.length, 2);
  });

  it('filters by lesson id, and returns nothing for an unknown lesson', () => {
    const items = buildResourceCatalog(input);
    const forLesson = filterResources(items, { lessonId: 'kbl-math-s1-nccd-u1_l1' });
    assert.ok(forLesson.length >= 2, 'the sheet and the curated video are both on this lesson');
    for (const item of forLesson) assert.equal(item.lessonId, 'kbl-math-s1-nccd-u1_l1');
    assert.deepEqual(filterResources(items, { lessonId: 'kbl-nope' }), []);
  });

  it('matches a query against either language', () => {
    const items = buildResourceCatalog(input);
    assert.ok(filterResources(items, { query: 'Bingo' }).length === 1);
    assert.ok(filterResources(items, { query: 'بينغو' }).length === 1);
    assert.deepEqual(filterResources(items, { query: 'zzzz' }), []);
  });

  it('combines filters rather than replacing them', () => {
    const items = buildResourceCatalog(input);
    const both = filterResources(items, { sources: ['book-qr'], kinds: ['audio'] });
    assert.equal(both.length, 1);
    assert.equal(both[0]?.kind, 'audio');
  });
});

describe('grouping', () => {
  it('keeps every item and drops sources with nothing in them', () => {
    const items = buildResourceCatalog(input);
    const groups = groupBySource(items);
    assert.equal(groups.reduce((n, g) => n + g.items.length, 0), items.length);
    assert.ok(!groups.some(g => g.items.length === 0), 'an empty section would render as a bare heading');
  });

  it('orders sections so the teacher sees ready-to-use material first', () => {
    const order = groupBySource(buildResourceCatalog(input)).map(g => g.source);
    assert.deepEqual(order, ['premade-sheet', 'activity', 'curriculum-media', 'book-qr']);
  });
});

describe('what "add to class" has to write', () => {
  it('materialises a teacher-owned copy of a sheet, then attaches it', () => {
    assert.deepEqual(addToClassPlan({ source: 'premade-sheet' } as never), [
      'save-material',
      'attach-material',
    ]);
  });

  it('files an activity the same way', () => {
    assert.deepEqual(addToClassPlan({ source: 'activity' } as never), [
      'save-material',
      'attach-material',
    ]);
  });

  it('cannot attach third-party media yet, and says so by returning nothing', () => {
    // saveLibraryLink lives on the unmerged media-library branch. Until it
    // lands there is no teacher-owned row to hang a class on, so these sources
    // offer `open` only — see the plan's 2026-09-15 revision.
    assert.deepEqual(addToClassPlan({ source: 'curriculum-media' } as never), []);
    assert.deepEqual(addToClassPlan({ source: 'book-qr' } as never), []);
  });
});

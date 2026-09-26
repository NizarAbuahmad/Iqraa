/**
 * The library view-model (`resourceCatalog.ts`): staff uploads, ready-made
 * sheets and book QR codes in one list. What this guards is the seam — a key
 * that collides drops a row, an action on the wrong kind is a dead button, and
 * an upload filed under the wrong grade or category is invisible.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addToClassPlan,
  buildResourceCatalog,
  filterResources,
  groupIntoShelves,
  shelfOf,
  type ResourceCatalogInput,
} from '../resourceCatalog.ts';
import type { LibraryItem } from '../libraryApi.ts';

const upload = (patch: Partial<LibraryItem>): LibraryItem => ({
  id: 'u1',
  gradeId: 'grade-5',
  subjectId: 'science',
  lessonId: 'kbl-g5-science-s1-nccd-u1_l1',
  category: 'infographic',
  titleAr: 'شبكة غذائية',
  description: '',
  mimeType: 'image/png',
  sizeBytes: 1000,
  isLink: false,
  url: 'https://pub.example/library/u1.png',
  createdAt: '2026-09-25T00:00:00Z',
  ...patch,
});

const input: ResourceCatalogInput = {
  uploaded: [
    upload({}),
    upload({ id: 'u2', category: 'video', isLink: true, url: 'https://www.youtube.com/watch?v=x', lessonId: null }),
    upload({ id: 'u3', subjectId: 'arabic', category: 'audio', lessonId: null }),
    upload({ id: 'u5', category: 'image' }),
    upload({ id: 'u4', url: null }),
  ],
  premade: [
    {
      id: 'pw-kbl-math-s1-nccd-u1_l1-medium',
      lessonId: 'kbl-math-s1-nccd-u1_l1',
      gradeId: 'grade-10',
      subjectId: 'mathematics',
      level: 'medium',
      titleAr: 'حل نظام',
      titleEn: 'Solving a system',
      content: { title: 'ورقة عمل', instructions: '', sections: [], answerKey: [] },
      keyVerification: [],
      generatedAt: '2026-09-15T00:00:00.000Z',
      promptVersion: 'v1',
      model: 'test',
    },
  ],
  qr: [
    {
      title: 'العلوم — الفصل الأول',
      subjectId: 'science',
      resources: [
        { kind: 'video', url: 'https://example.invalid/v1', pdfPage: 12, isHttp: false },
        { kind: 'audio', url: 'http://example.invalid/a1', pdfPage: 31, isHttp: true },
      ],
    },
  ],
};

describe('building the catalog', () => {
  it('gives every item a key unique across all sources, namespaced by source', () => {
    const items = buildResourceCatalog(input);
    const keys = items.map(i => i.key);
    assert.equal(new Set(keys).size, keys.length, 'a key collided');
    for (const item of items) assert.ok(item.key.startsWith(`${item.source}:`));
  });

  it('files an upload under its own category, opening its file or link', () => {
    const items = buildResourceCatalog(input);
    const info = items.find(i => i.key === 'uploaded:u1');
    assert.equal(info?.kind, 'infographic');
    assert.deepEqual(info?.actions, ['open']);
    assert.equal(items.find(i => i.key === 'uploaded:u2')?.url, 'https://www.youtube.com/watch?v=x');
  });

  it('drops an upload with no URL rather than rendering a dead row', () => {
    assert.equal(buildResourceCatalog(input).find(i => i.key === 'uploaded:u4'), undefined);
  });

  it('offers a pre-made sheet for printing and for a class', () => {
    const sheet = buildResourceCatalog(input).find(i => i.source === 'premade-sheet');
    assert.deepEqual([...(sheet?.actions ?? [])].sort(), ['add-to-class', 'print']);
  });

  it('carries the insecure-link flag per book-QR row', () => {
    const rows = buildResourceCatalog(input).filter(i => i.source === 'book-qr');
    assert.equal(rows.find(r => r.page === 31)?.insecure, true);
    assert.equal(rows.find(r => r.page === 12)?.insecure, false);
  });

  it('never offers an action it cannot carry out', () => {
    for (const item of buildResourceCatalog(input)) {
      if (item.actions.includes('open')) assert.ok(item.url, `${item.key} opens nothing`);
      if (item.actions.includes('add-to-class')) assert.ok(addToClassPlan(item).length > 0, item.key);
    }
  });
});

describe('filtering', () => {
  it('filters by grade', () => {
    const g5 = filterResources(buildResourceCatalog(input), { gradeId: 'grade-5' }).map(i => i.key);
    assert.ok(g5.includes('uploaded:u1'));
    assert.ok(!g5.includes('premade-sheet:pw-kbl-math-s1-nccd-u1_l1-medium'), 'a grade 10 sheet leaked into grade 5');
  });

  it('filters by subject, keeping rows with no subject', () => {
    const sci = filterResources(buildResourceCatalog(input), { subjectId: 'science' }).map(i => i.key);
    assert.ok(sci.includes('uploaded:u1'));
    assert.ok(!sci.includes('uploaded:u3'));
  });

  it('filters by category and by lesson', () => {
    const items = buildResourceCatalog(input);
    assert.deepEqual(filterResources(items, { kinds: ['video'], sources: ['uploaded'] }).map(i => i.key), ['uploaded:u2']);
    for (const item of filterResources(items, { lessonId: 'kbl-g5-science-s1-nccd-u1_l1' })) {
      assert.equal(item.lessonId, 'kbl-g5-science-s1-nccd-u1_l1');
    }
  });
});

describe('shelves (one tile per kind)', () => {
  it('puts every item on exactly one shelf, in display order, dropping empty shelves', () => {
    const items = buildResourceCatalog(input);
    const shelves = groupIntoShelves(items);
    assert.deepEqual(shelves.map(s => s.shelf), ['infographic', 'image', 'video', 'audio', 'worksheet', 'book-qr']);
    const total = shelves.reduce((n, s) => n + s.items.length, 0);
    assert.equal(total, items.length, 'an item fell off every shelf');
  });

  it('merges uploaded and ready-made worksheets onto one shelf', () => {
    const items = buildResourceCatalog({ ...input, uploaded: [...input.uploaded, upload({ id: 'w1', category: 'worksheet' })] });
    const ws = groupIntoShelves(items).find(s => s.shelf === 'worksheet')!;
    assert.deepEqual(ws.items.map(i => i.source).sort(), ['premade-sheet', 'uploaded']);
  });

  it('keeps book codes together on their own shelf whatever their kind', () => {
    assert.equal(shelfOf({ source: 'book-qr', kind: 'video' }), 'book-qr');
    assert.equal(shelfOf({ source: 'uploaded', kind: 'video' }), 'video');
  });
});

describe('what "add to class" has to write', () => {
  it('materialises a teacher-owned copy of a sheet, and cannot attach shared links', () => {
    assert.deepEqual(addToClassPlan({ source: 'premade-sheet' }), ['save-material', 'attach-material']);
    assert.deepEqual(addToClassPlan({ source: 'uploaded' }), []);
    assert.deepEqual(addToClassPlan({ source: 'book-qr' }), []);
  });
});

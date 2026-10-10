/**
 * The library view-model (`resourceCatalog.ts`): staff uploads, ready-made
 * sheets and book QR codes in one list. What this guards is the seam — a key
 * that collides drops a row, an action on the wrong kind is a dead button, and
 * an upload filed under the wrong grade or category is invisible.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
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
  semester: null,
  thumbnailUrl: null,
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

  it('offers a pre-made sheet for printing only — putting it on a class happens inside the class', () => {
    const sheet = buildResourceCatalog(input).find(i => i.source === 'premade-sheet');
    assert.deepEqual([...(sheet?.actions ?? [])].sort(), ['print']);
  });

  it('carries the insecure-link flag per book-QR row', () => {
    const rows = buildResourceCatalog(input).filter(i => i.source === 'book-qr');
    assert.equal(rows.find(r => r.page === 31)?.insecure, true);
    assert.equal(rows.find(r => r.page === 12)?.insecure, false);
  });

  it('never offers an action it cannot carry out', () => {
    for (const item of buildResourceCatalog(input)) {
      if (item.actions.includes('open')) assert.ok(item.url, `${item.key} opens nothing`);
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

  it('filters by a list of subjects, keeping rows with no subject', () => {
    const keys = (subjectIds: string[]) =>
      filterResources(buildResourceCatalog(input), { subjectIds }).map(i => i.key);
    const both = keys(['science', 'arabic']);
    assert.ok(both.includes('uploaded:u1') && both.includes('uploaded:u3'), 'a class teaching both lost one');
    assert.ok(!keys(['arabic']).includes('uploaded:u1'));
    assert.deepEqual(keys([]), filterResources(buildResourceCatalog(input), {}).map(i => i.key), 'empty list must mean no filter');
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
    assert.deepEqual(shelves.map(s => s.shelf), ['infographic', 'image', 'video', 'audio', 'worksheet']);
    const total = shelves.reduce((n, s) => n + s.items.length, 0);
    assert.equal(total, items.length, 'an item fell off every shelf');
  });

  it('merges uploaded and ready-made worksheets onto one shelf', () => {
    const items = buildResourceCatalog({ ...input, uploaded: [...input.uploaded, upload({ id: 'w1', category: 'worksheet' })] });
    const ws = groupIntoShelves(items).find(s => s.shelf === 'worksheet')!;
    assert.deepEqual(ws.items.map(i => i.source).sort(), ['premade-sheet', 'uploaded']);
  });

  it('files a book code on the shelf of what it opens, not on a shelf of its own', () => {
    assert.equal(shelfOf({ source: 'book-qr', kind: 'video' }), 'video');
    assert.equal(shelfOf({ source: 'book-qr', kind: 'audio' }), 'audio');
    assert.equal(shelfOf({ source: 'book-qr', kind: 'image' }), 'image');
    assert.equal(shelfOf({ source: 'book-qr', kind: 'document' }), 'document');
    assert.equal(shelfOf({ source: 'uploaded', kind: 'video' }), 'video');
  });

  it('files a web-page book code under documents — it has no shelf of its own', () => {
    assert.equal(shelfOf({ source: 'book-qr', kind: 'page' }), 'document');
  });

  it('lists book codes after the staff uploads of the same shelf', () => {
    const videos = groupIntoShelves(buildResourceCatalog(input)).find(s => s.shelf === 'video')!;
    assert.deepEqual(videos.items.map(i => i.source), ['uploaded', 'book-qr']);
  });
});

describe('searching', () => {
  const items = buildResourceCatalog(input);
  const keys = (query: string) => filterResources(items, { query }).map(i => i.key);

  it('matches a title regardless of hamza, taa marbuta and harakat', () => {
    assert.deepEqual(keys('شبكة غذائية'), ['uploaded:u1', 'uploaded:u2', 'uploaded:u3', 'uploaded:u5']);
    assert.ok(keys('شَبَكَة').includes('uploaded:u1'));
    const hamza = buildResourceCatalog({
      ...input,
      uploaded: [upload({ id: 'h1', titleAr: 'الاقترانات' })],
    });
    assert.deepEqual(filterResources(hamza, { query: 'الإقترانات', gradeId: 'grade-5' }).map(i => i.key), ['uploaded:h1']);
  });

  it('matches the book a code is printed in, since that is the only name it has', () => {
    assert.deepEqual(keys('الفصل الأول'), ['book-qr:12:https://example.invalid/v1', 'book-qr:31:http://example.invalid/a1']);
  });

  it('still finds a titled book code by the name of its book', () => {
    // A code that carries its own page title headlines with that title, and the
    // book name moves to `bookTitle`. Searching only the headline made every
    // titled code unreachable by its book, which is what a teacher types.
    const titled = buildResourceCatalog({
      ...input,
      qr: [
        {
          title: 'كتاب الطالب لمادة التربية الإسلامية للصف العاشر',
          subjectId: 'islamic',
          resources: [{ kind: 'page', url: 'https://example.invalid/p', pdfPage: 70, isHttp: false, title: 'الباحث الحديث' }],
        },
      ],
    });
    const found = (query: string) => filterResources(titled, { query }).map(i => i.key);
    assert.deepEqual(found('الباحث'), ['book-qr:70:https://example.invalid/p']);
    assert.deepEqual(found('التربية الإسلامية'), ['book-qr:70:https://example.invalid/p']);
  });

  it('matches the description, which is where a staff upload says what it is for', () => {
    const withNote = buildResourceCatalog({
      ...input,
      uploaded: [upload({ id: 'n1', titleAr: 'عرض', description: 'مراجعة قبل الاختبار' })],
    });
    assert.deepEqual(filterResources(withNote, { query: 'مراجعه' }).map(i => i.key), ['uploaded:n1']);
  });

  it('matches the printed page of a book code, in Arabic or Latin digits, with or without the word', () => {
    const page12 = ['book-qr:12:https://example.invalid/v1'];
    const page31 = ['book-qr:31:http://example.invalid/a1'];
    assert.deepEqual(keys('12'), page12);
    assert.deepEqual(keys('١٢'), page12);
    assert.deepEqual(keys('صفحة 12'), page12);
    assert.deepEqual(keys('صفحة ٣١'), page31);
    assert.deepEqual(keys('page 31'), page31);
  });

  it('does not give an upload or a sheet a page it never had', () => {
    assert.deepEqual(keys('صفحة'), ['book-qr:12:https://example.invalid/v1', 'book-qr:31:http://example.invalid/a1']);
  });

  it('ignores a blank query and combines with the other filters', () => {
    assert.equal(filterResources(items, { query: '   ' }).length, items.length);
    assert.deepEqual(
      filterResources(items, { query: 'شبكة', kinds: ['video'] }).map(i => i.key),
      ['uploaded:u2'],
    );
  });
});

describe('naming a book code', () => {
  const qrOnly = (resources: ResourceCatalogInput['qr'][number]['resources']): ResourceCatalogInput => ({
    uploaded: [],
    premade: [],
    qr: [{ title: 'كتاب الطالب — التربية الوطنية', subjectId: 'civic-education', resources }],
  });

  it('names a code by what it opens when the manifest says, and keeps the book for the line below', () => {
    const [row] = buildResourceCatalog(
      qrOnly([{ kind: 'page', url: 'https://example.invalid/a', pdfPage: 24, isHttp: false, title: 'الدستور الأردني' }]),
    );
    assert.equal(row.titleAr, 'الدستور الأردني');
    assert.equal(row.titleEn, 'الدستور الأردني');
    assert.equal(row.bookTitle, 'كتاب الطالب — التربية الوطنية');
  });

  it('falls back to the book when nobody has read the link', () => {
    const [row] = buildResourceCatalog(
      qrOnly([{ kind: 'page', url: 'https://example.invalid/b', pdfPage: 52, isHttp: false }]),
    );
    assert.equal(row.titleAr, 'كتاب الطالب — التربية الوطنية');
    assert.equal(row.bookTitle, row.titleAr);
  });

  it('finds a code by its own title, not only by its book', () => {
    const rows = buildResourceCatalog(
      qrOnly([
        { kind: 'page', url: 'https://example.invalid/a', pdfPage: 24, isHttp: false, title: 'الجمعية الفلكية الأردنية' },
        { kind: 'page', url: 'https://example.invalid/b', pdfPage: 52, isHttp: false },
      ]),
    );
    assert.deepEqual(
      filterResources(rows, { query: 'الفلكية' }).map(r => r.page),
      [24],
    );
  });
});

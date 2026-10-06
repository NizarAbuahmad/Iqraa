/**
 * The pure half of a class's Resources tab: how teacher materials and Library
 * resources merge into one list, what "already added" means, what the app sends
 * to add an item, and where a tap on a row goes.
 *
 * Runs with `pnpm test` in artifacts/mobile.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addBodyFor,
  addedKeys,
  isInsecureResource,
  mergeClassShelf,
  openTargetFor,
  withAddedResource,
  type ClassResource,
} from '../classResources.ts';
import { buildResourceCatalog, type ResourceItem } from '../resourceCatalog.ts';
import type { SavedMaterial } from '../workspace.ts';

const material = (id: string, savedAt: string): SavedMaterial => ({
  id,
  type: 'worksheet',
  title: `m-${id}`,
  subject: '',
  grade: '',
  topic: '',
  language: 'ar',
  savedAt,
  isFavorite: false,
  content: '{}',
  formState: {},
});

const resource = (patch: Partial<ClassResource> & { id: string }): ClassResource => ({
  kind: 'library',
  source: 'uploaded',
  nativeId: patch.id,
  title: `r-${patch.id}`,
  mediaKind: 'video',
  url: 'https://example.test/v',
  thumbnailUrl: null,
  createdAt: '2026-10-04T10:00:00.000Z',
  unavailable: false,
  ...patch,
});

const item = (patch: Partial<ResourceItem>): ResourceItem => ({
  key: 'uploaded:u1',
  source: 'uploaded',
  nativeId: 'u1',
  kind: 'video',
  titleAr: 'عنوان',
  titleEn: 'Title',
  actions: ['open'],
  ...patch,
});

describe('mergeClassShelf', () => {
  it('puts the newest first, whichever kind it is', () => {
    const shelf = mergeClassShelf(
      [material('old', '2026-10-01T08:00:00.000Z'), material('new', '2026-10-04T08:00:00.000Z')],
      [resource({ id: 'mid', createdAt: '2026-10-03T08:00:00.000Z' })],
    );
    assert.deepEqual(shelf.map(e => e.key), ['material:new', 'resource:mid', 'material:old']);
  });

  it('keeps a material ahead of a resource added at the same instant', () => {
    const at = '2026-10-04T08:00:00.000Z';
    const shelf = mergeClassShelf([material('m', at)], [resource({ id: 'r', createdAt: at })]);
    assert.deepEqual(shelf.map(e => e.key), ['material:m', 'resource:r']);
  });

  it('sends an unreadable timestamp to the end rather than scrambling the order', () => {
    const shelf = mergeClassShelf(
      [material('bad', 'not a date'), material('good', '2026-10-04T08:00:00.000Z')],
      [],
    );
    assert.deepEqual(shelf.map(e => e.key), ['material:good', 'material:bad']);
  });

  it('keys a material and a resource with the same id apart', () => {
    const shelf = mergeClassShelf([material('x', '2026-10-04T08:00:00.000Z')], [resource({ id: 'x' })]);
    assert.equal(new Set(shelf.map(e => e.key)).size, 2);
  });

  it('is empty for an empty class', () => {
    assert.deepEqual(mergeClassShelf([], []), []);
  });
});

describe('addedKeys', () => {
  // Built by the real catalogue, one item per source, so this fails if the
  // `<source>:<nativeId>` format drifts between resourceCatalog.ts and here.
  const catalogue = buildResourceCatalog({
    uploaded: [
      {
        id: 'u1',
        gradeId: 'grade-5',
        subjectId: 'science',
        lessonId: null,
        category: 'video',
        titleAr: 'فيديو',
        description: '',
        mimeType: 'video/mp4',
        sizeBytes: 1000,
        isLink: false,
        url: 'https://pub.example/library/u1.mp4',
        semester: null,
        thumbnailUrl: null,
        createdAt: '2026-09-25T00:00:00Z',
      },
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
        resources: [{ kind: 'audio', url: 'http://example.invalid/a1', pdfPage: 31, isHttp: true }],
      },
    ],
  });

  it('matches the key the Library catalogue gives the same item', () => {
    assert.deepEqual(catalogue.map(i => i.source).sort(), ['book-qr', 'premade-sheet', 'uploaded']);
    const onShelf = catalogue.map((item, i) =>
      resource({ id: `r${i}`, source: item.source, nativeId: item.nativeId }),
    );
    const added = addedKeys(onShelf);
    for (const item of catalogue) assert.ok(added.has(item.key), `${item.key} not recognised as added`);
    assert.equal(added.size, catalogue.length);
  });

  it('does not match an item that is not on the shelf', () => {
    const onShelf = catalogue.filter(i => i.source === 'uploaded').map(i =>
      resource({ id: 'r', source: i.source, nativeId: i.nativeId }),
    );
    const added = addedKeys(onShelf);
    for (const item of catalogue.filter(i => i.source !== 'uploaded')) assert.ok(!added.has(item.key));
  });
});

describe('addBodyFor', () => {
  it('sends a staff upload by id alone — the server copies the rest from its own row', () => {
    assert.deepEqual(addBodyFor(item({ source: 'uploaded', nativeId: 'u1', url: 'https://example.test/v' }), 'ar'), {
      kind: 'library',
      source: 'uploaded',
      nativeId: 'u1',
    });
  });

  it('snapshots a premade sheet in the active language, with no url', () => {
    const sheet = item({
      key: 'premade-sheet:pw-demo',
      source: 'premade-sheet',
      nativeId: 'pw-demo',
      kind: 'worksheet',
      titleAr: 'ورقة',
      titleEn: 'Sheet',
      actions: ['print'],
    });
    assert.deepEqual(addBodyFor(sheet, 'ar'), {
      kind: 'library',
      source: 'premade-sheet',
      nativeId: 'pw-demo',
      title: 'ورقة',
      mediaKind: 'worksheet',
    });
    assert.equal(addBodyFor(sheet, 'en').title, 'Sheet');
  });

  it('falls back to the Arabic title when there is no English one', () => {
    const sheet = item({ source: 'premade-sheet', nativeId: 'p', kind: 'worksheet', titleAr: 'ورقة', titleEn: '' });
    assert.equal(addBodyFor(sheet, 'en').title, 'ورقة');
  });

  it('carries a book-QR code with its link and page in title (Arabic)', () => {
    const code = item({
      key: 'book-qr:31:http://example.test/a',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      kind: 'page',
      url: 'http://example.test/a',
      page: 31,
    });
    assert.deepEqual(addBodyFor(code, 'ar'), {
      kind: 'library',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      title: 'عنوان — صفحة ٣١',
      mediaKind: 'page',
      url: 'http://example.test/a',
    });
  });

  it('carries a book-QR code with its link and page in title (English)', () => {
    const code = item({
      key: 'book-qr:31:http://example.test/a',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      kind: 'page',
      titleAr: 'عنوان',
      titleEn: 'Title',
      url: 'http://example.test/a',
      page: 31,
    });
    assert.deepEqual(addBodyFor(code, 'en'), {
      kind: 'library',
      source: 'book-qr',
      nativeId: '31:http://example.test/a',
      title: 'Title — Page 31',
      mediaKind: 'page',
      url: 'http://example.test/a',
    });
  });

  it('carries a book-QR code without a page as plain title', () => {
    const code = item({
      key: 'book-qr:http://example.test/b',
      source: 'book-qr',
      nativeId: 'http://example.test/b',
      kind: 'page',
      url: 'http://example.test/b',
    });
    assert.deepEqual(addBodyFor(code, 'ar'), {
      kind: 'library',
      source: 'book-qr',
      nativeId: 'http://example.test/b',
      title: 'عنوان',
      mediaKind: 'page',
      url: 'http://example.test/b',
    });
  });
});

describe('openTargetFor', () => {
  it('opens nothing for a resource the Library no longer has', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', unavailable: true })), { kind: 'none' });
  });

  it('opens a premade sheet in the sheet viewer, by its id', () => {
    const sheet = resource({ id: 'p', source: 'premade-sheet', nativeId: 'pw-demo', url: null });
    assert.deepEqual(openTargetFor(sheet), { kind: 'premade', id: 'pw-demo' });
  });

  it('opens a link-bearing resource at its url', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', url: 'https://example.test/v' })), {
      kind: 'url',
      url: 'https://example.test/v',
    });
  });

  it('opens nothing when there is no url to open', () => {
    assert.deepEqual(openTargetFor(resource({ id: 'r', url: null })), { kind: 'none' });
  });
});

describe('isInsecureResource', () => {
  it('flags a book-QR code stored over plain http, as the Library does', () => {
    assert.equal(isInsecureResource(resource({ id: 'q', source: 'book-qr', url: 'http://example.test/a' })), true);
  });

  it('does not flag a book-QR code stored over https', () => {
    assert.equal(isInsecureResource(resource({ id: 'q', source: 'book-qr', url: 'https://example.test/a' })), false);
  });

  it('does not flag a book-QR row that has no url', () => {
    assert.equal(isInsecureResource(resource({ id: 'q', source: 'book-qr', url: null })), false);
  });

  it('does not flag a staff upload or a premade sheet', () => {
    assert.equal(isInsecureResource(resource({ id: 'u', source: 'uploaded', url: 'https://example.test/v' })), false);
    assert.equal(isInsecureResource(resource({ id: 'p', source: 'premade-sheet', url: null })), false);
  });

  it('does not flag http on a row that is not a book-QR code', () => {
    assert.equal(isInsecureResource(resource({ id: 'u', source: 'uploaded', url: 'http://example.test/v' })), false);
    assert.equal(isInsecureResource(resource({ id: 'p', source: 'premade-sheet', url: 'http://example.test/s' })), false);
  });
});

describe('withAddedResource', () => {
  it('puts the row just added at the front, so the shelf reads newest first', () => {
    const older = resource({ id: 'old', createdAt: '2026-10-03T08:00:00.000Z' });
    const fresh = resource({ id: 'new', createdAt: '2026-10-04T08:00:00.000Z' });
    const shelf = mergeClassShelf([], withAddedResource([older], fresh));
    assert.deepEqual(shelf.map(e => e.key), ['resource:new', 'resource:old']);
  });

  it('never lists the same row twice, so the shelf has no duplicate keys', () => {
    const row = resource({ id: 'r' });
    const once = withAddedResource([row], resource({ id: 'r', title: 'copy' }));
    assert.deepEqual(once.map(r => r.id), ['r']);
    const keys = mergeClassShelf([], once).map(e => e.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('does not change the list it was given', () => {
    const list = [resource({ id: 'a' })];
    withAddedResource(list, resource({ id: 'b' }));
    assert.deepEqual(list.map(r => r.id), ['a']);
  });
});

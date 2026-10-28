/**
 * The help-center video shelf's data: who sees which video, how a query finds one,
 * and that a bad catalog entry is caught before it reaches a phone.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/helpVideos.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  HELP_VIDEOS,
  formatVideoLength,
  helpVideoPlayUrl,
  helpVideoThumbnailUrl,
  helpVideoWatchUrl,
  helpVideosFor,
  narrationTagVisible,
  validateCatalog,
  type HelpVideo,
} from '../helpVideos.ts';
import { getT, type TranslationKey } from '../i18n.ts';

const t = getT('ar');

// Titles are i18n keys. These existing keys stand in for video titles, so a fixture
// needs no new copy: 'faqSearchPlaceholder' is «ابحث في الأسئلة…» (hamza and ta marbuta,
// for the folding test), 'faqCatSaving' is «الحفظ والتصدير», 'faqCatClass' is «الصف والطلبة».
const video = (over: Partial<HelpVideo> & { id: string }): HelpVideo => ({
  roles: ['teacher'],
  youtubeId: 'abcdefghij' + over.id.length.toString(36),
  titleKey: 'faqCatSaving',
  seconds: 70,
  narration: 'ar',
  ...over,
});

const TEACHER = video({ id: 'teacher-one', roles: ['teacher'], titleKey: 'faqCatSaving', youtubeId: 'aaaaaaaaaa1' });
const STUDENT = video({ id: 'student-one', roles: ['student'], titleKey: 'faqCatClass', youtubeId: 'bbbbbbbbbb2' });
const PARENT = video({ id: 'parent-one', roles: ['parent'], titleKey: 'faqSearchPlaceholder', youtubeId: 'cccccccccc3' });
const BOTH = video({ id: 'teacher-and-student', roles: ['teacher', 'student'], titleKey: 'faqCatClass', youtubeId: 'dddddddddd4' });
const CATALOG = [TEACHER, STUDENT, PARENT, BOTH];

describe('the shipped catalog', () => {
  it('is valid — including empty, which is how v1 ships', () => {
    assert.deepEqual(validateCatalog(HELP_VIDEOS), []);
  });

  it('shows nothing to any role while it is empty', () => {
    if (HELP_VIDEOS.length > 0) return; // once a real video exists, the role tests below cover it
    for (const role of ['teacher', 'student', 'parent', null] as const) {
      assert.deepEqual(helpVideosFor(HELP_VIDEOS, role, '', t), []);
    }
  });
});

describe('validateCatalog', () => {
  it('accepts a good catalog', () => {
    assert.deepEqual(validateCatalog(CATALOG), []);
  });

  it('rejects a duplicated id', () => {
    const problems = validateCatalog([TEACHER, { ...STUDENT, id: TEACHER.id }]);
    assert.ok(problems.some(p => p.includes('duplicate id') && p.includes('teacher-one')), problems.join('\n'));
  });

  it('rejects an id that is not a kebab-case slug', () => {
    assert.ok(validateCatalog([{ ...TEACHER, id: 'Teacher One' }]).some(p => p.includes('id')));
  });

  it('rejects a bad or duplicated YouTube id', () => {
    assert.ok(validateCatalog([{ ...TEACHER, youtubeId: 'short' }]).some(p => p.includes('youtubeId')));
    assert.ok(validateCatalog([{ ...TEACHER, youtubeId: 'has space!!' }]).some(p => p.includes('youtubeId')));
    const dup = validateCatalog([TEACHER, { ...STUDENT, youtubeId: TEACHER.youtubeId }]);
    assert.ok(dup.some(p => p.includes('duplicate youtubeId')), dup.join('\n'));
  });

  it('rejects empty, unknown or repeated roles', () => {
    assert.ok(validateCatalog([{ ...TEACHER, roles: [] }]).some(p => p.includes('roles')));
    assert.ok(validateCatalog([{ ...TEACHER, roles: ['admin' as never] }]).some(p => p.includes('roles')));
    assert.ok(validateCatalog([{ ...TEACHER, roles: ['teacher', 'teacher'] }]).some(p => p.includes('roles')));
  });

  it('rejects a length outside 15–300 seconds, or a fraction', () => {
    for (const seconds of [5, 14, 301, 70.5]) {
      assert.ok(validateCatalog([{ ...TEACHER, seconds }]).some(p => p.includes('seconds')), String(seconds));
    }
  });

  it('rejects a title missing in either language', () => {
    const missing = { ...TEACHER, titleKey: 'noSuchKey' as TranslationKey };
    const problems = validateCatalog([missing]);
    assert.ok(problems.some(p => p.includes('(ar)')), problems.join('\n'));
    assert.ok(problems.some(p => p.includes('(en)')), problems.join('\n'));
  });
});

describe('helpVideosFor', () => {
  it('returns nothing for a role-less user (an admin, or signed out)', () => {
    assert.deepEqual(helpVideosFor(CATALOG, null, '', t), []);
  });

  it('never shows one role another role’s video', () => {
    const ids = (role: 'teacher' | 'student' | 'parent') => helpVideosFor(CATALOG, role, '', t).map(v => v.id);
    assert.deepEqual(ids('teacher'), ['teacher-one', 'teacher-and-student']);
    assert.deepEqual(ids('student'), ['student-one', 'teacher-and-student']);
    assert.deepEqual(ids('parent'), ['parent-one']);
  });

  it('keeps the catalog order', () => {
    const reversed = [...CATALOG].reverse();
    assert.deepEqual(helpVideosFor(reversed, 'teacher', '', t).map(v => v.id), ['teacher-and-student', 'teacher-one']);
  });

  it('needs every word of a multi-word query', () => {
    // «الحفظ والتصدير»: both words are in it; «الصف» is not.
    assert.deepEqual(helpVideosFor(CATALOG, 'teacher', 'الحفظ التصدير', t).map(v => v.id), ['teacher-one']);
    assert.deepEqual(helpVideosFor(CATALOG, 'teacher', 'الحفظ الصف', t), []);
  });

  it('finds Arabic through the hamza and ta-marbuta spellings a teacher types', () => {
    // The title is «ابحث في الأسئلة…»; the query drops the hamza and the ta marbuta.
    assert.deepEqual(helpVideosFor(CATALOG, 'parent', 'الاسئله', t).map(v => v.id), ['parent-one']);
  });

  it('ignores a blank query', () => {
    assert.equal(helpVideosFor(CATALOG, 'teacher', '   ', t).length, 2);
  });

  it('matches against the title in the language the reader is using', () => {
    const en = getT('en');
    const saving = en('faqCatSaving'); // «Saving & exporting» or similar
    const firstWord = saving.split(/\s+/)[0]!;
    assert.deepEqual(helpVideosFor(CATALOG, 'teacher', firstWord, en).map(v => v.id), ['teacher-one']);
  });
});

describe('formatVideoLength', () => {
  it('writes m:ss', () => {
    assert.equal(formatVideoLength(70), '1:10');
    assert.equal(formatVideoLength(65), '1:05');
    assert.equal(formatVideoLength(600), '10:00');
    assert.equal(formatVideoLength(5), '0:05');
  });
});

describe('links', () => {
  it('builds the watch, play and thumbnail URLs from the YouTube id alone', () => {
    const v = TEACHER; // youtubeId 'aaaaaaaaaa1'
    assert.equal(helpVideoWatchUrl(v), 'https://www.youtube.com/watch?v=aaaaaaaaaa1');
    // The privacy-friendly embed page that classMedia already builds.
    assert.equal(helpVideoPlayUrl(v), 'https://www.youtube-nocookie.com/embed/aaaaaaaaaa1?rel=0');
    assert.equal(helpVideoThumbnailUrl(v), 'https://img.youtube.com/vi/aaaaaaaaaa1/mqdefault.jpg');
  });
});

describe('narrationTagVisible', () => {
  it('tags Arabic narration only for a reader who is not using Arabic', () => {
    assert.equal(narrationTagVisible(TEACHER, 'en'), true);
    assert.equal(narrationTagVisible(TEACHER, 'ar'), false);
  });
});

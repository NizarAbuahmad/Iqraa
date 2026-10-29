# Help-Center Video Shelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the mechanism for a role-filtered shelf of short tutorial videos at the top of the FAQ screen, with an **empty** catalog, so users see nothing until the first video is added.

**Architecture:** A pure, tested module `services/helpVideos.ts` (the catalog type, the empty catalog, the role and search filter, URL and length helpers, a catalog validator). A component `components/help/HelpVideoShelf.tsx` that draws it with the repo's shared card, press and entrance pieces and opens a video through the existing `openExternal`. It is mounted as the first child of the FAQ column in `app/faq.tsx`. Three i18n keys carry its copy.

**Tech Stack:** TypeScript, React Native / Expo (also the web build), `expo-image`, `node --test` for the pure module. **No new dependency.**

**Spec:** `docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md`. Read it first. This plan was validated by building the code below, running it, and looking at it in a browser; the few places where that changed the spec are in *Deviations from the spec*, and Task 4 corrects the spec to match.

## Global Constraints

- **No new dependency, no native module, no `app.json` `version` bump** (the runtime version is `1.5.0` and must not move). The shelf opens videos through `openExternal` (`services/externalLinks.ts`).
- **The catalog ships EMPTY** (`HELP_VIDEOS = []`) and has **no placeholder entries**. An empty catalog renders nothing: no title, no gap.
- **The pure module imports no `react-native` and no `expo-*`, and every relative import there has an explicit `.ts` extension.** The mobile test runner is bare `node --test` over `services/__tests__/**/*.test.ts` only; a test anywhere else never runs, and anything that imports React Native cannot be loaded by it.
- **Brand:** the Arabic brand is **«إقرأ»** (hamzat qatʿ), never quoted as «اقرأ». The English product name is **«Iqrra»** (two r's), never «Iqraa» or «Iqra».
- **Design scale** (`designScale.test.ts` is a ratchet): `fontSize`, `borderRadius`, `padding*`, `margin*` and `gap` come from `TYPE`, `RADIUS` and `SPACE` in `constants/theme.ts`, never a literal off the scale. Icons are on `ICON` / `ICON_DISPLAY` (`constants/icons.ts`). No `shadowColor`.
- **Cards:** the card takes `useSurface()` and has **no `borderWidth`** of its own (a light surface has no border colour, so a leftover width draws black) and **no `overflow: 'hidden'`** (iOS clips the surface's own shadow); clip the thumbnail on an inner view. Press state is `PressableScale`; entry motion is `Entrance`, which honours reduce-motion.
- **Accessibility:** `aria-*` props for state, never `accessibilityState` (`ariaState.test.ts`); a 44-point target; the card's label is composed in code (`t()` does not interpolate).
- **RTL:** the app expresses direction per component (`isRTL ? 'row-reverse' : 'row'`, `textAlign`), not through `I18nManager`. A reversed horizontal `ScrollView` starts scrolled to its far end, so scroll to the end when `isRTL`, exactly as the FAQ's chip row does.
- **Editing files:** use the Edit tool, never `sed -i` or `perl -pi` (the files are UTF-8 with Arabic; a substitution once silently turned spaces into NUL bytes). Check `git diff --stat` for a `Bin N -> M bytes` line.
- **Git:** never push to `main`. Work on a feature branch from `origin/main` (a worktree if another session shares the checkout, then a full `pnpm install` there). `git add` named paths, never `-A` or `.`. Every commit message ends with a blank line and then the attribution lines your harness requires. Open the PR as a **draft**.
- **The mobile suite prints nothing until it finishes (minutes). That is not a hang.**
- **Every merge to `main` deploys all three services** (`deploy.yml` has no path filter). This change needs **no production over-the-air publish**: with an empty catalog nothing is visible.

## Deviations from the spec

Found while validating this code in a browser. Task 4 edits the spec so it matches what shipped.

1. **A thumbnail that fails to load leaves the plain tile, with the play button still on it.** The spec said a neutral `IconTile` with `play-circle-outline` stands in; an icon above the play button looked cluttered.
2. **The pure module also exports** `HELP_VIDEO_ROLES`, `helpVideoPlayUrl`, `helpVideoThumbnailUrl`, `narrationTagVisible` and `validateCatalog`. The spec named only `HELP_VIDEOS`, `helpVideosFor`, `formatVideoLength` and `helpVideoWatchUrl`. `validateCatalog` is what lets the tests check the shipped catalog and also check the checks themselves with deliberately bad fixtures.
3. **The phone scroller reaches `SPACE.lg` into the FAQ's own padding and its content is padded by the same.** The card shadow (`ELEVATION.card`, `0 4px 14px`) reaches 18 pt below a card and 14 pt to each side, and a scroller clips whatever leaves its bounds. Without this, a faint hard line showed under the cards.
4. **"Wide" is measured on the window**, at `640`, because the FAQ column is `min(window − 32, 760)`, which is at least 600 from a 640 window up. The spec stated it as a column width.

## File structure

| File | Responsibility |
|---|---|
| `artifacts/mobile/services/helpVideos.ts` (create) | Pure. The `HelpVideo` type, the empty `HELP_VIDEOS`, `helpVideosFor`, `validateCatalog`, `formatVideoLength`, the URL helpers, `narrationTagVisible`. |
| `artifacts/mobile/services/__tests__/helpVideos.test.ts` (create) | Pins all of the above with `node --test`. |
| `artifacts/mobile/components/help/HelpVideoShelf.tsx` (create) | Draws the shelf and opens a video. Imports React Native, so it is **not** unit-testable; it is covered by the typecheck, the repo's source-scan guard tests and a browser check. |
| `artifacts/mobile/app/faq.tsx` (modify) | One import and one element: the shelf, first child of the column. |
| `artifacts/mobile/services/i18n.ts` (modify) | Three keys, Arabic and English. |
| `docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md` (modify) | Four corrections (Task 4). |
| `docs/status-log.md` (modify) | The PR's write-up, at the top (Task 4). |

---

### Task 1: The pure module and its tests

**Files:**
- Create: `artifacts/mobile/services/helpVideos.ts`
- Create: `artifacts/mobile/services/__tests__/helpVideos.test.ts`

**Interfaces:**
- Consumes: `youtubeEmbedUrl(url)` from `services/classMedia.ts`, `foldForSearch(s)` from `services/faqContent.ts`, `getT(lang)`, `Lang` and `TranslationKey` from `services/i18n.ts`, `youtubeThumbnail(url)` from `services/resourceThumbnail.ts`. All are pure and already loaded by existing tests.
- Produces (Task 2 uses these exact names):
  - `type HelpVideoRole = 'teacher' | 'student' | 'parent'`, `HELP_VIDEO_ROLES: readonly HelpVideoRole[]`
  - `type HelpVideo = { id: string; roles: HelpVideoRole[]; youtubeId: string; titleKey: TranslationKey; seconds: number; narration: 'ar' }`
  - `HELP_VIDEOS: readonly HelpVideo[]` (empty)
  - `helpVideosFor(catalog: readonly HelpVideo[], role: HelpVideoRole | null, query: string, t: (key: TranslationKey) => string): HelpVideo[]`
  - `helpVideoWatchUrl(v)`, `helpVideoPlayUrl(v)`: `string`; `helpVideoThumbnailUrl(v)`: `string | null`; `formatVideoLength(seconds: number): string`; `narrationTagVisible(v, lang: Lang): boolean`; `validateCatalog(catalog): string[]`

- [ ] **Step 1: Create your branch from the latest `main`**

```bash
git fetch origin main
git checkout -B feat/help-video-shelf origin/main
git status --short        # expect: nothing
```

- [ ] **Step 2: Write the failing test**

Create `artifacts/mobile/services/__tests__/helpVideos.test.ts` with exactly this content:

```ts
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
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/helpVideos.test.ts
```

Expected: it stops with `ERR_MODULE_NOT_FOUND … services/helpVideos.ts`. (A different error means the test file has a typo; fix that before going on.)

- [ ] **Step 4: Write the implementation**

Create `artifacts/mobile/services/helpVideos.ts` with exactly this content:

```ts
/**
 * The help-center video shelf's data: which short tutorial videos exist, who sees
 * which, and the search over them. Pure, so `node --test` can pin it
 * (services/__tests__/helpVideos.test.ts); the shelf that draws it is
 * components/help/HelpVideoShelf.tsx, mounted on app/faq.tsx.
 *
 * The catalog is a list in the app, not a table on the server: there are a handful of
 * videos, and a list in the app ships over the air and is type-checked. Adding a video
 * is one entry here plus its title key in services/i18n.ts, then a manual `production`
 * publish. Design: docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md.
 *
 * Videos are UNLISTED YouTube videos opened through `openExternal` (an in-app browser
 * on a phone, a new tab on web), like every other video in the app. There is no
 * player to ship, so no native module and no `app.json` version bump.
 */
import { youtubeEmbedUrl } from './classMedia.ts';
import { foldForSearch } from './faqContent.ts';
import { getT, type Lang, type TranslationKey } from './i18n.ts';
import { youtubeThumbnail } from './resourceThumbnail.ts';

export type HelpVideoRole = 'teacher' | 'student' | 'parent';

export const HELP_VIDEO_ROLES: readonly HelpVideoRole[] = ['teacher', 'student', 'parent'];

export type HelpVideo = {
  /** Stable slug, never reused. It is the analytics key. e.g. 'teacher-quick-quiz' */
  id: string;
  roles: HelpVideoRole[];
  /** The 11-character id of an UNLISTED YouTube video. */
  youtubeId: string;
  titleKey: TranslationKey;
  seconds: number;
  /** Narration language. Every v1 video is Arabic. */
  narration: 'ar';
};

/**
 * v1 ships EMPTY on purpose: the shelf draws nothing until the first real video is
 * added, so the mechanism can merge before any video is recorded. There are no
 * placeholder entries — an entry always has a real video, so the shelf never shows a
 * dead card and `validateCatalog` can check every one.
 */
export const HELP_VIDEOS: readonly HelpVideo[] = [];

/** The normal YouTube page. The embed URL is built from it, and it is the fallback. */
export function helpVideoWatchUrl(video: Pick<HelpVideo, 'youtubeId'>): string {
  return `https://www.youtube.com/watch?v=${video.youtubeId}`;
}

/**
 * What a tap opens: the privacy-friendly embed page (youtube-nocookie, no related-video
 * rail), or the watch page if the embed URL could not be built.
 */
export function helpVideoPlayUrl(video: Pick<HelpVideo, 'youtubeId'>): string {
  const watch = helpVideoWatchUrl(video);
  return youtubeEmbedUrl(watch) ?? watch;
}

/** The cover image, derivable from the id alone. `null` only if the id were malformed. */
export function helpVideoThumbnailUrl(video: Pick<HelpVideo, 'youtubeId'>): string | null {
  return youtubeThumbnail(helpVideoWatchUrl(video));
}

/** 70 → "1:10", 65 → "1:05", 600 → "10:00". */
export function formatVideoLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Every video is Arabic; a reader using the English UI is told so before they tap. */
export function narrationTagVisible(video: Pick<HelpVideo, 'narration'>, lang: Lang): boolean {
  return video.narration !== lang;
}

/**
 * The videos a reader may see, in catalog order. `role` is `null` for an admin or a
 * signed-out user, who sees none. A non-empty query keeps a video only if EVERY word
 * of it is in the title — folded the way the FAQ search folds, so «الاسئله» finds
 * «الأسئلة». The category chips on the FAQ screen do not apply to videos.
 */
export function helpVideosFor(
  catalog: readonly HelpVideo[],
  role: HelpVideoRole | null,
  query: string,
  t: (key: TranslationKey) => string,
): HelpVideo[] {
  if (!role) return [];
  const words = foldForSearch(query).split(' ').filter(Boolean);
  return catalog.filter(video => {
    if (!video.roles.includes(role)) return false;
    if (!words.length) return true;
    const title = foldForSearch(t(video.titleKey));
    return words.every(word => title.includes(word));
  });
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Everything wrong with a catalog, one sentence each; `[]` means it is fit to ship.
 * The test runs it over the shipped catalog, so a bad entry fails CI instead of
 * reaching a phone, and over deliberately bad fixtures, so the checks themselves are
 * checked.
 */
export function validateCatalog(catalog: readonly HelpVideo[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const youtubeIds = new Set<string>();
  const tAr = getT('ar');
  const tEn = getT('en');

  for (const video of catalog) {
    const who = `"${video.id}"`;
    if (!SLUG.test(video.id)) problems.push(`${who}: id must be a kebab-case slug`);
    if (ids.has(video.id)) problems.push(`${who}: duplicate id`);
    ids.add(video.id);

    if (!YOUTUBE_ID.test(video.youtubeId)) problems.push(`${who}: youtubeId must be 11 characters of A-Z a-z 0-9 _ -`);
    if (youtubeIds.has(video.youtubeId)) problems.push(`${who}: duplicate youtubeId ${video.youtubeId}`);
    youtubeIds.add(video.youtubeId);

    const rolesOk =
      video.roles.length > 0 &&
      video.roles.every(r => HELP_VIDEO_ROLES.includes(r)) &&
      new Set(video.roles).size === video.roles.length;
    if (!rolesOk) problems.push(`${who}: roles must be a non-empty list of distinct teacher / student / parent`);

    if (!Number.isInteger(video.seconds) || video.seconds < 15 || video.seconds > 300) {
      problems.push(`${who}: seconds must be a whole number from 15 to 300`);
    }
    if (video.narration !== 'ar') problems.push(`${who}: narration must be 'ar' in v1`);

    for (const [lang, t] of [['ar', tAr], ['en', tEn]] as const) {
      const title = t(video.titleKey);
      if (!title || title === video.titleKey) {
        problems.push(`${who}: title ${video.titleKey} is missing (${lang})`);
      } else if (lang === 'en' && /\bIqraa?\b/.test(title)) {
        problems.push(`${who}: the English title spells the product «Iqraa» or «Iqra»; it is «Iqrra»`);
      } else if (lang === 'ar' && title.includes('«اقرأ»')) {
        problems.push(`${who}: the Arabic title quotes the brand as «اقرأ»; it is «إقرأ»`);
      }
    }
  }
  return problems;
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/helpVideos.test.ts
```

Expected: `# tests 19`, `# pass 19`, `# fail 0`.

- [ ] **Step 6: Prove the role filter is actually guarded (a mutation check), then undo it**

With the Edit tool, in `artifacts/mobile/services/helpVideos.ts`, replace

`    if (!video.roles.includes(role)) return false;`

with

`    if (!video.roles.includes(role) && false) return false;`

Run the test again. Expected: **`# fail 3`**, including `never shows one role another role’s video`. Now put the line back exactly as it was and run the test once more; expect `# pass 19`.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add artifacts/mobile/services/helpVideos.ts artifacts/mobile/services/__tests__/helpVideos.test.ts
git diff --cached --stat        # two new files, no "Bin" line
git commit -m "Help videos: the catalog, who sees which, and a validator (empty for now)"
```

---

### Task 2: The shelf, its copy, and the FAQ mount

**Files:**
- Create: `artifacts/mobile/components/help/HelpVideoShelf.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (after `faqSearchClear`, in both languages)
- Modify: `artifacts/mobile/app/faq.tsx` (one import, one element)

**Interfaces:**
- Consumes: everything Task 1 produces; `useAuth` (`@/context/AuthContext`), `tourRoleOf(role)` (`@/services/tour`: maps a user's role to `'teacher' | 'student' | 'parent' | null`), `useLanguage` (`{ t, isRTL, lang }`), `useColors`, `useSurface`, `PressableScale`, `Entrance`, `trackEvent` (`@/services/analytics`), `openExternal`.
- Produces: `HelpVideoShelf({ query: string })`, a component that renders `null` when the reader has no video to see.

- [ ] **Step 1: Record the typecheck baseline**

```bash
cd artifacts/mobile
pnpm run typecheck 2>&1 | grep "error TS" > /tmp/tc-before.txt
wc -l /tmp/tc-before.txt
```

On a clean tree this printed **12** pre-existing errors in the author's sandbox (push-token, Quran-audio and `expo-file-system` typings). Yours may differ; what matters is that Step 6 adds none.

- [ ] **Step 2: Add the copy, Arabic then English**

With the Edit tool, in `artifacts/mobile/services/i18n.ts`, replace the **first** occurrence (the Arabic table):

```
    faqSearchClear: 'مسح البحث',
```

with

```
    faqSearchClear: 'مسح البحث',
    helpVideosTitle: 'فيديوهات قصيرة',
    helpVideoNarrationAr: 'شرح بالعربية',
    helpVideoOpensInBrowser: 'يفتح في المتصفح',
```

Then replace (the English table):

```
    faqSearchClear: 'Clear search',
```

with

```
    faqSearchClear: 'Clear search',
    helpVideosTitle: 'Short videos',
    helpVideoNarrationAr: 'Arabic narration',
    helpVideoOpensInBrowser: 'Opens in your browser',
```

(Each old string occurs exactly once, so the Edit tool accepts it.)

- [ ] **Step 3: Create the component**

Create `artifacts/mobile/components/help/HelpVideoShelf.tsx` with exactly this content:

```tsx
/**
 * The help-center video shelf: short tutorial videos for the signed-in role, at the top
 * of the FAQ screen. It draws NOTHING when the reader has no video to see, which is all
 * of v1 until the first real entry is added to HELP_VIDEOS.
 *
 * The data and every rule about who sees what live in services/helpVideos.ts (pure,
 * tested); this file only draws and opens. Design:
 * docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md.
 *
 * - A tap opens the video through `openExternal`: an in-app browser on a phone (the
 *   back gesture returns), a new tab on web. There is no player to ship.
 * - Phone-width: one row that scrolls sideways. Wide: a wrapping grid of three.
 * - RTL: the row is reversed and starts scrolled to its far end, exactly as the FAQ's
 *   own chip row does it.
 */
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { trackEvent } from '@/services/analytics';
import { openExternal } from '@/services/externalLinks';
import {
  HELP_VIDEOS,
  formatVideoLength,
  helpVideoPlayUrl,
  helpVideoThumbnailUrl,
  helpVideosFor,
  narrationTagVisible,
  type HelpVideo,
} from '@/services/helpVideos';
import { tourRoleOf } from '@/services/tour';

/** Play button and length pill sit on the picture, so they are the same in both themes. */
const ON_SCRIM = '#FFFFFF';
const SCRIM = '#000000B3';

/** Window width from which the FAQ column (at most 760, 16 pt of padding each side) is wide enough for a grid. */
const WIDE_FROM = 640;
const PHONE_CARD_MAX = 260;
const PHONE_CARD_SHARE = 0.72;

function HelpVideoCard({ video, onOpen }: { video: HelpVideo; onOpen: () => void }) {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL, lang } = useLanguage();
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = helpVideoThumbnailUrl(video);
  const title = t(video.titleKey);
  const length = formatVideoLength(video.seconds);
  const align = isRTL ? 'right' : 'left';

  return (
    <PressableScale
      onPress={onOpen}
      accessibilityLabel={`${title}، ${length}. ${t('helpVideoOpensInBrowser')}`}
      style={[surface, styles.card]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.secondary }]}>
        {/* A thumbnail that fails to load (offline, a removed video) leaves the plain tile; the play button still says "video". */}
        {thumb && !thumbFailed ? (
          <Image
            source={{ uri: thumb }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityElementsHidden
            onError={() => setThumbFailed(true)}
          />
        ) : null}
        <View style={styles.play}>
          <Ionicons name="play" size={ICON.lg} color={ON_SCRIM} />
        </View>
        <View style={[styles.length, isRTL ? { left: SPACE.sm } : { right: SPACE.sm }]}>
          <Text style={styles.lengthText}>{length}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, textAlign: align }]}>
          {title}
        </Text>
        {narrationTagVisible(video, lang) ? (
          <Text style={[styles.tag, { color: colors.mutedForeground, textAlign: align }]}>
            {t('helpVideoNarrationAr')}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** `query` is the FAQ search box: typing there narrows the shelf by title too. */
export function HelpVideoShelf({ query }: { query: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const role = tourRoleOf(user?.role);
  const videos = useMemo(() => helpVideosFor(HELP_VIDEOS, role, query, t), [role, query, t]);

  if (!role || videos.length === 0) return null;

  const wide = width >= WIDE_FROM;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const cardWidth = Math.min(PHONE_CARD_MAX, Math.round(width * PHONE_CARD_SHARE));

  const open = (video: HelpVideo) => {
    trackEvent('help_video_opened', { id: video.id, role, surface: 'faq' });
    void openExternal(helpVideoPlayUrl(video));
  };

  const cards = videos.map((video, i) => (
    <Entrance key={video.id} index={i} style={wide ? styles.gridCell : { width: cardWidth }}>
      <HelpVideoCard video={video} onOpen={() => open(video)} />
    </Entrance>
  ));

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}
      >
        {t('helpVideosTitle')}
      </Text>
      {wide ? (
        <View style={[styles.grid, { flexDirection: rowDir }]}>{cards}</View>
      ) : (
        <ScrollView
          ref={scroller}
          horizontal
          style={styles.scroller}
          showsHorizontalScrollIndicator={false}
          // A reversed row still opens scrolled to its far end; bring the first card into view.
          onContentSizeChange={() => {
            if (isRTL) scroller.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={[styles.row, { flexDirection: rowDir }]}
        >
          {cards}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.label },
  // A scroller clips whatever leaves its bounds, and the card shadow (ELEVATION.card, 0 4px 14px) reaches
  // 18 pt below and 14 pt to each side. So the scroller reaches SPACE.lg into the FAQ's own padding and the
  // content is padded by the same amount: the shadow has room and the first card still meets the column edge.
  scroller: { marginHorizontal: -SPACE.lg },
  // flexGrow so a reversed (Arabic) row fills the scroller and hugs the start edge.
  row: { gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xl, paddingHorizontal: SPACE.lg, flexGrow: 1 },
  grid: { flexWrap: 'wrap', gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xl },
  gridCell: { flexBasis: '31%', flexGrow: 1 },
  // No border and no overflow here: useSurface() draws the shadow or the border, and a clip would cut the shadow.
  card: { minHeight: 44 },
  thumb: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  length: {
    position: 'absolute',
    bottom: SPACE.sm,
    backgroundColor: SCRIM,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
  },
  lengthText: { color: ON_SCRIM, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  meta: { padding: SPACE.md, gap: SPACE.xs },
  title: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, lineHeight: 21 },
  tag: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption },
});
```

- [ ] **Step 4: Mount it in the FAQ screen**

With the Edit tool, in `artifacts/mobile/app/faq.tsx`, replace

```
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
```

with

```
import { useLanguage } from '@/context/LanguageContext';
import { HelpVideoShelf } from '@/components/help/HelpVideoShelf';
import { goBack } from '@/services/navigation';
```

and replace

```
        <View style={styles.column}>
          <View
            style={[
              styles.search,
```

with

```
        <View style={styles.column}>
          <HelpVideoShelf query={query} />
          <View
            style={[
              styles.search,
```

- [ ] **Step 5: Run the new tests and the guard tests that police a new component and new copy**

```bash
for f in helpVideos faqContent designScale ariaState iconSystem i18n i18nTerminology cornerTheme statusBar; do
  printf '%-16s ' "$f"
  node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/$f.test.ts 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '
  echo
done
```

Expected: every line shows `# fail 0`. (`i18n` is the key-parity test: it fails if a key exists in only one language. `designScale` fails if a literal off the scale was written.)

- [ ] **Step 6: Typecheck: it must add nothing to the baseline**

```bash
pnpm run typecheck 2>&1 | grep "error TS" > /tmp/tc-after.txt
diff /tmp/tc-before.txt /tmp/tc-after.txt && echo "no new type errors"
grep -E "helpVideos|HelpVideoShelf|app/faq|services/i18n" /tmp/tc-after.txt || echo "none in the files this task touched"
```

Expected: `no new type errors` and `none in the files this task touched`.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add artifacts/mobile/components/help/HelpVideoShelf.tsx artifacts/mobile/app/faq.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat        # one new file, two modified, no "Bin" line
git commit -m "Help videos: the shelf on the FAQ screen (draws nothing while the catalog is empty)"
```

---

### Task 3: Check it in a browser, with a throwaway fixture that is never committed

An empty catalog renders nothing, so the only way to *see* the shelf is to add entries locally, check them, and remove them. This task commits nothing; its output is the verification you report in the PR.

**Files:**
- Modify then restore (do **not** commit): `artifacts/mobile/services/helpVideos.ts`
- Scratch (outside the repo): `shelf-check.cjs`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: the verification record for Task 4's status-log entry and PR body.

- [ ] **Step 1: Add three throwaway fixture videos**

With the Edit tool, in `artifacts/mobile/services/helpVideos.ts`, replace

```
export const HELP_VIDEOS: readonly HelpVideo[] = [];
```

with

```
export const HELP_VIDEOS: readonly HelpVideo[] = [
  // THROWAWAY browser-check fixture. Never commit.
  { id: 'fixture-teacher', roles: ['teacher'], youtubeId: 'dQw4w9WgXcQ', titleKey: 'faqCatSaving', seconds: 70, narration: 'ar' },
  { id: 'fixture-both', roles: ['teacher', 'student'], youtubeId: 'aqz-KE-bpKQ', titleKey: 'faqCatClass', seconds: 125, narration: 'ar' },
  { id: 'fixture-third', roles: ['teacher'], youtubeId: 'jNQXAC9IVRw', titleKey: 'faqSearchPlaceholder', seconds: 95, narration: 'ar' },
];
```

- [ ] **Step 2: Build the web app and serve it**

```bash
cd artifacts/mobile
EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web    # takes a few minutes
cd ../../e2e
WEB_PORT=8097 node serve.mjs &                         # serves artifacts/mobile/dist
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8097/faq     # expect 200
```

- [ ] **Step 3: Save the browser check outside the repo**

Save this as `shelf-check.cjs` in a scratch directory (not in the repo). It stubs the API, seeds a signed-in user whose account is old enough that the first-run tour never starts, serves the YouTube thumbnails from the test (two load, one is made to fail so both the picture and the plain tile are on screen), refuses the YouTube pages while recording where a tap tried to go, and asserts layout, role filtering, search and the tap.

```js
// Browser check for the help-center video shelf on the built web app (stubbed API).
// Usage: node shelf-check.cjs <role> <phone|desktop> <ar|en> <light|dark>
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const [role = 'teacher', vp = 'phone', lang = 'ar', scheme = 'light'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:8098';
const OUT = join(__dirname, 'shelf-shots');
mkdirSync(OUT, { recursive: true });
const VIEWPORTS = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 720, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};
// 1x1 grey PNG; contentFit="cover" stretches it over the 16:9 box.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8/uPnfwAIAAMBb3tXkQAAAABJRU5ErkJggg==', 'base64');

const created = new Date(Date.now() - 60 * 86400e3).toISOString(); // old enough that the first-run tour never starts
const user = {
  id: 'u-' + role, firstName: 'Sara', lastName: 'Khatib', name: 'Sara Khatib', email: 'x@example.com', avatarUrl: null,
  preferredLanguage: lang, createdAt: created, role, rosterConsentAt: created, hasRosterLink: true,
  gradeIds: ['grade-10'], subjectIds: ['mathematics'],
};

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
  const { isMobile, hasTouch, deviceScaleFactor, ...viewport } = VIEWPORTS[vp];
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor, colorScheme: scheme, locale: lang === 'ar' ? 'ar' : 'en-US' });
  await ctx.addInitScript(([who, language]) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('__seeded', '1');
      localStorage.setItem('@iqra_language', language);
      localStorage.setItem('@iqra_intro_seen_v1', '1');
      localStorage.setItem('@iqra_tour_off_v1', '1');
      localStorage.setItem('iqra_access_token', 'fake');
      localStorage.setItem('iqra_refresh_token', 'fake');
      localStorage.setItem('@iqra_user_snapshot_v1', JSON.stringify(who));
    }
  }, [user, lang]);
  await ctx.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const SHAPED = { '/auth/me': user, '/schedule': { periods: [], slots: [] }, '/classes': { classes: [] }, '/evaluations': { evaluations: [] }, '/teaching-plans': { plans: [] } };
    const body = p in SHAPED ? SHAPED[p] : (/s$/.test(p) || p === '/library') ? [] : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  // Two thumbnails load, one fails: both the picture and the fallback tile are on screen.
  await ctx.route('https://img.youtube.com/**', (route) =>
    route.request().url().includes('jNQXAC9IVRw') ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  // Record where a tap tried to go, then refuse the request (no network to YouTube here).
  const navigated = [];
  await ctx.route(/youtube(-nocookie)?\.com\/(embed|watch)/, (route) => { navigated.push(route.request().url()); return route.abort(); });

  const page = await ctx.newPage();
  const heading = lang === 'ar' ? 'فيديوهات قصيرة' : 'Short videos';
  const cardName = lang === 'ar' ? /يفتح في المتصفح/ : /Opens in your browser/;
  const cards = () => page.getByRole('button', { name: cardName });

  await page.goto(BASE + '/faq');
  await page.waitForTimeout(3500);

  const expected = { teacher: 3, student: 1, parent: 0 }[role];
  const n = await cards().count();
  check(`${role}: sees ${expected} video(s)`, n === expected, `saw ${n}`);
  const headingShown = (await page.getByText(heading, { exact: true }).count()) > 0;
  check(`${role}: shelf title ${expected ? 'shown' : 'absent (nothing to show)'}`, headingShown === (expected > 0));

  if (expected > 0) {
    const boxes = [];
    for (let i = 0; i < n; i++) boxes.push(await cards().nth(i).boundingBox());
    const W = viewport.width;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('no page-level horizontal overflow', overflow <= 1, `scrollWidth - innerWidth = ${overflow}`);
    // The FAQ column is the whole width minus 16 pt of padding on a phone, and a centred 760 on desktop.
    const colLeft = vp === 'desktop' ? (W - 760) / 2 : 16;
    const colRight = vp === 'desktop' ? (W + 760) / 2 : W - 16;
    check('the first card sits at the start edge of the column (right in Arabic, left in English)', (() => {
      const first = boxes[0];
      return lang === 'ar' ? Math.abs(first.x + first.width - colRight) <= 2 : Math.abs(first.x - colLeft) <= 2;
    })(), `first card spans ${Math.round(boxes[0].x)}–${Math.round(boxes[0].x + boxes[0].width)}; column ${colLeft}–${colRight}`);
    if (vp === 'desktop' && n === 3) {
      const ys = new Set(boxes.map(b => Math.round(b.y)));
      check('wide: three cards in one row', ys.size === 1, `y values: ${[...ys].join(',')}`);
      check('wide: cards stay inside the 760 column', boxes.every(b => b.x >= (W - 760) / 2 - 1 && b.x + b.width <= (W + 760) / 2 + 1));
    }
    if (vp === 'phone') {
      check('phone: cards are at most 260 wide', boxes.every(b => b.width <= 261), boxes.map(b => Math.round(b.width)).join(','));
    }
    check('every card is at least 44 high', boxes.every(b => b.height >= 44));

    // The shelf narrows with the FAQ search box.
    if (role === 'teacher') {
      const q = lang === 'ar' ? 'الحفظ' : 'Saving';
      await page.getByPlaceholder(lang === 'ar' ? 'ابحث في الأسئلة…' : 'Search the questions…').fill(q);
      await page.waitForTimeout(600);
      const after = await cards().count();
      check('typing in the FAQ search narrows the shelf to the matching title', after === 1, `${after} card(s) left for "${q}"`);
      await page.getByPlaceholder(lang === 'ar' ? 'ابحث في الأسئلة…' : 'Search the questions…').fill('zzzzzz');
      await page.waitForTimeout(600);
      check('a query that matches no video hides the shelf entirely', (await cards().count()) === 0 && (await page.getByText(heading, { exact: true }).count()) === 0);
      await page.getByPlaceholder(lang === 'ar' ? 'ابحث في الأسئلة…' : 'Search the questions…').fill('');
      await page.waitForTimeout(600);
    }

    await page.screenshot({ path: join(OUT, `${role}-${vp}-${lang}-${scheme}.png`) });

    // A tap opens the nocookie embed page (a new tab on web).
    if (role === 'teacher') {
      const popupP = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
      await cards().first().click();
      const popup = await popupP;
      await page.waitForTimeout(1500);
      const url = navigated.find(u => u.includes('dQw4w9WgXcQ'));
      check('a tap opened a new tab', !!popup);
      check('and it went to the privacy-friendly embed page of the FIRST card', url === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', String(url));
    }
  } else {
    await page.screenshot({ path: join(OUT, `${role}-${vp}-${lang}-${scheme}.png`) });
  }

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
```

- [ ] **Step 3b: Run it over the six combinations**

Playwright needs a Chromium. On your own machine run `npx playwright install chromium` once. (In the cloud sandbox one is pre-installed at `/opt/pw-browsers/chromium`, which the script falls back to; do **not** reinstall there.) The script does `require('playwright')`, so point `NODE_PATH` at a `node_modules` that has it (the repo's `e2e/node_modules` or the root pnpm store).

```bash
export BASE=http://localhost:8097
export NODE_PATH="$(pwd)/node_modules:$(ls -d ../node_modules/.pnpm/playwright@*/node_modules 2>/dev/null | head -1)"   # run from e2e/
for combo in "teacher phone ar light" "teacher phone en dark" "teacher desktop ar light" "teacher desktop en dark" "student phone ar light" "parent phone ar light"; do
  out=$(node /path/to/shelf-check.cjs $combo 2>&1 | grep -E "^(PASS|FAIL)")
  printf '%-28s %2d pass, %d fail\n' "$combo" "$(echo "$out" | grep -c '^PASS')" "$(echo "$out" | grep -c '^FAIL')"
  echo "$out" | grep '^FAIL'
done
```

Expected (the author's run):

```
teacher phone ar light       10 pass, 0 fail
teacher phone en dark        10 pass, 0 fail
teacher desktop ar light     11 pass, 0 fail
teacher desktop en dark      11 pass, 0 fail
student phone ar light        6 pass, 0 fail
parent phone ar light         2 pass, 0 fail
```

If a check fails, read **why** before touching the component: the script's own assertions have been wrong before (a tap check that read a tab's URL after the request was refused; an edge check that used the window instead of the centred 760 column), and both were test bugs, not shelf bugs.

- [ ] **Step 4: Look at the screenshots; checks cannot judge how it looks**

The script writes `shelf-shots/<role>-<viewport>-<lang>-<scheme>.png`. Open at least `teacher-phone-ar-light.png`, `teacher-phone-en-dark.png` and `teacher-desktop-en-dark.png`, and confirm:
- The title and the first card sit at the **right** edge in Arabic and the **left** in English; the next card runs to the screen edge (it visibly scrolls).
- There is **no faint hard line** under the phone cards (the shadow has room).
- The desktop grid lines up with the search box edges, three across.
- The third desktop card (its thumbnail fails on purpose) is a plain tile with the play button, **no icon above it**.
- The English cards carry the «Arabic narration» tag; the Arabic ones do not.
- Dark mode keeps the card border.

- [ ] **Step 5: Remove the fixture, stop the server, and prove the tree is the shipping state**

With the Edit tool restore the line to `export const HELP_VIDEOS: readonly HelpVideo[] = [];` (the exact reverse of Step 1). Then:

```bash
pkill -f "[s]erve.mjs"
cd ../
git status --short                                   # expect: nothing listed (dist/ is ignored)
grep -c "fixture-teacher" artifacts/mobile/services/helpVideos.ts    # expect 0
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/helpVideos.test.ts 2>&1 | grep -E "^# (pass|fail)"   # expect pass 19, fail 0
```

Note: `pkill -f "[s]erve.mjs"` (with the brackets) matters. `pkill -f "node serve.mjs"` also matches its own shell and kills the session.

---

### Task 4: Correct the spec, write it up, open the PR

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md`
- Modify: `docs/status-log.md`

**Interfaces:**
- Consumes: the verification from Task 3.
- Produces: a draft PR.

- [ ] **Step 1: Make the spec say what shipped (four Edit-tool replacements)**

In `docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md`:

(a) replace

```
| The catalog type, `HELP_VIDEOS`, `helpVideosFor`, `formatVideoLength`, `helpVideoWatchUrl` | `services/helpVideos.ts` | yes |
```

with

```
| The catalog type, `HELP_VIDEOS`, `helpVideosFor`, `validateCatalog`, `formatVideoLength`, the URL helpers (`helpVideoWatchUrl`, `helpVideoPlayUrl`, `helpVideoThumbnailUrl`) and `narrationTagVisible` | `services/helpVideos.ts` | yes |
```

(b) replace

```
  reversed row and `scrollToEnd` on `onContentSizeChange` when `isRTL`.
```

with

```
  reversed row and `scrollToEnd` on `onContentSizeChange` when `isRTL`. The scroller reaches `SPACE.lg` into the FAQ's
  own padding and its content is padded by the same, so the card shadow (18 pt below, 14 pt to each side) is not
  clipped.
```

(c) replace

```
- **Wide (the column is at least 600 pt wide):** a wrapping grid, three cards per row, gap `SPACE.md`. Narrower than
  that, the horizontal row above, whatever the platform.
```

with

```
- **Wide (the window is at least 640 pt wide, which makes the FAQ column at least 600):** a wrapping grid, three cards
  per row, gap `SPACE.md`. Narrower than that, the horizontal row above, whatever the platform.
```

(d) replace

```
  tag when it applies. If the thumbnail fails or the device is offline, a neutral `IconTile` with
  `play-circle-outline` stands in; the card still works.
```

with

```
  tag when it applies. If the thumbnail fails or the device is offline, the plain tile shows with the play button
  still on it (an icon above the button looked cluttered); the card still works.
```

and replace

```
`void openExternal(youtubeEmbedUrl(helpVideoWatchUrl(video)))`. If the embed URL were ever `null`, fall back to the
watch URL. The event follows the existing `<noun>_opened` naming (`virtual_lab_opened`).
```

with

```
`void openExternal(helpVideoPlayUrl(video))`: the nocookie embed URL built from `helpVideoWatchUrl`, or the watch URL
itself if the embed URL could not be built. The event follows the existing `<noun>_opened` naming
(`virtual_lab_opened`).
```

- [ ] **Step 2: Add the status-log entry at the TOP of `docs/status-log.md`**

Directly under the header paragraph (above the newest entry), add this. Change a number only if your own run differs; never write a result you did not see.

```markdown
## Help-center video shelf: the mechanism, shipped empty, 2026-10-27

**Why.** The scripts for the first five tutorial videos are in `docs/tutorial-videos-ar.md`; this is where they will live. Spec:
`docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md`. **The catalog is empty on purpose: nothing is visible to any user
until the first video is added**, one small PR per video.

**Built.** `services/helpVideos.ts` (pure: the type, the empty `HELP_VIDEOS`, `helpVideosFor` by role and by title with the FAQ's Arabic
folding, `validateCatalog`, URL and length helpers); `components/help/HelpVideoShelf.tsx` (a row that scrolls sideways on a phone, a grid of
three from a 640 pt window; opens a video through `openExternal`; draws nothing when the reader has none); mounted first in the FAQ column;
three i18n keys. No dependency, native module, `app.json` `version`, schema or env change, so no production OTA is needed.

**Verified.** 19 new unit tests (role filter, search folding, validator, formatting, links), mutation-checked: breaking the role filter fails
3 of them. Typecheck: no new errors. The design-scale, aria, icon, i18n (parity and terminology), corner and status-bar guard tests pass.
In a built web bundle with three throwaway fixture videos (removed, never committed): 50 browser checks over teacher/student/parent ×
phone/desktop × ar/en × light/dark (visibility per role, layout, RTL start edge, no page overflow, search narrows the shelf, a no-match
query hides it, a tap opens the nocookie embed URL of the first card), and the screenshots were read for shadow clipping and the fallback tile.

**Not verified.** Nothing was seen on a real phone or in a native build; the `WebBrowser` open of the embed page on Android is untried.
YouTube on school networks, and the "Made for kids" / ads settings for student and parent videos, are still open (see the spec). No real
video is in the catalog, so a real thumbnail, a dead link and an embed-disabled video have not been seen. The FAQ itself is still
role-blind (a student sees the teacher-worded questions); unchanged here.
```

- [ ] **Step 3: Run the whole mobile suite**

```bash
cd artifacts/mobile && pnpm test        # silent for minutes; wait for it
```

Expected: `# fail 0`. Also run the brand check CI runs, from the repo root:

```bash
cd ../.. && named=(artifacts/mobile/services/i18n.ts); paths=(artifacts/*/src artifacts/mobile/app artifacts/mobile/components artifacts/mobile/services ':!*i18nTerminology.test.ts')
if git grep -nI 'اقرأ' -- "${named[@]}" || git grep -nI '«اقرأ»' -- "${paths[@]}"; then echo "BRAND CHECK WOULD FAIL"; else echo "brand check: clean"; fi
```

Expected: `brand check: clean`.

- [ ] **Step 4: Commit, push, open a draft PR**

```bash
git add docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md docs/status-log.md
git diff --cached --stat        # two modified files, no "Bin" line
git commit -m "Help videos: write up the shelf and correct the spec to match it"
git push -u origin feat/help-video-shelf
```

Open the PR as a **draft**. Title: `Help-center video shelf: the mechanism, shipped empty`. In the body: what it is (one paragraph), *Verified* and *Not verified* copied from the status-log entry, and these two lines under **Notes**: *"With an empty catalog nothing is visible, so no production OTA is needed."* and *"Every merge to `main` deploys all three services; this PR changes app code, so CI's full suite applies."*

Then watch CI. A failure in a file this PR does not touch (the api-server `familyHomework.db.test.ts` has shown a teardown race that passes on a re-run) is not this PR's; say so once on the PR and re-run the job once. Do not merge until you are told to.

---

## Self-review (done when this plan was written)

- **Spec coverage:** role filter and admin-sees-none (Task 1 tests; Task 2 uses `tourRoleOf`, `null` hides) · search by title with Arabic folding and every-word semantics (Task 1) · empty-catalog-renders-nothing (Task 1 test + component `return null`; Task 3 shows it with entries) · narration tag in the English UI (`narrationTagVisible`, Task 3 screenshots) · phone row and wide grid and RTL scroll (Task 2 + Task 3) · card anatomy, fallback tile, a11y label, 44 pt (Task 2 + Task 3) · playback through `openExternal` of the nocookie embed (Task 1 test of the URL; Task 3 tap check) · analytics `help_video_opened {id, role, surface}` (Task 2; **not asserted by a test**, since `trackEvent` is a network call and the component cannot be loaded by `node --test`; Task 3's tap check proves the open, not the event) · tests including mutation checks (Task 1) · rollout step 1 (the whole plan) · out-of-scope items (nothing in this plan touches the tour, `appHelp`, the Library, the server or a player).
- **Placeholders:** none. The only judgement left to the implementer is replacing a number in the status-log entry if their own run differs, which the step says.
- **Type consistency:** every name Task 2 and Task 3 use (`HELP_VIDEOS`, `helpVideosFor`, `helpVideoPlayUrl`, `helpVideoThumbnailUrl`, `formatVideoLength`, `narrationTagVisible`, `HelpVideo`) is defined in Task 1 with the signature listed under its **Produces**.


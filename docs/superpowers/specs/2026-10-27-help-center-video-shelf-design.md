# Help-center video shelf — design

2026-10-27. **Status: the mechanism is built and shipped with an empty catalog on 2026-10-27; the first real video is
still to come.** The scripts the videos are made from are [`docs/tutorial-videos-ar.md`](../../tutorial-videos-ar.md).
The write-up of what was verified is the top entry of [`docs/status-log.md`](../../status-log.md), «Help-center video
shelf: the mechanism, shipped empty».

## Why

The first-run tour (live 2026-10-27) shows a new user *where* things are. It cannot show *how*: make a quiz, send it
to students, link a child. Short screen-recorded videos can.

They do not belong in the Library. Every Library item needs a grade and a subject (the admin upload form refuses one
without, and `listLibrary(gradeId)` loads per grade), and students see that screen, so an app tutorial would be filed
under an arbitrary grade among curriculum material. The place someone looks for help is
Profile → «كيف أستخدم إقرأ؟» (`app/faq.tsx`).

## Decisions taken with the owner

- **Audience:** every role, each seeing only its own videos (teacher, student, parent). An admin sees none.
- **Host:** unlisted YouTube, opened through the existing `openExternal`.
- **Catalog:** a static, typed list inside the app. Adding a video is a small PR plus a manual `production` publish.
- **v1 ships the mechanism with an empty catalog**, which renders nothing. Users see no change until the first real
  video is added.
- **Not in v1:** a server-managed catalog with an admin screen; an in-app player; changes to the tour or the
  assistant's help rules.

## What the code already gives us (read, not run)

| Fact | Where |
|---|---|
| The FAQ has no role concept: an entry is `{ q, a, category }`, every role sees the same 18, and `/faq` is on the non-teacher allowlist. The shelf is the first role-aware part of that screen. The FAQ's own role-blindness is an existing gap and is **not** changed here. | `services/faqContent.ts`, `services/routeGating.ts` |
| Every video in the app opens through `openExternal`: an in-app browser on native (the back gesture returns to the app), a new tab on web. | `services/externalLinks.ts`, `app/curriculum/resources.tsx`, `components/ui/LessonMediaPanel.tsx` |
| There is no video **player**. `expo-video-thumbnails` only extracts still frames. An in-app player would need a native module, a native build and an `app.json` `version` bump (runtime version is `1.5.0`; the OTA only reaches a binary with the same one). | `artifacts/mobile/package.json` |
| Pure YouTube helpers exist: `youtubeIdFrom(url)`, `youtubeEmbedUrl(url)` (youtube-nocookie, `rel=0`), `youtubeThumbnail(url)`. | `services/classMedia.ts`, `services/resourceThumbnail.ts` |
| `tourRoleOf(role)` maps a user to `teacher` / `student` / `parent` / `null`. | `services/tour.ts` |
| The FAQ's horizontal chip row already solves RTL (reversed row, `scrollToEnd` when `isRTL`). | `app/faq.tsx` |
| `t()` does not interpolate, so labels that mix text and a number are composed in code. | `services/i18n.ts` |
| No server-managed app content exists to copy. | searched `api-server` and `lib/db` |

## Shape

| Piece | Where | Pure? |
|---|---|---|
| The catalog type, `HELP_VIDEOS`, `helpVideosFor`, `validateCatalog`, `formatVideoLength`, the URL helpers (`helpVideoWatchUrl`, `helpVideoPlayUrl`, `helpVideoThumbnailUrl`) and `narrationTagVisible` | `services/helpVideos.ts` | yes |
| The shelf (cards, thumbnails, press) | `components/help/HelpVideoShelf.tsx` | no |
| Mounted as the first child of the FAQ column, above the search box | `app/faq.tsx` | no |
| Copy for the shelf (Arabic and English) | `services/i18n.ts` | |
| Tests | `services/__tests__/helpVideos.test.ts` | |

`node --test` loads only the pure module (the mobile runner has no React Native transform, and only
`services/__tests__/**` is globbed), which is where nearly all the logic lives. The pure module imports no
`react-native` and takes the role as a parameter, so it does not depend on `tour.ts`; the component calls
`tourRoleOf(user?.role)`.

## Data

```ts
export type HelpVideoRole = 'teacher' | 'student' | 'parent';

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

export const HELP_VIDEOS: readonly HelpVideo[] = [];   // v1 ships empty
```

Order is array order. There are no placeholder entries: an entry always has a real video, so the shelf never shows a
dead card, and the tests can validate every entry.

The planned first five (ids, roles) come from `docs/tutorial-videos-ar.md`: `teacher-today`, `teacher-quick-quiz`,
`teacher-send-exam` (teacher); `student-join` (student); `parent-follow` (parent). Their title keys are
`helpVid<PascalId>Title`, added in the PR that adds the video.

## Behaviour

`helpVideosFor(catalog, role, query, t)`:

- `role` is `null` (admin, signed out): `[]`.
- Otherwise the catalog filtered to videos whose `roles` include `role`, in order.
- A non-empty `query` keeps a video only if **every word** of the query appears in its resolved title, both folded
  with `foldForSearch` (`services/faqContent.ts`) so «الاسئله» finds «الأسئلة». Same semantics as `filterFaq`.
- The catalog is a parameter, so tests pass fixtures. The screen passes `HELP_VIDEOS`.

On the screen:

- The category chips filter FAQ entries only; they do not touch the shelf.
- **No videos match → the shelf renders nothing** (no title, no gap). This is also the whole v1 state.
- In the English UI each card carries a small tag «Arabic narration» (`helpVideoNarrationAr`), so an English-UI user
  is not surprised by the audio.

## UI

- **Mount:** first child of `<View style={styles.column}>` in `app/faq.tsx`, above the search box. The column is
  `maxWidth: 760`.
- **Section:** a title (`helpVideosTitle`: «فيديوهات قصيرة» / "Short videos") and the cards.
- **Phone:** a horizontal `ScrollView`, card width `min(260, 72% of the window)`. RTL as the chip row does it: a
  reversed row and `scrollToEnd` on `onContentSizeChange` when `isRTL`, and also from a 60 ms timeout effect keyed on
  `[isRTL, wide]`, the same as the FAQ's chip row, because on web `onContentSizeChange` can fire before the scroller has
  a width. The scroller reaches `SPACE.lg` into the FAQ's own padding and its content is padded by the same, so the
  card shadow (18 pt below, 14 pt to each side) is not clipped.
- **Wide (the window is at least 640 pt wide, which makes the FAQ column at least 600):** a wrapping grid, three cards
  per row, gap `SPACE.md`. Each card is 31% of the row and does not grow, so one, two or four videos keep the size of a
  card in a row of three. A row of three starts flush at the start edge and stops up to about 29 pt (about 4%) short
  of the search box's end edge; a fourth card starts a second row. Narrower than that, the horizontal row above,
  whatever the platform.
- **Card:** a 16:9 thumbnail (`youtubeThumbnail`, `expo-image`), a centred play glyph in a black-based scrim circle,
  a duration pill (`m:ss`, `formatVideoLength`) in a corner, then the title in at most two lines, then the narration
  tag when it applies. If the thumbnail fails or the device is offline, the plain tile shows with the play button
  still on it (an icon above the button looked cluttered); the card still works.
- **Design-system rules (CLAUDE.md):** the card takes `useSurface()` and **drops its own `borderWidth: 1`** (a
  light surface has no border colour, so a leftover width draws black); no `overflow: 'hidden'` on the surface (clip
  the thumbnail on an inner view); `PressableScale` for the press; `Entrance` for the stagger, with motion off under
  `useReduceMotion()`; colours from `useColors()`; icons on the `ICON` scale; no hand-written hex.
- **Accessibility:** `accessibilityRole="button"`, a 44 pt target, `aria-*` state (never `accessibilityState`), and a
  label composed in code as `"<title>، <m:ss>. <helpVideoOpensInBrowser>"`, where the title and the length are
  joined with ', ' in the English UI and with the Arabic comma `،` in the Arabic UI. The brand focus ring on web, as
  other pressables.

## Playback and analytics

On press: `trackEvent('help_video_opened', { id, role, surface: 'faq' })`, then
`void openExternal(helpVideoPlayUrl(video))`: the nocookie embed URL built from `helpVideoWatchUrl`, or the watch URL
itself if the embed URL could not be built. The event follows the existing `<noun>_opened` naming
(`virtual_lab_opened`).

No new `EXPO_PUBLIC_*` key. **Success measure:** opens per new account in its first 14 days, read next to
`tour_completed`. Watch completion is not measurable: playback leaves the app.

## Tests (`services/__tests__/helpVideos.test.ts`)

- Every entry: `id` unique and kebab-case; `youtubeId` matches `/^[A-Za-z0-9_-]{11}$/` and is unique; `roles` is a
  non-empty subset of the three; `seconds` is an integer from 15 to 300; `titleKey` exists in **both** the Arabic and
  English tables; the English title never spells the product «Iqraa» or «Iqra» (it is «Iqrra»), and the Arabic title
  never quotes the brand as «اقرأ».
- The shipped catalog is valid, **including empty**: `helpVideosFor(HELP_VIDEOS, r, '', t)` is `[]` for every role.
- With fixtures: a teacher video is never returned for a student or a parent (the role leak); `null` role returns
  `[]`; order is kept; a multi-word query needs every word; Arabic folding finds «الاسئله».
- `formatVideoLength`: `70 → "1:10"`, `600 → "10:00"`, `65 → "1:05"`.
- Mutation-checked: a duplicated id, a bad `youtubeId`, a missing English title and a widened `roles` each make a test
  fail.

The existing source scans cover the component without new work: `designScale`, `ariaState`, `iconSystem`, `i18n`
(key parity) and `i18nTerminology`. The component itself cannot be loaded by `node --test`.

## Rollout

1. **PR A (the mechanism):** the type, the empty catalog, `helpVideosFor`, the shelf, the FAQ mount, the shelf strings,
   the tests, a status-log entry. Nothing is visible. Verification adds **throwaway fixture entries locally**
   (never committed; the check used three, then five, across two builds) and checks the built web bundle at phone and
   desktop widths, Arabic and English, light and dark; then reverts them. The first real video's PR is the first time a
   real card ships.
2. **One PR per video (or a batch)**, after it is recorded and checked: the catalog entry plus its title keys. Then
   `gh workflow run mobile-update.yml -f branch=production`.
3. **Later, optional:** one sentence in `tourProfileBody` and an `appHelp` rule pointing at the shelf — only once every
   role has at least one video, so the tour never promises one that is not there.

**Adding a video checklist:** record from `docs/tutorial-videos-ar.md` and clear its «تحقّق قبل التصوير» list; upload to
YouTube as **Unlisted**, embedding allowed, comments off, ads off; decide the "Made for kids" setting (owner) for
student and parent videos; open the embed URL once on web and once on an Android phone; add the entry and its two
title keys; run the mobile tests; PR; publish.

## Risks and what is not verified

- **YouTube may be blocked on school networks** in the target markets. Not checked. If it is, the answer is
  self-hosting in R2 with an in-app player, which is a native build and a version bump.
- **Ads, monetization and "Made for kids"** matter for student and parent videos (minors). A decision for the channel
  owner, not something the code can settle.
- **A deleted or embedding-disabled video is a dead card** the code cannot detect. The checklist's "open it once"
  is the only guard, and it does not catch a video removed later.
- **Android `WebBrowser` opening the nocookie embed page** has not been tried on a device. If it misbehaves, open the
  plain watch URL instead.
- **The FAQ is role-blind** (a student sees teacher-oriented questions under a teacher-worded subtitle). Unchanged by
  this work; worth its own change.

## Out of scope

A server-managed catalog and its admin screen; an in-app player; caption tracks (captions are burned in); per-lesson
videos; the Library; changes to the tour or to `appHelp`; making FAQ entries role-aware.

## Open questions

None blocking. One to settle before the first student or parent video: who owns the YouTube channel's "Made for kids"
and ads settings.

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
/** The old quoted brand spelling, built from code points so this file never holds it as a literal. */
const OLD_QUOTED_BRAND = String.fromCodePoint(0xab, 0x627, 0x642, 0x631, 0x623, 0xbb);

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
      } else if (lang === 'ar' && title.includes(OLD_QUOTED_BRAND)) {
        problems.push(`${who}: the Arabic title quotes the brand the old way (hamzat wasl); it is «إقرأ»`);
      }
    }
  }
  return problems;
}

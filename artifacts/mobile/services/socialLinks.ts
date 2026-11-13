/**
 * «تابعنا» — Iqrra's own social media accounts, shown as a row of icons at the
 * foot of the Profile tab (`app/(tabs)/profile.tsx`) for every role.
 *
 * Pure data, no react-native import, so `node --test` can pin it
 * (`services/__tests__/socialLinks.test.ts`): every link is https, and its host
 * belongs to the platform it is drawn as. A wrong handle sends a teacher — or a
 * student, who is a minor — to a stranger's account wearing our name, so an
 * account goes in here only once we own it, with the URL copied from the
 * account itself, never guessed from a handle plan (docs/marketing-plan.md
 * names `@iqrra` "where it is free", which is a wish, not an address).
 *
 * The row is hidden while the list is empty. Order here is the order drawn.
 */
import type { Lang } from './i18n.ts';

export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'whatsapp'
  | 'telegram'
  | 'threads';

export type SocialLink = { platform: SocialPlatform; url: string };

type PlatformInfo = {
  /** An Ionicons glyph name; `socialLinks.test.ts` checks it exists. */
  icon: string;
  name: Record<Lang, string>;
  /** The hosts a link to this platform may point at. */
  hosts: readonly string[];
};

export const SOCIAL_PLATFORMS: Record<SocialPlatform, PlatformInfo> = {
  instagram: { icon: 'logo-instagram', name: { ar: 'إنستغرام', en: 'Instagram' }, hosts: ['instagram.com', 'www.instagram.com'] },
  tiktok: { icon: 'logo-tiktok', name: { ar: 'تيك توك', en: 'TikTok' }, hosts: ['tiktok.com', 'www.tiktok.com'] },
  facebook: { icon: 'logo-facebook', name: { ar: 'فيسبوك', en: 'Facebook' }, hosts: ['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com'] },
  youtube: { icon: 'logo-youtube', name: { ar: 'يوتيوب', en: 'YouTube' }, hosts: ['youtube.com', 'www.youtube.com', 'youtu.be'] },
  linkedin: { icon: 'logo-linkedin', name: { ar: 'لينكدإن', en: 'LinkedIn' }, hosts: ['linkedin.com', 'www.linkedin.com'] },
  x: { icon: 'logo-x', name: { ar: 'إكس', en: 'X' }, hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'] },
  whatsapp: { icon: 'logo-whatsapp', name: { ar: 'واتساب', en: 'WhatsApp' }, hosts: ['whatsapp.com', 'www.whatsapp.com', 'wa.me', 'chat.whatsapp.com'] },
  telegram: { icon: 'paper-plane-outline', name: { ar: 'تيليغرام', en: 'Telegram' }, hosts: ['t.me', 'telegram.me'] },
  threads: { icon: 'logo-threads', name: { ar: 'ثريدز', en: 'Threads' }, hosts: ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'] },
};

/** Iqrra's accounts, in the order drawn. Only accounts we own — see the header. */
export const SOCIAL_LINKS: readonly SocialLink[] = [];

/** Why `link` may not be shown, or null when it may. */
export function socialLinkProblem(link: SocialLink): string | null {
  const info = SOCIAL_PLATFORMS[link.platform];
  if (!info) return `unknown platform ${String(link.platform)}`;
  let parsed: URL;
  try {
    parsed = new URL(link.url);
  } catch {
    return `not a URL: ${link.url}`;
  }
  if (parsed.protocol !== 'https:') return `not https: ${link.url}`;
  if (!info.hosts.includes(parsed.hostname.toLowerCase())) return `${parsed.hostname} is not ${link.platform}`;
  return null;
}

/** «تابع إقرأ على إنستغرام» — what a screen reader says for one icon. */
export function socialLinkLabel(platform: SocialPlatform, lang: Lang): string {
  const name = SOCIAL_PLATFORMS[platform].name[lang];
  return lang === 'ar' ? `تابع «إقرأ» على ${name}` : `Follow Iqrra on ${name}`;
}

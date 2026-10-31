/**
 * Who holds a roster name. The server sends, per student, the accounts linked
 * to that row (`GET /classes/:id`); these helpers pick what a row shows.
 */
import { dateLocale } from './dateLabels.ts';

export type RosterLinkRelation = 'self' | 'guardian';

export interface RosterLink {
  userId: string;
  relation: RosterLinkRelation;
  firstName: string;
  lastName: string;
  /** ISO instant the link was made. */
  linkedAt: string;
}

/** The student's own account — the one a teacher checks "is this really them". Parents are on the key screen. */
export function selfLink(links: readonly RosterLink[] | undefined): RosterLink | null {
  return links?.find(l => l.relation === 'self') ?? null;
}

/**
 * Who a «رسالة» tap on a roster row should open a chat with. One linked account
 * is unambiguous. With several (a student and two parents) the app must not
 * pick for the teacher — a message to the wrong family cannot be unsent — so it
 * says "choose" and the screen sends them to the inbox's picker. `null` when
 * nobody has joined, where there is nobody to write to.
 */
export type ChatTarget = { kind: 'direct'; userId: string } | { kind: 'choose' } | null;

export function chatTarget(links: readonly RosterLink[] | undefined): ChatTarget {
  const accounts = [...new Set((links ?? []).map(l => l.userId))];
  if (accounts.length === 0) return null;
  if (accounts.length === 1) return { kind: 'direct', userId: accounts[0] };
  return { kind: 'choose' };
}

export function linkDisplayName(link: Pick<RosterLink, 'firstName' | 'lastName'>): string {
  return `${link.firstName} ${link.lastName}`.replace(/\s+/g, ' ').trim();
}

/** "23 Oct" / «23 تشرين الأول» (Latin digits, like every interface date), in Amman time like every other school date here. Empty for an unreadable value. */
export function formatLinkedOn(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(dateLocale(lang === 'ar' ? 'ar' : 'en'), {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Amman',
  });
}

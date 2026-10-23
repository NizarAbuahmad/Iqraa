/**
 * Who holds a roster name. The server sends, per student, the accounts linked
 * to that row (`GET /classes/:id`); these helpers pick what a row shows.
 */
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

export function linkDisplayName(link: Pick<RosterLink, 'firstName' | 'lastName'>): string {
  return `${link.firstName} ${link.lastName}`.replace(/\s+/g, ' ').trim();
}

/** "23 Oct" / «٢٣ أكتوبر», in Amman time like every other school date here. Empty for an unreadable value. */
export function formatLinkedOn(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Amman',
  });
}

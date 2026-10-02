/**
 * The link between a deck on screen and the workspace item it is saved as.
 *
 * Slides and Prompt Slides look their deck up in موادي by identity (type,
 * title, grade, subject, topic) so the save button survives leaving the
 * screen, and they used to auto-sync every later change into whatever that
 * lookup found. Identity is not content: regenerating a lesson the teacher
 * had saved and then edited found the stored copy by its title and pushed the
 * fresh deck over the edits, with nothing on screen to say so.
 *
 * So auto-sync is now a property of the link, not of having an id. It holds
 * only for a deck this screen saved itself, or one whose stored copy is
 * byte-identical to what is on screen. A stored item that differs is adopted
 * for its id — so pressing Save updates that item instead of making a
 * duplicate — but nothing is written to it until the teacher says so.
 *
 * Free of react-native so `node --test` can load it.
 */

export interface DeckLink {
  /** The workspace item this deck corresponds to, or null. */
  savedId: string | null;
  /** May changes on screen be written to `savedId` without asking? */
  autoSync: boolean;
  /** What the stored item is known to hold, so a sync writes only real changes. */
  savedContent: string;
}

export const NO_LINK: DeckLink = { savedId: null, autoSync: false, savedContent: '' };

/** The screen just stored `content` as `id`: from here on it follows the deck. */
export function linkAfterSave(id: string, content: string): DeckLink {
  return { savedId: id, autoSync: true, savedContent: content };
}

/**
 * What a workspace lookup hit means for the deck on screen. Null when nothing
 * matched. A hit is followed only when it holds exactly `onScreen`.
 */
export function linkFromMatch(
  match: { id: string; content: string } | null,
  onScreen: string,
): DeckLink | null {
  if (!match) return null;
  return { savedId: match.id, autoSync: match.content === onScreen, savedContent: match.content };
}

/** The write the sync effect should make, or null when it must make none. */
export function pendingSync(link: DeckLink, onScreen: string): { id: string; content: string } | null {
  if (!link.savedId || !link.autoSync || onScreen === link.savedContent) return null;
  return { id: link.savedId, content: onScreen };
}

/**
 * What pressing the save button does. A followed deck is un-saved (the button
 * is a bookmark); an adopted-but-differing one is overwritten, because the
 * teacher has now asked for exactly that; anything else is stored new.
 */
export function saveAction(link: DeckLink): 'create' | 'update' | 'delete' {
  if (!link.savedId) return 'create';
  return link.autoSync ? 'delete' : 'update';
}

/** Whether the button may say «محفوظ»: only when the stored copy is the deck on screen. */
export function showsSaved(link: DeckLink): boolean {
  return !!link.savedId && link.autoSync;
}

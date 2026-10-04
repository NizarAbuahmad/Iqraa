import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { ClassroomActivity } from '@/services/ai/AIService';
import { deleteItem, getAllItems, saveItem, updateItem } from '@/services/workspace';
import { findMatchingItem, type MaterialIdentity } from '@/services/savedMaterialMatch';
import { buildDeckSlidesHTML, exportAsPDF } from '@/services/share';
import {
  NO_LINK, linkAfterSave, linkFromMatch, pendingSync, saveAction, showsSaved, type DeckLink,
} from '@/services/deckSaveLink';
import { reopenedDeckLink } from '@/services/savedDeck';
import type { TranslationKey } from '@/services/i18n';

/** What `restore` needs to put a deck's workspace link back exactly as it was. */
export type DeckWorkspaceSnapshot = { link: DeckLink; lookedUpKey: string | null };

/**
 * The save toggle, its workspace lookup and sync, and the PDF/PPTX exports
 * for a deck on screen — shared by Slides and Prompt Slides.
 *
 * The two screens each carried a ~150-line copy of this, and the copies had
 * drifted: Slides swallowed export failures silently, Prompt Slides logged
 * them. This keeps the logging variant — a teacher reporting "the export
 * doesn't work" otherwise gives us nothing to act on.
 *
 * The lookup/sync rule lives in `services/deckSaveLink.ts`, where it is
 * tested: a stored item is followed only when this screen saved it or its
 * content is exactly the deck on screen. Following any identity match is how
 * a regenerated deck silently overwrote a saved, edited one.
 */
export function useDeckWorkspace(config: {
  deck: ClassroomActivity | null;
  /** False while the deck on screen is a placeholder about to be replaced. */
  lookupEnabled?: boolean;
  /** What the deck is, in workspace terms — read at save and at lookup. */
  identity: (deck: ClassroomActivity) => MaterialIdentity;
  /** The form the deck was built from, so موادي can reopen it. */
  formState: () => Record<string, unknown>;
  /** Base filename for the exports, without extension. */
  exportName: (deck: ClassroomActivity) => string;
  isAr: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
  showToast: (message: string) => void;
  /** Prefix for logged export failures. */
  logTag: string;
}) {
  const { deck, lookupEnabled = true, identity, formState, exportName, isAr, t, showToast, logTag } = config;

  const [link, setLinkState] = useState<Pick<DeckLink, 'savedId' | 'autoSync'>>(NO_LINK);
  const savedId = link.savedId;
  const [savingBusy, setSavingBusy] = useState(false);
  /**
   * What the workspace copy currently holds, so an edit made after saving is
   * pushed to that item. Without it the button would keep claiming "saved"
   * over a stored deck that no longer matches what is on screen.
   */
  const savedContentRef = useRef('');
  /**
   * The deck identity already looked up in the workspace. Once per identity,
   * not once per render: `deck` is replaced by every edit and by the media
   * passes, and re-running after an un-save could re-adopt an older duplicate.
   */
  const lookedUpKeyRef = useRef<string | null>(null);

  const currentLink = (): DeckLink => ({ ...link, savedContent: savedContentRef.current });
  const setLink = (next: DeckLink) => {
    savedContentRef.current = next.savedContent;
    setLinkState({ savedId: next.savedId, autoSync: next.autoSync });
  };

  /**
   * Drop the link to a workspace item without touching the item itself. The
   * class prompt goes with it: it names a material this screen is no longer
   * tracking, and on an un-save that material no longer exists.
   */
  const forget = () => setLink(NO_LINK);
  const snapshot = (): DeckWorkspaceSnapshot => ({ link: currentLink(), lookedUpKey: lookedUpKeyRef.current });
  const restore = (snap: DeckWorkspaceSnapshot) => {
    setLink(snap.link);
    lookedUpKeyRef.current = snap.lookedUpKey;
  };

  /**
   * Take up a deck reopened from موادي: it IS the stored item, so the screen
   * follows it from the first frame instead of looking it up by identity.
   * `identityOf` is what the deck is in workspace terms, passed in because the
   * screen's own state has not caught up with the deck it is about to show —
   * and recorded as already looked up, so un-saving does not go hunting for an
   * older duplicate to adopt.
   */
  const adopt = (id: string, loaded: ClassroomActivity, identityOf: MaterialIdentity) => {
    setLink(reopenedDeckLink(id, loaded));
    lookedUpKeyRef.current = JSON.stringify(identityOf);
  };

  /**
   * Save, or un-save. The button reads as a bookmark, so it behaves like one:
   * the second press removes the material it created rather than storing the
   * same deck twice. A stored copy that was adopted but differs from the deck
   * on screen is overwritten instead — the teacher has now asked for that.
   */
  const toggleSave = async () => {
    if (!deck || savingBusy) return;
    setSavingBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const action = saveAction(currentLink());
      if (action === 'delete' && savedId) {
        await deleteItem(savedId);
        forget();
        showToast(t('slidesUnsaved'));
        return;
      }
      const content = JSON.stringify(deck);
      const fields = { ...identity(deck), content, formState: formState() };
      // `false` means the adopted item is gone (deleted elsewhere): store anew.
      if (action === 'update' && savedId && await updateItem(savedId, fields)) {
        setLink(linkAfterSave(savedId, content));
        showToast(t('slidesSaved'));
        return;
      }
      const item = await saveItem(fields);
      setLink(linkAfterSave(item.id, content));
      showToast(t('slidesSaved'));
      // Every save creates a new workspace item — including a re-save after an
      // un-save — so every save asks which class that item belongs to.
    } finally {
      setSavingBusy(false);
    }
  };

  /**
   * Pick the button's state back up from the workspace.
   *
   * `savedId` is screen state, so it died with the screen: a teacher who saved
   * a deck, went to look at موادي and came back found the button offering to
   * save again, and pressing it made a second copy instead of removing the
   * first. The workspace is what actually remembers, so ask it.
   */
  useEffect(() => {
    if (!deck || savedId || !lookupEnabled) return;
    const id = identity(deck);
    const onScreen = JSON.stringify(deck);
    const key = JSON.stringify(id);
    if (lookedUpKeyRef.current === key) return;
    lookedUpKeyRef.current = key;
    let cancelled = false;
    void (async () => {
      try {
        // Seeded from the STORED copy, and followed only when it IS this
        // deck — a differing match is adopted for its id alone.
        const adopted = linkFromMatch(findMatchingItem(await getAllItems(), id), onScreen);
        if (cancelled || !adopted) return;
        setLink(adopted);
      } catch {
        // Offline, or the workspace is unreachable. The button stays on
        // "احفظ" — the honest state for a screen that cannot tell.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck, savedId, lookupEnabled]);

  // Slide edits, and the media/video passes that land after generation, both
  // replace the deck. While this screen follows the saved copy, it follows.
  useEffect(() => {
    if (!deck) return;
    const sync = pendingSync(currentLink(), JSON.stringify(deck));
    if (!sync) return;
    savedContentRef.current = sync.content;
    void updateItem(sync.id, { title: deck.activityName, content: sync.content }).catch(() => {
      // The deck on screen is the source of truth; a failed sync is not worth
      // interrupting the teacher over.
    });
  }, [deck, link]);

  // Exports the DECK — same slides, same accents, same verification badges
  // the teacher just saw and edited on screen.
  const exportPdf = async () => {
    if (!deck) return;
    try {
      await exportAsPDF(buildDeckSlidesHTML(deck, isAr), `${exportName(deck) || 'slides'}.pdf`);
    } catch (e) {
      // Logged, not just toasted: the failure is legible only here.
      console.error(`[${logTag}] PDF export failed`, e);
      showToast(t('generationFailed'));
    }
  };

  const [exportingPptx, setExportingPptx] = useState(false);
  const exportPptx = async () => {
    if (!deck || exportingPptx) return;
    setExportingPptx(true);
    try {
      const { exportDeckAsPptx } = await import('@/services/exportPptx');
      await exportDeckAsPptx(deck, isAr, exportName(deck) || 'slides');
    } catch (e) {
      console.error(`[${logTag}] PPTX export failed`, e);
      showToast(t('generationFailed'));
    } finally {
      setExportingPptx(false);
    }
  };

  return {
    savedId,
    /** Lit only when the stored copy IS the deck on screen. */
    saved: showsSaved(currentLink()),
    savingBusy,
    toggleSave,
    forget,
    adopt,
    snapshot,
    restore,
    exportPdf,
    exportPptx,
    exportingPptx,
  };
}

export type DeckWorkspace = ReturnType<typeof useDeckWorkspace>;

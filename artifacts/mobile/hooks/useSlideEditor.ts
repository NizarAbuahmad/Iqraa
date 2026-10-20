import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ActivitySlide, ClassroomActivity } from '@/services/ai/AIService';
import { rebuildAnswerKey, withoutSlide } from '@/services/lessonSlides';
import { applyMediaEdit, contentAfterMediaEdit, isLikelyImageUrl } from '@/services/classMedia';
import { applySlideTextEdit, pictureSlot, slidePicture, withSlidePicture, type SlidePicture } from '@/services/slideEdit';
import { pickSlidePhoto } from '@/services/slidePhotoPick';
import { searchDeckPhoto } from '@/services/unsplashImage';
import { creditFromPhoto, photoCreditText } from '@/services/photoCredit';
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';

/**
 * Per-slide editing for a deck on screen — shared by Slides and Prompt Slides.
 *
 * The deck is a draft the teacher owns, not a fixed output. Edits live in the
 * same deck state that Present/Save/PDF read, so whatever the teacher fixed is
 * what every downstream surface gets. The two screens each had a copy, and the
 * copies had drifted (see `services/slideEdit.ts` for which rules won).
 *
 * `mediaEditing` turns on the URL/caption fields for media slides — Slides
 * only; Prompt Slides never offered them and still does not.
 */
export function useSlideEditor(config: {
  deck: ClassroomActivity | null;
  setDeck: Dispatch<SetStateAction<ClassroomActivity | null>>;
  isAr: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
  showToast: (message: string) => void;
  mediaEditing?: boolean;
}) {
  const { deck, setDeck, isAr, t, showToast, mediaEditing = false } = config;
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaError, setMediaError] = useState('');
  // The slide's picture as the teacher is changing it; written on Save only.
  const [picture, setPictureState] = useState<SlidePicture | null>(null);
  const [pictureChanged, setPictureChanged] = useState(false);
  const [pictureQuery, setPictureQuery] = useState('');
  const [pictureLink, setPictureLink] = useState('');
  const [suggestPage, setSuggestPage] = useState(0);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pictureError, setPictureError] = useState('');

  const openEdit = (i: number) => {
    if (!deck) return;
    const s = deck.slides[i];
    setTitle(s.title);
    setContent(s.content);
    setAnswer(s.answer ?? '');
    setMediaUrl(s.mediaUrl ?? '');
    setMediaCaption(s.mediaCaption ?? '');
    setMediaError('');
    setPictureState(slidePicture(s, i));
    setPictureChanged(false);
    // Unsplash is an English index: the slide's own photo query, else the
    // deck's. An Arabic lesson deck has neither and the teacher types one.
    setPictureQuery(s.mediaPrompt ?? deck.deckPhotoQueries?.[0] ?? '');
    setPictureLink('');
    setSuggestPage(0);
    setPictureError('');
    setEditIdx(i);
  };

  const editingSlide = editIdx !== null ? deck?.slides[editIdx] : undefined;
  const slot = editingSlide && editIdx !== null ? pictureSlot(editingSlide, editIdx) : null;

  const setPicture = (next: SlidePicture | null) => {
    setPictureState(next);
    setPictureChanged(true);
    setPictureError('');
    // A picture slide's URL field (Slides) shows what Save will write.
    if (slot === 'media' && next) { setMediaUrl(next.url); setMediaCaption(next.caption ?? ''); setMediaError(''); }
  };

  const uploadPicture = async () => {
    setPictureBusy(true);
    try {
      const url = await pickSlidePhoto();
      if (url) setPicture({ url });
    } catch {
      setPictureError(t('slidePictureUploadFailed'));
    } finally {
      setPictureBusy(false);
    }
  };

  /** The next Unsplash result for the query — never the photo already there. */
  const suggestPicture = async () => {
    const query = pictureQuery.trim();
    if (!query) { setPictureError(t('slidePictureNeedQuery')); return; }
    setPictureBusy(true);
    try {
      let page = suggestPage + 1;
      let photo = await searchDeckPhoto(query, page);
      if (photo && photo.url === picture?.url) photo = await searchDeckPhoto(query, ++page);
      setSuggestPage(page);
      if (!photo) { setPictureError(t('slidePictureNoSuggestion')); return; }
      setPicture({ url: photo.url, caption: photoCreditText(photo, isAr), credit: creditFromPhoto(photo) });
    } finally {
      setPictureBusy(false);
    }
  };

  const changePictureLink = (text: string) => {
    setPictureLink(text);
    setPictureError('');
    if (isLikelyImageUrl(text)) setPicture({ url: text.trim() });
  };

  const changePictureQuery = (text: string) => { setPictureQuery(text); setSuggestPage(0); };

  const close = () => setEditIdx(null);

  const applyEdit = () => {
    if (editIdx === null || !deck) return;

    // Media is validated before anything is written: a URL the app cannot
    // embed would project as a blank frame in front of a class and print as a
    // dead link. Refuse it here rather than storing it and finding out live.
    const editing = deck.slides[editIdx];
    // A pasted picture link that is not an image would project as a blank frame.
    if (slot && pictureLink.trim() && !isLikelyImageUrl(pictureLink)) {
      setPictureError(t('mediaUrlUnsupported'));
      return;
    }
    let swapped: ActivitySlide | null = null;
    if (mediaEditing && editing?.type === 'media') {
      const result = applyMediaEdit(editing, { url: mediaUrl, caption: mediaCaption });
      if (!result.ok) { setMediaError(t('mediaUrlUnsupported')); return; }
      swapped = result.slide;
      // The suggested photo's linked credit, which the URL field cannot carry.
      if (pictureChanged && picture?.credit && swapped.mediaUrl === picture.url) {
        swapped = { ...swapped, mediaCredit: picture.credit };
      }
    }
    const index = editIdx;
    const withPicture = (s: ActivitySlide): ActivitySlide => (
      pictureChanged && !swapped ? withSlidePicture(s, index, picture) : s);

    const applyToSlide = (s: ActivitySlide): ActivitySlide => (swapped
      ? { ...swapped, title: title.trim() || s.title, content: contentAfterMediaEdit(editing, swapped, content) }
      : withPicture(applySlideTextEdit(s, { title, content, answer })));
    // By identity, not index — see removeSlide.
    setDeck(cur => {
      if (!cur) return cur;
      const slides = cur.slides.map(s => (s === editing ? applyToSlide(s) : s));
      return { ...cur, slides, answerKey: rebuildAnswerKey(slides, isAr) };
    });
    setEditIdx(null);
    showToast(t('slideUpdated'));
  };

  const removeSlide = async (i: number) => {
    if (!deck) return;
    // Hold the slide itself across the dialog. The media, video and verifier
    // passes keep landing while the teacher reads it, and they replace the
    // deck object — so `deck` here is stale by the time the answer comes back
    // and `i` may no longer point at the slide the teacher chose.
    const target = deck.slides[i];
    const ok = await confirm({
      title: t('deleteSlideTitle'),
      message: target.title,
      confirmLabel: t('deleteLabel'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setDeck(cur => {
      if (!cur) return cur;
      const slides = withoutSlide(cur.slides, target);
      return { ...cur, slides, answerKey: rebuildAnswerKey(slides, isAr) };
    });
  };

  return {
    editIdx,
    /** The slide being edited, or undefined. */
    editing: editingSlide,
    mediaEditing,
    /** Where this slide can show a picture, or null where none would be drawn. */
    pictureSlot: slot,
    picture, removePicture: () => setPicture(null),
    pictureQuery, setPictureQuery: changePictureQuery,
    pictureLink, setPictureLink: changePictureLink,
    pictureBusy, pictureError,
    uploadPicture, suggestPicture,
    title, setTitle,
    content, setContent,
    answer, setAnswer,
    mediaUrl, setMediaUrl,
    mediaCaption, setMediaCaption,
    mediaError, setMediaError,
    openEdit, close, applyEdit, removeSlide,
  };
}

export type SlideEditor = ReturnType<typeof useSlideEditor>;

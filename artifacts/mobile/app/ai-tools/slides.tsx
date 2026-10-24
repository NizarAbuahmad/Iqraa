/**
 * Slides Maker — build a projectable teaching deck for a lesson.
 *
 * Unlike the other generators this one does not always need the AI: when the
 * topic resolves to a curriculum lesson, the book already carries outcomes,
 * vocabulary, concepts and examples, and building the deck from those is both
 * instant and more trustworthy than generating them. The lesson plan is
 * fetched only to fill what the book does not hold (hook, practice, closure),
 * and the screen says which of the two the deck came from.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { contentLang, topicInLang } from '@/services/contentLanguage';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { aiErrorMessageKey, aiErrorText, isAbortError, throwIfAborted } from '@/services/ai/aiProvenance';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { Toast } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { ActivitySlide, ClassroomActivity, LessonPlanOutput, LessonTeachingOutput } from '@/services/ai/AIService';
import { resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
import { usePickedLesson } from '@/hooks/usePickedLesson';
import { carriedLessonTopic } from '@/services/pickedLesson';
import { buildLessonDeck, buildRevisionDeck } from '@/services/lessonSlides';
import { bookFigureUri } from '@/services/bookFigureUri';
import {
  extractGraphCommands, insertLabSlides, insertLessonResources, nextVideoSuggestion,
  shouldSearchForVideo, videoCaption } from '@/services/classMedia';
import type { AttachedResource } from '@/services/classMedia';
import { labSlidesFor } from '@/services/labSlides';
import { LessonLabItems } from '@/components/ui/LessonLabItems';
import { LessonResources } from '@/components/ui/LessonResources';
import { LessonAttachments } from '@/components/ui/LessonAttachments';
import type { LessonMediaItem } from '@/services/lessonMedia';
import type { LessonMediaItem as UploadedAttachment } from '@/services/lessonMediaApi';
import type { DeckVideo } from '@/services/youtubeVideo';
import { summarizeVerification } from '@/services/quizVerification';
import { confirm } from '@/services/confirm';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { slidesChecksRequest, slidesLessonFields, slidesPlanRequest, slidesTeachingRequest, type SlidesLessonFields } from '@/services/slidesRequests';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import {
  captureGenerationScope, materialScope, reopenedGenerationScope, type GenerationScope,
} from '@/services/generationScope';
import { parseSavedDeck } from '@/services/savedDeck';
import { readFlagParam } from '@/services/materialParams';
import { getItem, updateItem } from '@/services/workspace';
import { useEnglishRefresh } from '@/hooks/useEnglishRefresh';
import { createVerificationTracker } from '@/services/verificationTracker';
import { useDeckWorkspace, type DeckWorkspaceSnapshot } from '@/hooks/useDeckWorkspace';
import { useSlideEditor } from '@/hooks/useSlideEditor';
import { DeckOutline } from '@/components/slides/DeckOutline';
import { DeckActions } from '@/components/slides/DeckActions';
import { DeckThemePicker } from '@/components/slides/DeckThemePicker';
import { SlideEditModal } from '@/components/slides/SlideEditModal';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectPickerLabels, topicPickerParams, scopeFromParams, topicForScope } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { nextFrame } from '@/services/nextFrame';
import { useWideScope } from '@/hooks/useWideScope';
import { revisionPhrase } from '@/services/revisionScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { buildScopeRequest, scopeFormState } from '@/services/wideScopeRequest';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { conceptOf } from '@/constants/icons';
import { SPACE, TYPE } from '@/constants/theme';
import { readableOn, selectedRow } from '@/services/readableColor';
import { generationPhase } from '@/services/generationPhase';
import { deckOptionsSummary, deckSections, previewRows, type DeckSection } from '@/services/generatorSummary';
import { getT } from '@/services/i18n';
import { ChipGroup } from '@/components/generator/ChipGroup';
import { LessonCard } from '@/components/generator/LessonCard';
import { DockedAction, DOCKED_BAR_HEIGHT } from '@/components/generator/DockedAction';
import { toastLift } from '@/services/dockedBar';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { GeneratorLayout, useIsDesktopGenerator } from '@/components/generator/GeneratorLayout';
import { PaperPreview } from '@/components/generator/PaperPreview';
import { PressableScale } from '@/components/ui/PressableScale';

/**
 * The slides' own colour, from the concept list the Tools tab and the prep board
 * read (`constants/icons.ts`). It carries white at 4.5:1, so it is the fill for
 * solid buttons and the tint behind a banner; as text, an icon or an outline on a
 * card the screen uses `accentInk` (`readableOn`), which stays readable on the
 * dark card.
 */
const ACCENT = conceptOf('slides').color;

/** The i18n title of each section the preview draws, as the deck builders title it. */
const DECK_SECTION_LABEL_KEY = {
  title: 'genDeckTitle',
  outcomes: 'genDeckOutcomes',
  scope: 'genDeckScope',
  goals: 'genDeckGoals',
  warmup: 'genDeckWarmup',
  vocabulary: 'genDeckVocabulary',
  explanation: 'genDeckExplanation',
  units: 'genDeckUnits',
  checks: 'genDeckChecks',
  examples: 'genDeckExamples',
  practice: 'genDeckPractice',
  summary: 'genDeckSummary',
  exitTicket: 'genDeckExitTicket',
  homework: 'genDeckHomework',
} as const satisfies Record<DeckSection, string>;

/** What the «what to add» chips toggle: the three switches a deck is built with. */
type DeckOption = 'examples' | 'practice' | 'attachments';
/** What a unit / semester / book deck is anchored to: the scope itself, never one lesson its label happens to match. */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };

/** The toggles a deck was built with — saved as its form state. */
type DeckOptions = { includeExamples: boolean; includePractice: boolean; includeAttachments: boolean };

export default function SlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const accentInk = readableOn(ACCENT, colors.card);
  const isDesktop = useIsDesktopGenerator();
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  // Opened from the tools tab, a Smart Template, or a curriculum lesson, this
  // screen arrives with the teacher's context in the route. It used to discard
  // all three and default to grade 10 / mathematics / no topic.
  const params = useLocalSearchParams<{
    gradeIdx?: string; subjectIdx?: string; topic?: string;
    // Sent by موادي's «تعديل» with the saved form state spread beside it.
    savedId?: string;
    includeExamples?: string; includePractice?: string; includeAttachments?: string;
    // A saved wide deck's scope (`scopeFormState`), so a reopen restores it.
    scope?: string;
    // The lesson itself (a lesson page, the lesson bar, a saved deck) — `usePickedLesson`.
    lessonId?: string;
  }>();
  // An index the picker list cannot honour is NOT index 0 — see
  // `scopeFromParams`. Grounding the topic is what recovers the right scope.
  // Only the grades/subjects this teacher picked on /setup-subjects are offered.
  const teacherScope = useTeacherScope();
  const [initialScope] = useState(() => scopeFromParams(params, uiLang, teacherScope.defaultScope, teacherScope));
  const [gradeIdx, setGradeIdx] = useState(initialScope.gradeIdx);
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = teacherScope.subjectHiddenFor(grades[gradeIdx].id);
  // Labels are per-grade too: Grade 6's creative-arts book has no music in
  // it, so it must not be offered under the combined name. Same index
  // alignment as the mask above.
  const subjectNames = subjectPickerLabels(grades[gradeIdx].id, uiLang);
  const [subjectIdx, setSubjectIdx] = useState(initialScope.subjectIdx);
  // The picked subject's material language — English decks are built in English.
  const lang = contentLang(subjects[subjectIdx].id, uiLang);
  const isAr = lang === 'ar';
  const [topic, setTopic] = useState(() => {
    const initial = topicForScope(params, uiLang, teacherScope.defaultScope, teacherScope);
    const initialLang = contentLang(subjects[initialScope.subjectIdx].id, uiLang);
    return (initial.trim() && carriedLessonTopic(params.lessonId, initialLang)) || topicInLang(
      initial, uiLang, initialLang,
      { gradeId: grades[initialScope.gradeIdx].id, subjectId: subjects[initialScope.subjectIdx].id },
    );
  });
  useWarmGrounding(topic, lang);
  // Re-finding the lesson from its title made this screen useless for Grade 1
  // English: all 19 decks came from a Grade 3, 4 or 9 lesson and were saved under
  // that lesson's id (a teacher's review, 2026-10-15). See `usePickedLesson`.
  const kbScope = { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id };
  const pickedLesson = usePickedLesson(params.lessonId, topic, kbScope);
  const pickedLessonId = pickedLesson.lessonId;
  const groundingOptions = { lessonId: pickedLessonId, scope: kbScope };
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /**
   * The unit / semester / book the deck on screen was built for — what Save
   * records and a reopen restores. Frozen at generation, like `generated`.
   */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(
    () => (wideScope.isWide ? wideScope.scopeSel : null),
  );
  // Live as the teacher types, not gated behind pressing Generate — same
  // timing as `LessonResources`' own `topic` prop just below it. Empty for a
  // wide scope: the lookup is unscoped, and a unit title lands on another
  // grade's lesson, whose attachments and lab items would then be offered.
  const groundedLessonId = useMemo(
    () => (wideScope.isWide ? '' : resolveGeneratorGrounding(topic.trim(), lang, groundingOptions).lesson?.id ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, lang, wideScope.isWide, pickedLessonId, gradeIdx, subjectIdx],
  );
  // A reopened deck comes back with the toggles it was built with.
  const [includeExamples, setIncludeExamples] = useState(() => readFlagParam(params.includeExamples, true));
  const [includePractice, setIncludePractice] = useState(() => readFlagParam(params.includePractice, true));
  /**
   * Off by default, and deliberately: a teacher's attachments are their own
   * files pinned to the lesson, not deck content. Merging them in
   * unconditionally meant every regeneration of the same lesson came back
   * with the same photos and voice notes re-inserted as slides, which reads
   * as the generator inventing media it did not make. They go in when asked.
   */
  const [includeAttachments, setIncludeAttachments] = useState(() => readFlagParam(params.includeAttachments, false));
  /**
   * Lab items picked for this deck. Nothing is picked by default, so nothing is
   * inserted until a teacher asks. They are built and inserted client-side after
   * generation — never in a request body — so they cannot reach the shared
   * generation cache. Cleared when the lesson changes: an id from another
   * lesson's lab must not ride into this deck.
   */
  const [labPicks, setLabPicks] = useState<string[]>([]);
  useEffect(() => { setLabPicks([]); }, [groundedLessonId]);
  const [loading, setLoading] = useState(false);
  /**
   * Held across renders so Cancel can reach the in-flight requests — plural
   * here: this screen asks for the formative checks and the lesson plan at
   * once, and one controller ends both.
   */
  const abortRef = useRef<AbortController | null>(null);
  useAbortOnUnmount(abortRef);
  /**
   * Which `generate()` run owns the screen. The grade/subject reset bumps it
   * so a run it aborted unwinds without writing "cancelled" (or restoring
   * its previous deck) over the form the teacher just changed.
   */
  const runRef = useRef(0);
  const [cancelled, setCancelled] = useState(false);
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  /**
   * The deck on screen is the book-only draft shown while the model calls
   * are still running. Read-only: an edit made to it would be lost when the
   * full deck replaces it.
   */
  const [preliminary, setPreliminary] = useState(false);
  /**
   * The scope and toggles the deck on screen was built with. Save, its
   * identity, its form state and the export filenames all read this rather
   * than the live form: the pickers stay editable after a deck is built, and
   * reading them back stored a maths deck under whatever subject was picked
   * since — see `generationScope.ts`.
   */
  const [generated, setGenerated] = useState<{ scope: GenerationScope; options: DeckOptions } | null>(null);
  /**
   * The shared-pool id of the last `/generate/lesson-teaching` result, so
   * "report a problem" (below) can withdraw exactly that cached explanation
   * rather than the deck as a whole — the deck itself is never pooled, only
   * the pieces the AI wrote into it. Cleared on every rebuild so a stale id
   * can never be reported after the section it names is gone.
   */
  const [teachingVariantId, setTeachingVariantId] = useState<string | undefined>(undefined);
  const [reportingTeaching, setReportingTeaching] = useState(false);
  const [grounded, setGrounded] = useState(false);
  const [groundedLesson, setGroundedLesson] = useState('');
  /** A generation that ran and failed — shown by GenerationStatus, with Retry. */
  const [error, setError] = useState('');
  /**
   * A request refused before anything ran (no topic, a grade/subject with no
   * curriculum, a topic from another subject). Shown next to the form: it
   * used to go through the "generation failed" box, whose Retry can only
   * fail the same way again.
   */
  const [validationError, setValidationError] = useState('');
  // Counts presses of generate. The scrolls to the status block and to a refusal depend on it as well as on
  // their own state: a refusal repeated leaves `validationError` (and a failure `error`) unchanged, so
  // without this a second press would show the teacher nothing.
  const [attempt, setAttempt] = useState(0);
  // The lesson card opens by itself while there is no lesson, and whenever a refusal is showing in it;
  // typing a title must not fold the field away mid-word, so only the button (or an empty topic, or a
  // refusal) changes it. Never unmounts the pickers below.
  const [lessonOpen, setLessonOpen] = useState(() => !topic.trim());
  useEffect(() => { if (!topic.trim() || validationError) setLessonOpen(true); }, [topic, validationError]);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  /**
   * Alternative videos from the same search that produced the deck's pick.
   * Held on the screen rather than on the slide: they are a browsing aid, not
   * deck content, and putting them in the slide would carry them into every
   * save and export for nothing.
   */
  const [videoOptions, setVideoOptions] = useState<DeckVideo[]>([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  /** What the teacher has pinned to this lesson, kept in sync by the picker. */
  const [attached, setAttached] = useState<LessonMediaItem[]>([]);
  /** The teacher's own uploaded photos/files for this lesson (server-side, R2-backed). */
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedAttachment[]>([]);
  /**
   * Every uploaded kind — image, audio, document — now has a slide renderer.
   * Merged with the pinned-URL resources so both sources land in the deck
   * the same way, in one call. This merge is purely client-side and runs
   * after the lesson-plan fetch has already returned — the teacher's own
   * files never appear in a request body, so they never enter the shared
   * generation cache another teacher's request could be served from.
   */
  const attachedResources = useMemo<AttachedResource[]>(() => (includeAttachments ? [
    ...attached,
    ...uploadedAttachments
      .filter((m): m is UploadedAttachment & { url: string } => !!m.url)
      .map(m => ({ kind: m.kind, url: m.url, caption: m.caption })),
  ] : []), [attached, uploadedAttachments, includeAttachments]);
  /** Whether there is anything to offer — no attachments, no switch. */
  const hasAttachments = attached.length + uploadedAttachments.length > 0;
  /** True once the example-verification pass has resolved — the summary row
      stays silent while a check is still in flight. */
  const [verifyDone, setVerifyDone] = useState(false);
  /**
   * The built deck the background passes (verification, media) may land on.
   * `setVerifyDone(true)` had no identity guard, so a check from an earlier
   * deck marked the regenerated one as checked; and the media pass set
   * `videoOptions` from a stale search. Keyed on the built deck object.
   */
  const deckRunRef = useRef(createVerificationTracker<ClassroomActivity>());
  /** The deck object `deckRunRef` was last begun with, so a restore can re-begin it. */
  const builtRef = useRef<ClassroomActivity | null>(null);
  /** Freshest deck, edits included, for the snapshot a regenerate restores on failure. */
  const deckRef = useRef<ClassroomActivity | null>(null);
  deckRef.current = deck;

  /** The scope the deck on screen was built under; the live form before any. */
  const deckScope = () => materialScope(generated?.scope ?? null, { gradeIdx, subjectIdx, topic });
  /** A deck keeps the language of the subject it was built for, not the live picker's. */
  const deckIsAr = (s: GenerationScope = deckScope()) => contentLang(subjects[s.subjectIdx].id, uiLang) === 'ar';
  const outAr = deckIsAr();

  /**
   * What this deck is, in the terms the workspace stores. One definition, used
   * both to save and to recognise a deck that is already saved — if the two
   * ever drift the button starts lying again.
   */
  const deckIdentity = (built: ClassroomActivity, s: GenerationScope = deckScope()) => {
    const sAr = deckIsAr(s);
    return {
      type: 'slides' as const,
      title: built.activityName,
      subject: sAr ? subjects[s.subjectIdx].nameAr : subjects[s.subjectIdx].name,
      grade: sAr ? grades[s.gradeIdx].nameAr : grades[s.gradeIdx].name,
      topic: s.topic,
      language: (sAr ? 'ar' : 'en') as 'ar' | 'en',
    };
  };

  const deckFormState = () => {
    const s = deckScope();
    return {
      gradeIdx: s.gradeIdx, subjectIdx: s.subjectIdx, topic: s.topic,
      ...(generated?.options ?? { includeExamples, includePractice, includeAttachments }),
      // The lesson it was built from, so the save is filed under it rather than
      // under whatever its title grounds to (`withLessonId` keeps an id it is given).
      ...(!wideFrozen && s.lesson ? { lessonId: s.lesson.id } : {}),
      // From the frozen scope, not the live picker. A wide deck is then never
      // filed under a lesson (`withLessonId`).
      ...scopeFormState(wideFrozen, 'balanced'),
    };
  };
  const workspace = useDeckWorkspace({
    deck,
    // Not for the book-only draft: it is replaced within seconds, and its
    // content can never match a stored deck.
    lookupEnabled: !preliminary,
    identity: deckIdentity,
    formState: deckFormState,
    // Named for the lesson it was built from, not whatever the topic box holds now.
    exportName: () => deckScope().topic,
    isAr: outAr,
    t,
    showToast,
    logTag: 'slides',
  });
  const forgetSaved = workspace.forget;
  const editor = useSlideEditor({ deck, setDeck, isAr: outAr, t, showToast, mediaEditing: true });

  /**
   * A deck reopened from موادي. «تعديل» sends `savedId` with the form fields,
   * and this screen used to read only the fields — the deck the teacher had
   * built and edited was nowhere, and the next press of Generate would have
   * made a different one. Load the stored deck, its scope and its workspace
   * link; an item that is gone or unreadable leaves the prefilled form and
   * says so.
   */
  useEffect(() => {
    const id = params.savedId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const item = await getItem(id).catch(() => null);
      if (cancelled) return;
      // A teacher who pressed Generate before the read came back keeps theirs.
      if (runRef.current !== 0 || deckRef.current) return;
      const loaded = item ? parseSavedDeck(item.content) : null;
      if (!loaded) { showToast(t('savedDeckUnreadable')); return; }
      // `topic`/`lang` here are the first render's: the saved topic restated
      // in the saved subject's material language.
      // A wide deck is anchored to its scope: its label («الفصل الأول كاملًا», a
      // unit title) is never looked up again — it grounds to some lesson.
      const regrounded = wideFrozen && topic.trim()
        ? captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING)
        : reopenedGenerationScope(initialScope, topic, lang, params.lessonId);
      // Without a saved topic there is nothing to re-ground: the live form.
      const scope = materialScope(regrounded, {
        gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic,
      });
      setGenerated({ scope, options: { includeExamples, includePractice, includeAttachments } });
      setGrounded(scope.grounded);
      setGroundedLesson(wideFrozen
        ? scopeLabel(wideFrozen, deckIsAr(scope) ? 'ar' : 'en')
        : scope.lesson ? (deckIsAr(scope) ? scope.lesson.titleAr : scope.lesson.titleEn) : '');
      setPreliminary(false);
      workspace.adopt(id, loaded, deckIdentity(loaded, scope));
      setDeck(loaded);
    })();
    return () => { cancelled = true; };
  }, [params.savedId]);

  /**
   * Put the next search candidate into the fields — it does not save.
   *
   * Filling the form rather than applying straight to the deck lets the
   * teacher read the title before committing, and keep pressing for another.
   * The caption is rewritten too, because a suggestion the teacher chose is
   * theirs: `applyMediaEdit` will see a caption that differs from the slide's
   * and keep it, which is right — it describes the video now on the slide.
   *
   * A deck reopened from the workspace has no candidates in memory, so the
   * first press fetches them. That is one search, then free cycling.
   */
  const suggestAnotherVideo = async () => {
    if (editor.editIdx === null || !deck) return;
    let options = videoOptions;
    if (options.length === 0) {
      setLoadingSuggestion(true);
      try {
        const { searchDeckVideos } = await import('@/services/youtubeVideo');
        // The deck's own grade and subject, not whatever the pickers say now.
        const s = deckScope();
        const sAr = deckIsAr(s);
        const query = sAr
          ? `شرح ${deck.lesson} ${subjects[s.subjectIdx].nameAr} لطلبة ${grades[s.gradeIdx].nameAr}`
          : `${deck.lesson} ${subjects[s.subjectIdx].name} ${grades[s.gradeIdx].name} explained`;
        options = await searchDeckVideos(query, sAr ? 'ar' : 'en');
        setVideoOptions(options);
      } finally {
        setLoadingSuggestion(false);
      }
    }
    const next = nextVideoSuggestion(options, editor.mediaUrl);
    if (!next) { editor.setMediaError(t('noOtherVideo')); return; }
    editor.setMediaUrl(next.url);
    editor.setMediaCaption(videoCaption(next));
    editor.setMediaError('');
  };

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      // A request still running would land a deck for the scope the teacher
      // just left — and keep billing for it. Supersede the run first so its
      // unwinding writes nothing over the reset below.
      runRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setPreliminary(false);
      setCancelled(false);
      setError('');
      setValidationError('');
      setTopic('');
      setDeck(null);
      setGenerated(null);
      setWideFrozen(null);
      setTeachingVariantId(undefined);
      setVideoOptions([]);
      builtRef.current = null;
      deckRunRef.current.drop();
      forgetSaved();
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  /**
   * Everything that belongs to the deck on screen, so a failed or cancelled
   * regenerate can put it back. Regenerate used to `setDeck(null)` first and
   * leave the teacher with nothing — their edits and the saved link included.
   */
  type DeckSnapshot = {
    deck: ClassroomActivity;
    workspace: DeckWorkspaceSnapshot;
    generated: typeof generated;
    wideFrozen: ScopeSelection | null;
    teachingVariantId: string | undefined;
    verifyDone: boolean;
    grounded: boolean;
    groundedLesson: string;
    videoOptions: DeckVideo[];
    built: ClassroomActivity | null;
  };
  const restoreDeck = (prev: DeckSnapshot) => {
    setDeck(prev.deck);
    workspace.restore(prev.workspace);
    setGenerated(prev.generated);
    setWideFrozen(prev.wideFrozen);
    setTeachingVariantId(prev.teachingVariantId);
    setVerifyDone(prev.verifyDone);
    setGrounded(prev.grounded);
    setGroundedLesson(prev.groundedLesson);
    setVideoOptions(prev.videoOptions);
    builtRef.current = prev.built;
    // A verification still running for the restored deck may land again.
    if (prev.built) deckRunRef.current.begin(prev.built);
  };

  /**
   * `regen` is merged into the lesson-teaching request only. "Report a
   * problem" passes `{ regenerate, excludeVariantIds }`: without them the
   * rebuild sent a byte-identical request and the pool served back the very
   * explanation the teacher had just reported.
   */
  const generate = async (regen: ReturnType<typeof regenerationFields> = {}) => {
    // Counted first, before any refusal below returns: the scrolls depend on it.
    setAttempt(n => n + 1);
    // A Cancel leaves `cancelled` set, and it outranks an error in the status block: clear it before any
    // refusal below can return, or «أُلغي» would be shown over the refusal's own message.
    setCancelled(false);
    const trimmed = topic.trim();
    const refuse = (msg: string) => { setValidationError(msg); setError(''); setCancelled(false); };
    if (!trimmed) { refuse(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // deck — the book serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (scope) { refuse(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson
    // only. A wide scope that cannot be grounded is refused, never built mislabeled.
    const wideSel = wideScope.isWide ? wideScope.scopeSel! : null;
    const wide = wideSel ? buildScopeRequest(wideSel, lang) : null;
    if (wideSel && !wide) { refuse(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(trimmed, lang, subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { refuse(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setValidationError(''); setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const run = ++runRef.current;
    const isCurrent = () => runRef.current === run;
    const previous: DeckSnapshot | null = deckRef.current ? {
      deck: deckRef.current,
      workspace: workspace.snapshot(),
      generated,
      wideFrozen,
      teachingVariantId,
      verifyDone,
      grounded,
      groundedLesson,
      videoOptions,
      built: builtRef.current,
    } : null;
    setLoading(true); setDeck(null); setTeachingVariantId(undefined);
    // The previous deck's alternatives are not this deck's: "another
    // suggestion" would otherwise cycle through videos for the old lesson.
    setVideoOptions([]);
    builtRef.current = null;
    deckRunRef.current.drop();
    // A new deck is a different material: it is not the one that was saved.
    forgetSaved();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    // The grade/subject reset may have superseded this run during the frame.
    if (!isCurrent()) return;

    // A wide deck never grounds its label: a unit title lands on another
    // grade's lesson (piece 2 measured 18 of 35). A lesson deck is grounded
    // once, on the picked lesson when there is one, and every field is read
    // off that one result.
    const grounding = wide ? WIDE_GROUNDING : resolveGeneratorGrounding(trimmed, lang, groundingOptions);
    const lessonFields: SlidesLessonFields = wide ? {} : slidesLessonFields(grounding);
    const form = {
      gradeName: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
      subjectName: subjects[subjectIdx].name,
      topic: trimmed,
      isAr,
    };
    setGrounded(grounding.grounded);
    setGroundedLesson(wideSel
      ? scopeLabel(wideSel, lang)
      : grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');

    // The book alone makes a projectable deck (the plan-failure path below
    // relies on exactly that), so it goes on screen now and the model calls
    // fill it in. Ten seconds of spinner reads as a hang; ten seconds of
    // spinner above a scannable outline reads as work in progress — and the
    // outline the teacher reads first is book content either way.
    let prelim: ClassroomActivity | null = null;
    try {
      if (grounding.lesson) {
        const base = buildLessonDeck(trimmed, isAr, {
          lesson: grounding.lesson,
          subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
          grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
          includeExamples,
          includePractice,
          graphCommands: extractGraphCommands([
            trimmed,
            ...(grounding.lesson.examplesAr ?? []),
            ...(grounding.lesson.examplesEn ?? []),
            ...(grounding.lesson.rulesAr ?? []),
            ...(grounding.lesson.rulesEn ?? []),
          ].join(' \n ')),
          figureUri: bookFigureUri,
          bookPages: true,
        });
        prelim = {
          ...base,
          slides: insertLabSlides(
            insertLessonResources(base.slides, attachedResources, isAr),
            labSlidesFor(labPicks, isAr),
          ),
        };
        setDeck(prelim);
        setPreliminary(true);
        setVerifyDone(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      }

      // The plan supplies only the connective tissue. If it fails we still have
      // a usable deck from the book, so a generation error must not throw away
      // curriculum content the teacher can already project.
      // Formative checks, generated alongside the plan rather than after it:
      // they are structural (the deck is assembled around them), so they have
      // to be in hand before `buildLessonDeck` runs. Requested in parallel so
      // adding them costs no extra wall-clock, and failing independently so a
      // check-generation error costs the deck nothing.
      // The body (and why it asks for exactly five) is `slidesChecksRequest`.
      // The same anchoring the plan call sends: without the ids the server
      // re-inferred the unit from the title and wrote checks for a neighbouring
      // one; a wide deck sends its scope on this call too.
      const checksPromise = aiService
        .generateClassroomActivity(slidesChecksRequest(form, lessonFields, wide?.fields ?? null), { signal: controller.signal })
        .then(a => a.slides)
        .catch((): ActivitySlide[] => []);

      // The explanation section the book data does not carry — hook, concept
      // slides, a worked example, a practice problem (`lessonSlides.ts`).
      // Parallel and independent like the checks: on any failure the deck is
      // built from the book and plan alone, exactly as before this existed.
      // Not for a wide deck: the prompt is single-lesson by design and the call
      // has no offline twin (`slidesTeachingRequest` answers null).
      const teachingReq = slidesTeachingRequest(form, grounding, regen, wide?.fields ?? null);
      const teachingPromise = teachingReq
        ? aiService
          .generateLessonTeaching(teachingReq, { signal: controller.signal })
          .catch((): LessonTeachingOutput | null => null)
        : Promise.resolve<LessonTeachingOutput | null>(null);

      let lessonPlan: LessonPlanOutput | null = null;
      // Kept so the failure can still be named if the deck turns out to be
      // unbuildable. The plan error is deliberately swallowed below — the book
      // alone makes a deck — but when there is no book either, "why" is the
      // only useful thing left to say, and a quota reads nothing like a fault.
      let planError: unknown = null;
      try {
        // `form.gradeName` is localised (it is carried into the content
        // verbatim); `form.subjectName` stays English — it feeds isMathContext.
        lessonPlan = await aiService.generateLessonPlan(
          slidesPlanRequest(form, lessonFields, wide?.fields ?? null),
          { signal: controller.signal },
        );
      } catch (e) {
        // This screen deliberately survives a failed plan — the curriculum book
        // alone still makes a projectable deck. A cancel is the one rejection
        // that must not be absorbed here: continuing would answer "stop" with
        // a finished deck the teacher asked not to have.
        if (isAbortError(e)) throw e;
        planError = e;
        lessonPlan = null;
      }

      // A wide deck is still built from its units (curriculum data, as the book
      // is for a lesson deck) when the plan fails.
      if (!lessonPlan && !grounding.lesson && !wide) {
        // Nothing to build, so the checks and the teaching call still running
        // are spend on a deck that will never exist — and teaching is live AI
        // even in demo mode. They were left to run to completion.
        controller.abort();
        setError(aiErrorText(planError, t));
        if (previous) restoreDeck(previous);
        return;
      }

      const [checks, teaching] = await Promise.all([checksPromise, teachingPromise]);
      // Both promises above absorb their own failures, the abort included, so
      // a Cancel that lands after the plan returned would otherwise finish as
      // a deck. Re-raise it here; the catch below reports it as a stop.
      throwIfAborted(controller.signal);
      // The server merges `variantId` into the JSON body (see `withMeta` in
      // routes/generate.ts) — not part of `LessonTeachingOutput`'s own shape,
      // same convention `pooledVariantId` already reads for every other
      // generator's result.
      setTeachingVariantId(pooledVariantId(teaching));
      // A live graph slide when the lesson's own text carries plottable
      // functions — same conservative extractor Start Class already uses.
      //
      // Keyed off what the lesson CONTAINS, not off its subject id. This read
      // `subjects[subjectIdx].id === 'mathematics'` until now, which is the
      // exact branch `startClass.ts` documents having removed for the same
      // reason: chemistry and financial-literacy decks got no functional
      // visual at all, silently, because nothing fails when a branch simply
      // never runs. `extractGraphCommands` is already conservative enough to
      // be the only filter — it returns nothing for text with no plottable
      // function, whatever subject that text belongs to, and every subject
      // added later inherits that instead of needing another branch here.
      //
      // The generated checks are scanned too. They are where a maths deck's
      // equations actually live — the lesson's own prose states rules far more
      // often than it states a function — and `lessonSlides.ts` already
      // expects a check that claims a visual to carry the commands for it
      // (`referencesShownVisual`), so leaving them out of the extraction is
      // what made those checks droppable.
      const graphCommands = extractGraphCommands([
        trimmed,
        ...(grounding.lesson?.examplesAr ?? []),
        ...(grounding.lesson?.examplesEn ?? []),
        ...(grounding.lesson?.rulesAr ?? []),
        ...(grounding.lesson?.rulesEn ?? []),
        lessonPlan?.mainActivity ?? '',
        lessonPlan?.guidedPractice ?? '',
        ...checks.map(c => c.content ?? ''),
      ].join(' \n '));
      const builtBase = wide
        // A unit / semester / book deck: the plan's introduction, a round per
        // unit (with up to three of its book figures), the checks and the
        // closure — no lesson, so no vocabulary, rules or worked examples
        // (`buildRevisionDeck`).
        ? buildRevisionDeck(isAr, {
          units: wide.units,
          phrase: revisionPhrase(wideSel!, lang),
          plan: lessonPlan,
          checks,
          subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
          grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
          includePractice,
          // A unit's own pictures from the student book ride with its round.
          figureUri: bookFigureUri,
          bookPages: true,
        })
        : buildLessonDeck(trimmed, isAr, {
        lesson: grounding.lesson,
        plan: lessonPlan,
        subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
        grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        includeExamples,
        includePractice,
        graphCommands,
        checks,
        teaching,
        figureUri: bookFigureUri,
          bookPages: true,
      });
      // The teacher's own resources go in before anything is shown, unlike
      // the searched media which arrives later — they are local, so there is
      // nothing to wait for and no reason to make the deck flicker.
      // The teacher's pinned resources and lab picks belong to one lesson; a
      // wide deck has none, so it takes neither.
      const built = wide ? builtBase : {
        ...builtBase,
        slides: insertLabSlides(
          insertLessonResources(builtBase.slides, attachedResources, isAr),
          labSlidesFor(labPicks, isAr),
        ),
      };
      builtRef.current = built;
      deckRunRef.current.begin(built);
      setGenerated({
        scope: captureGenerationScope({ gradeIdx, subjectIdx, topic: trimmed }, grounding),
        options: { includeExamples, includePractice, includeAttachments },
      });
      setWideFrozen(wideSel);
      setDeck(built);
      setPreliminary(false);
      // A spent allowance refuses the plan, the checks and the explanation
      // together, and the deck above is the book alone — for a thin lesson,
      // its one outcome three times. Say why rather than let it pass as
      // generated.
      if (!lessonPlan && aiErrorMessageKey(planError) === 'aiQuotaSpent') setError(t('slidesBookOnlyQuota'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      // Verify the worked examples' answers after the deck is on screen —
      // never blocks generation. Outcomes are matched back by slide object
      // identity, so a slide the teacher edited or deleted while the check
      // was in flight simply keeps no badge: a stale ✓ is worse than none.
      setVerifyDone(false);
      void (async () => {
        try {
          const { verifyDeckExamples } = await import('@/services/quizVerification');
          const { verifyMathItem } = await import('@/services/ai/verifyMath');
          const outcomes = await verifyDeckExamples(built.slides, verifyMathItem);
          if (!deckRunRef.current.accepts(built)) return;
          setDeck(cur => {
            if (!cur) return cur;
            return {
              ...cur,
              slides: cur.slides.map(s => {
                const idx = built.slides.indexOf(s);
                const o = idx >= 0 ? outcomes[idx] : undefined;
                if (!o) return s;
                return {
                  ...s,
                  verified: true,
                  verifiedBy: o.verifiedBy,
                  ...(o.computedAnswer ? { computedAnswer: o.computedAnswer } : {}),
                };
              }),
            };
          });
          setVerifyDone(true);
        } catch {
          // Verification is a bonus, never a failure state for the deck.
        }
      })();

      // External media, all fetched after the deck is already usable: two
      // topic-relevant photos (a hero background for the title slide and one
      // for the section divider) plus one real explainer video. Never blocks
      // generation, and silently does nothing for whichever server key is
      // unconfigured or turns up nothing. All three land in one state update
      // so they share a single staleness guard rather than racing each other.
      void (async () => {
        try {
          const { searchDeckPhoto } = await import('@/services/unsplashImage');
          const { searchDeckVideos } = await import('@/services/youtubeVideo');
          const { attachBackgroundImage, buildMediaSlide, deckPhotoQueries, insertVideoSlide, unitPhotoTargets } =
            await import('@/services/classMedia');
          const [titleQuery, dividerQuery] = deckPhotoQueries(subjects[subjectIdx].id, subjects[subjectIdx].name);
          const { creditFromPhoto, photoCreditText } = await import('@/services/photoCredit');

          // The video query uses the lesson topic, not the subject: a generic
          // "mathematics" video is no use mid-lesson, where the point is to
          // explain THIS concept.
          const videoQuery = isAr
            ? `شرح ${trimmed} ${subjects[subjectIdx].nameAr} لطلبة ${grades[gradeIdx].nameAr}`
            : `${trimmed} ${subjects[subjectIdx].name} ${grades[gradeIdx].name} explained`;

          // The search fills a gap, it does not compete with the teacher. A
          // pinned video means no call at all — one fewer thing on the
          // projector, and 100 units of a 10,000/day quota unspent.
          // No video for a wide deck: one explainer cannot stand for a semester,
          // and the query would be the scope label. The photos still come.
          const wantVideo = !wide && shouldSearchForVideo(attachedResources);
          // A revision deck has a section break per unit, and the one generic
          // divider photo can only go on the first. Each unit break whose topic is
          // recognisable (see `photoQueryForTopic`) gets a picture of ITS topic —
          // at most four, one call each on the shared photo quota; a unit the
          // titles do not name keeps the flat break rather than a stranger's photo.
          const unitTargets = unitPhotoTargets(built.slides);
          const [titlePhoto, dividerPhoto, videos, unitPhotos] = await Promise.all([
            searchDeckPhoto(titleQuery),
            // The generic «subject classroom» picture belongs to a one-lesson deck's
            // single break. A revision deck's breaks are units, and that picture on
            // the first of them was a stranger's: a computer lab on an evolution
            // round. Each unit gets its own picture below or stays flat.
            wide ? Promise.resolve(null) : searchDeckPhoto(dividerQuery),
            wantVideo ? searchDeckVideos(videoQuery, isAr ? 'ar' : 'en') : Promise.resolve([]),
            Promise.all(unitTargets.map(t => searchDeckPhoto(t.query))),
          ]);
          const video = videos[0] ?? null;
          // A regenerate (or the grade/subject reset) since this search began
          // means these belong to a deck no longer on screen.
          if (!deckRunRef.current.accepts(built)) return;
          // Keep the rest for the editor's "another suggestion" control. They
          // cost nothing extra — one search returned all of them.
          setVideoOptions(videos);
          if (!titlePhoto && !dividerPhoto && !video && !unitPhotos.some(Boolean)) return;

          setDeck(cur => {
            // Guard against a stale fetch landing on a deck the teacher has
            // since regenerated — same identity check the verify pass uses.
            if (!cur || cur.slides[0] !== built.slides[0]) return cur;
            let slides = cur.slides;
            if (titlePhoto) slides = attachBackgroundImage(slides, 0, titlePhoto.url, photoCreditText(titlePhoto, isAr), creditFromPhoto(titlePhoto));
            const dividerIdx = slides.findIndex(s => s.type === 'divider');
            if (dividerPhoto && dividerIdx >= 0) {
              slides = attachBackgroundImage(slides, dividerIdx, dividerPhoto.url, photoCreditText(dividerPhoto, isAr), creditFromPhoto(dividerPhoto));
            }
            // Found by title: the teacher may have moved or deleted a slide in
            // the seconds the search took. A unit's own picture replaces the
            // generic one the first break just took.
            unitTargets.forEach((target, i) => {
              const photo = unitPhotos[i];
              const at = slides.findIndex(s => s.type === 'divider' && s.title === target.title);
              if (photo && at >= 0) slides = attachBackgroundImage(slides, at, photo.url, photoCreditText(photo, isAr), creditFromPhoto(photo));
            });
            if (video) {
              // Two different jobs, so two different fields. `mediaCaption`
              // says what the video IS — the exports have no player to read a
              // title off, so they need it. `content` is the line shown above
              // the embed in the presenter, where repeating the title and
              // channel just duplicates YouTube's own chrome; there it only
              // needs to carry the warning. Either way the deck says plainly
              // that this is a search result, not curriculum-grounded content
              // the app stands behind — the teacher has to preview it.
              const videoSlide = buildMediaSlide(
                'video',
                video.url,
                videoCaption(video),
                isAr,
                0,
              );
              slides = insertVideoSlide(slides, {
                ...videoSlide,
                content: isAr ? 'فيديو خارجي — راجعه قبل العرض' : 'External video — preview before class',
              });
            }
            return { ...cur, slides };
          });
        } catch {
          // Missing media is a normal outcome, never a failure state for the deck.
        }
      })();
    } catch (e) {
      // Superseded by the grade/subject reset, which has already cleared the
      // screen; restoring the old deck here would undo it.
      if (!isCurrent()) return;
      // Reached only by a cancel today: every other failure inside is handled
      // where it happens, because a partial deck still has value.
      if (isAbortError(e)) setCancelled(true);
      else setError(aiErrorText(e, t));
      // The draft was a promise of the full deck, and the status box now
      // says that promise was not kept («لم يُنشأ أي محتوى»). Leaving the
      // draft under that message would contradict it — but the deck the
      // teacher had before pressing regenerate is theirs, and comes back.
      if (previous) restoreDeck(previous);
      else if (prelim) setDeck(cur => (cur === prelim ? null : cur));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (isCurrent()) {
        setLoading(false);
        setPreliminary(false);
      }
    }
  };

  // An English deck saved in Arabic (before 2026-10-04) is rebuilt in English
  // as soon as it opens and stored over the old one by its id — `generate`
  // drops the workspace link, so the save toggle would add a copy instead.
  useEnglishRefresh({
    savedId: params.savedId,
    current: loading ? null : deck,
    generate: () => generate(),
    save: async () => {
      const id = params.savedId;
      if (!id || !deck) return;
      await updateItem(id, { ...deckIdentity(deck), content: JSON.stringify(deck), formState: deckFormState() });
      workspace.adopt(id, deck, deckIdentity(deck));
      showToast(t('englishMaterialRedone'));
    },
  });

  /**
   * Withdraw the AI-written explanation from the shared pool, then rebuild.
   *
   * Same shape as `GeneratorResultActions.reportProblem` (worksheet/quiz/
   * lesson-plan/activity), but screen-owned per that component's own note:
   * Slides has its own export formats and no in-place regenerate, so its
   * action row was never forced through the shared one. Withdrawing without
   * rebuilding would leave the teacher looking at the bad section with no
   * replacement; rebuilding without withdrawing would leave it in the pool
   * for every other teacher who asks for this lesson.
   */
  const reportTeachingProblem = async () => {
    if (!teachingVariantId || reportingTeaching) return;
    const ok = await confirm({
      title: t('reportArtifactTitle'),
      message: t('reportArtifactMsg'),
      confirmLabel: t('reportArtifactConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setReportingTeaching(true);
    try {
      const queued = await aiService.reportVariant(teachingVariantId);
      showToast(queued ? t('reportArtifactDone') : t('reportArtifactGone'));
      await generate(regenerationFields(true, { variantId: teachingVariantId }));
    } catch {
      showToast(t('reportArtifactFailed'));
    } finally {
      setReportingTeaching(false);
    }
  };

  /** Stop both in-flight requests and hand the teacher their form back. */
  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  const present = () => {
    if (!deck) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingClassroomActivity(deck);
    router.push('/ai-tools/classroom/presentation' as any);
  };

  // What the button will make, said before it is pressed (docked bar on a phone, preview on desktop).
  // The switches are the three booleans below, unchanged; a switch the screen does not offer (examples and
  // attachments on a wide scope, attachments with nothing attached) is neither drawn nor claimed.
  const offerExamples = !wideScope.isWide;
  const offerAttachments = hasAttachments && !wideScope.isWide;
  const summary = deckOptionsSummary({
    wide: wideScope.isWide, examples: includeExamples, practice: includePractice, attachments: includeAttachments && offerAttachments,
  }, uiLang);
  const sections = deckSections({ wide: wideScope.isWide, examples: includeExamples, practice: includePractice });
  const preview = previewRows(sections, sections.length, sections.length);
  // The section titles are the deck's own headings, so they are in the language it will be built in
  // (the picked subject's, `lang`), not the interface's: an English deck is headed in English.
  const previewT = getT(lang);
  const stranded = subjectHidden?.[subjectIdx] === true;
  // What GenerationStatus shows. Under the form it is out of sight of a docked button, so a phone scrolls
  // it into view when this leaves 'idle' (the spinner and its Cancel, or a failure).
  const statusPhase = generationPhase({ loading, cancelled, failed: !!error });
  const statusY = useRef(0);
  const reduceMotion = useReduceMotion();
  // A refusal is the form's to show, not the status block's. `generate` clears `cancelled` first and a
  // refusal clears `error`, so the phase is 'idle' then and the status scroll below returns by itself.
  const refusal = !!validationError;
  // Layout effect, not effect: the jump is made before the frame is painted, so there is no flash
  // of the form first. No animated scroll under reduced motion.
  useLayoutEffect(() => {
    if (isDesktop || statusPhase === 'idle') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, statusY.current - SPACE.lg), animated: !reduceMotion });
  }, [statusPhase, attempt]);
  // This screen's button is NOT disabled without a topic: pressing it is what shows the refusal beside the
  // lesson (no topic, no curriculum for this scope, a topic from another subject, a scope that cannot be
  // grounded: every one is about the lesson). The button is docked away from that field on a phone and in
  // the side column on desktop, so on both the press brings the refusal into view. Its place in the scroll
  // content is the difference of two window positions measured together (the current scroll offset
  // cancels out); a second press scrolls again.
  const contentTopRef = useRef<View>(null);
  const refusalRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  useLayoutEffect(() => {
    if (!refusal) return;
    const top = contentTopRef.current;
    const target = refusalRef.current;
    if (!top || !target) return;
    top.measureInWindow((_x, topY) => {
      target.measureInWindow((_tx, targetY) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, targetY - topY - Math.round(windowHeight * 0.4)), animated: !reduceMotion });
      });
    });
  }, [refusal, attempt]);

  // An unsaved (or edited-since-saved) deck is on screen: one tap on a docked «جهّز الشرائح» would rebuild it
  // and lose the edits (`forgetSaved`), so on a phone the bar yields, as the other generators' bar yields to
  // an unsaved result. `workspace.saved` is lit only when the stored copy IS the deck on screen: a deck the
  // teacher saved, or a reopened one whose stored content equals what is shown, so the bar stays under those.
  // The rebuild is still reachable: the same action sits inline at the end of the form, above the results.
  const deckUnsaved = !!deck && !loading && !workspace.saved;
  // The toast sits above the docked bar while the bar is really on screen (a phone, not yielded to the screen's own bar, keyboard closed).
  const keyboardOpen = useKeyboardVisible();
  const toastBottom = toastLift({ isDesktop, barHidden: deckUnsaved, keyboardOpen });
  const includeOptions: { id: DeckOption; label: string }[] = [
    ...(offerExamples ? [{ id: 'examples' as const, label: t('genSlidesOptExamples') }] : []),
    { id: 'practice' as const, label: t('genSlidesOptPractice') },
    ...(offerAttachments ? [{ id: 'attachments' as const, label: t('genSlidesOptAttachments') }] : []),
  ];
  const includeSelected = new Set<DeckOption>([
    ...(includeExamples ? ['examples' as const] : []),
    ...(includePractice ? ['practice' as const] : []),
    ...(includeAttachments ? ['attachments' as const] : []),
  ]);
  const toggleOption = (id: DeckOption) => {
    if (id === 'examples') setIncludeExamples(v => !v);
    else if (id === 'practice') setIncludePractice(v => !v);
    else setIncludeAttachments(v => !v);
  };

  const action = (docked: boolean) => (
    <DockedAction
      summary={summary}
      label={loading ? t('slidesBuilding') : t('slidesBuild')}
      onPress={() => generate()}
      loading={loading}
      accent={ACCENT}
      docked={docked}
      hidden={docked && deckUnsaved}
    />
  );

  const form = (
    <>
      <LessonCard
        gradeLabel={uiLang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name}
        subjectLabel={subjectNames[subjectIdx]!}
        subjectId={subjects[subjectIdx].id}
        topic={topic}
        grounded={!!pickedLesson.lessonId || wideScope.isWide}
        expanded={lessonOpen || stranded || refusal}
        locked={!topic.trim() || stranded || refusal}
        onToggle={() => setLessonOpen(open => !open)}
      >
        <PickerField label={t('grade')} value={uiLang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name} options={grades.map(g => (uiLang === 'ar' ? g.nameAr : g.name))} onChange={setGradeIdx} hidden={teacherScope.gradeHidden} colors={colors} isRTL={isRTL} accent={accentInk} maxHeight={220} />
        <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t(teacherScope.strandedNoteKey(grades[gradeIdx].id, subjectIdx))} isRTL={isRTL} colors={colors} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} hidden={subjectHidden} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={accentInk} maxHeight={220} />

        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={v => { setTopic(v); setError(''); setValidationError(''); }}
          onSelectionDetail={pickedLesson.onSelectionDetail}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          lang={lang}
          isRTL={isRTL}
          colors={colors}
          accent={accentInk}
          hasError={!!validationError && !topic}
          t={t}
        />

        {/*
          Validation errors (no topic, no curriculum for this scope, a topic
          from another subject) stay here, next to the lesson they are about.
          Generation failures go to GenerationStatus, beside the spinner they
          replace — its Retry would only fail a validation the same way.
        */}
        {validationError ? (
          <View ref={refusalRef} collapsable={false}>
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }}>
              {validationError}
            </Text>
          </View>
        ) : null}
      </LessonCard>

      {/* Directly under the lesson card, because that is what these
          attach to: pin a video to «الاشتقاق» once and every future deck
          for that lesson carries it — and so does Class Mode, which has
          read this store all along. */}
      {/* Keyed by the topic string: for a wide scope that is the label, shared
          by every grade's «الكتاب كاملًا». Nothing to pin to. */}
      {!wideScope.isWide && <LessonResources topic={topic.trim()} onChange={setAttached} />}
      <LessonAttachments lessonId={groundedLessonId} onChange={setUploadedAttachments} />
      <LessonLabItems lessonId={groundedLessonId} isAr={isAr} picks={labPicks} onChange={setLabPicks} />

      {/* A wide deck has no book examples and takes no attachments (see generate): those chips are not offered,
          and the booleans behind them are left as they are, exactly as the toggles left them. */}
      <ChipGroup
        label={t('genSlidesIncludeLabel')}
        options={includeOptions}
        selected={includeSelected}
        onToggle={toggleOption}
        min={0}
        accent={ACCENT}
      />

      {/* The free-prompt deck used to be its own card beside this one, with a
          near-identical name. It is the same output from a different start. */}
      <PressableScale
        // Carry the typed topic across: the prompt screen reads it as its
        // opening prompt, so the teacher does not retype what they just wrote.
        onPress={() => router.push({ pathname: '/ai-tools/prompt-slides', params: topic.trim() ? { prompt: topic.trim() } : {} })}
        accessibilityRole="link"
        style={styles.promptLink}
      >
        <Text style={{ color: accentInk, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
          {t('slidesFromPromptLink')}
        </Text>
      </PressableScale>

      {/* While the docked bar yields to an unsaved deck (a phone), the rebuild stays here, above the results. */}
      {!isDesktop && deckUnsaved ? action(false) : null}
    </>
  );

  const side = (
    <>
      <PaperPreview
        title={t('slidesTitle')}
        subtitle={`${topic.trim() || t('selectLesson')} · ${uiLang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name}`}
        rows={preview.rows.map(r => ({ n: r.n, tag: r.type ? previewT(r.type === 'exitTicket' && wideScope.isWide ? 'genDeckExitTicketRevision' : DECK_SECTION_LABEL_KEY[r.type]) : null }))}
        more=""
        footer={[uiLang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name, subjectNames[subjectIdx]!]}
        note={t('genPreviewDeckNote')}
        accent={ACCENT}
        nameLine={false}
      />
      {action(false)}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: DOCKED_BAR_HEIGHT + SPACE.xxl + insets.bottom, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The wrapper only gives the refusal scroll an origin to measure from. */}
        <View ref={contentTopRef} collapsable={false}>
          <ToolHeader topPad={topPad} isRTL={isRTL} title={t('slidesTitle')} subtitle={t('slidesSubtitle')} concept="slides" />
        </View>

        <View style={{ padding: isDesktop ? SPACE.xxl : SPACE.xl }}>
          <GeneratorLayout form={form} side={side} isDesktop={isDesktop} />
        </View>

        {/* The wrapper only records where this sits, for the scroll above. */}
        <View onLayout={e => { statusY.current = e.nativeEvent.layout.y; }}>
        <GenerationStatus
          phase={statusPhase}
          loadingLabel={preliminary ? t('slidesBuildingRest') : t('slidesBuilding')}
          errorDetail={error}
          onCancel={cancelGenerate}
          onRetry={() => generate()}
          colors={colors}
          isRTL={isRTL}
          lang={uiLang}
          accent={accentInk}
          t={t}
        />
        </View>

        {deck && (!loading || preliminary) && (
          // One switch for the whole block: while the draft is on screen
          // every control in it — edit, delete, present, save, export — acts
          // on a deck about to be replaced, so none of them may fire.
          <View
            style={{ marginHorizontal: 20, opacity: preliminary ? 0.6 : 1 }}
            pointerEvents={preliminary ? 'none' : 'auto'}
          >
            <View style={{ marginBottom: 12 }}>
              <GroundingNotice
                grounded={grounded}
                lessonTitle={groundedLesson}
                isRTL={isRTL}
                colors={colors}
                labels={{
                  grounded: (l: string) => t('groundedInCurriculum', l),
                  generic: t('notGroundedTitle'),
                  genericHint: t('notGroundedHint'),
                }}
              />
            </View>

            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {deck.activityName}
              </Text>
              <Text style={[styles.previewMeta, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideCount', deck.slides.length)}
              </Text>

              {/* Whether anything actually checked the example answers.
                  Silent until the verification pass resolves — saying nothing
                  is honest, "not verified" mid-flight is not. Derived from the
                  slides themselves so edits/deletions keep the count true. */}
              {(() => {
                const examples = deck.slides.filter(s => s.type === 'challenge' && s.answer);
                if (!verifyDone || examples.length === 0) return null;
                const v = summarizeVerification(
                  examples
                    .filter(s => s.verified && s.verifiedBy)
                    .map(s => ({ verifiedBy: s.verifiedBy!, computedAnswer: s.computedAnswer })),
                );
                return (
                  <View style={[styles.verifyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons
                      name={v.anySymbolic ? 'shield-checkmark' : 'library-outline'}
                      size={14}
                      color={v.anySymbolic ? colors.success : colors.mutedForeground}
                    />
                    <Text style={[styles.verifyText, {
                      color: v.anySymbolic ? colors.success : colors.mutedForeground,
                      textAlign: isRTL ? 'right' : 'left',
                    }]}>
                      {v.anySymbolic
                        ? t('quizVerifiedCount', v.symbolic, examples.length)
                        // "keys come from the reviewed bank" is false for a
                        // model-written example, which nobody reviewed.
                        : examples.some(s => s.aiWritten && !s.verified)
                          ? t('examplesAiUnverified')
                          : t('quizVerifiedNone')}
                    </Text>
                  </View>
                );
              })()}

              {/* Only when there is a pooled AI-written section to withdraw —
                  a book-only deck (`teachingVariantId` unset) has nothing this
                  button could act on. Same shape as GeneratorResultActions'
                  report button: bordered, destructive-coloured, icon + text —
                  this screen owns its own action row (see that component's
                  header comment), but a teacher who has used Worksheet or
                  Quiz should still recognise this control. */}
              {!!teachingVariantId && (
                <Pressable
                  onPress={reportTeachingProblem}
                  disabled={reportingTeaching}
                  style={({ pressed }) => [
                    styles.reportBtn,
                    {
                      borderColor: colors.destructive,
                      borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      opacity: reportingTeaching ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="flag-outline" size={16} color={colors.destructive} />
                  <Text style={{ fontSize: 14, color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold' }}>
                    {t('reportArtifactBtn')}
                  </Text>
                </Pressable>
              )}

              <DeckOutline
                slides={deck.slides}
                onEdit={editor.openEdit}
                onRemove={i => { void editor.removeSlide(i); }}
                isRTL={isRTL}
                colors={colors}
                t={t}
              />
            </View>

            <DeckThemePicker deck={deck} setDeck={setDeck} isRTL={isRTL} isAr={isAr} colors={colors} t={t} />
            <DeckActions workspace={workspace} onPresent={present} showToast={showToast} isRTL={isRTL} colors={colors} t={t} />
          </View>
        )}

        {deck && !loading && <FeedbackWidget materialType="slides" toolId="slides" />}
      </ScrollView>
      {isDesktop ? null : action(true)}

      <SlideEditModal
        editor={editor}
        onSuggestVideo={suggestAnotherVideo}
        loadingSuggestion={loadingSuggestion}
        isRTL={isRTL}
        colors={colors}
        t={t}
      />

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} bottomOffset={toastBottom} />
    </View>
  );
}

/**
 * The shared dropdown, for the two long lists (grade, subject), with the selected
 * row tinted with the `accent` it is given (the tool's ink) so it is not the fixed
 * teal of the default.
 */
function PickerField(props: React.ComponentProps<typeof SharedPickerField>) {
  const row = selectedRow(props.accent, props.colors.card);
  return <SharedPickerField selectedTint={row.fill} {...props} accent={row.ink} />;
}

const styles = StyleSheet.create({
  promptLink: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: SPACE.lg },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17, marginBottom: 4 },
  previewMeta: { fontSize: 12 },
  verifyRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular', flex: 1 },
  reportBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderWidth: 1.5, marginTop: 8, alignSelf: 'flex-start' },
});

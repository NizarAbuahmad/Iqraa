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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { aiErrorMessageKey, isAbortError, throwIfAborted } from '@/services/ai/aiProvenance';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { ActivitySlide, ClassroomActivity, LessonPlanOutput, LessonTeachingOutput } from '@/services/ai/AIService';
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding } from '@/services/kbContext';
import { buildLessonDeck, EXIT_TICKET_MAX, MID_LESSON_CHECK_MAX } from '@/services/lessonSlides';
import { bookFigureUri } from '@/services/bookFigureUri';
import {
  extractGraphCommands, insertLessonResources, nextVideoSuggestion,
  shouldSearchForVideo, videoCaption } from '@/services/classMedia';
import type { AttachedResource } from '@/services/classMedia';
import { LessonResources } from '@/components/ui/LessonResources';
import { LessonAttachments } from '@/components/ui/LessonAttachments';
import type { LessonMediaItem } from '@/services/lessonMedia';
import type { LessonMediaItem as UploadedAttachment } from '@/services/lessonMediaApi';
import type { DeckVideo } from '@/services/youtubeVideo';
import { summarizeVerification } from '@/services/quizVerification';
import { confirm } from '@/services/confirm';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { captureGenerationScope, materialScope, type GenerationScope } from '@/services/generationScope';
import { createVerificationTracker } from '@/services/verificationTracker';
import { useDeckWorkspace, type DeckWorkspaceSnapshot } from '@/hooks/useDeckWorkspace';
import { useSlideEditor } from '@/hooks/useSlideEditor';
import { DeckOutline } from '@/components/slides/DeckOutline';
import { DeckActions } from '@/components/slides/DeckActions';
import { SlideEditModal } from '@/components/slides/SlideEditModal';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectPickerLabels, topicPickerParams, scopeFromParams } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { palette } from '@/constants/colors';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { nextFrame } from '@/services/nextFrame';

const ACCENT = palette.primary;

/** The toggles a deck was built with — saved as its form state. */
type DeckOptions = { includeExamples: boolean; includePractice: boolean; includeAttachments: boolean };

export default function SlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  // Opened from the tools tab, a Smart Template, or a curriculum lesson, this
  // screen arrives with the teacher's context in the route. It used to discard
  // all three and default to grade 10 / mathematics / no topic.
  const params = useLocalSearchParams<{
    gradeIdx?: string; subjectIdx?: string; topic?: string;
  }>();
  // An index the picker list cannot honour is NOT index 0 — see
  // `scopeFromParams`. Grounding the topic is what recovers the right scope.
  // Only the grades/subjects this teacher picked on /setup-subjects are offered.
  const teacherScope = useTeacherScope();
  const [initialScope] = useState(() => scopeFromParams(params, lang as 'ar' | 'en', teacherScope.defaultScope));
  const [gradeIdx, setGradeIdx] = useState(initialScope.gradeIdx);
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = teacherScope.subjectHiddenFor(grades[gradeIdx].id);
  // Labels are per-grade too: Grade 6's creative-arts book has no music in
  // it, so it must not be offered under the combined name. Same index
  // alignment as the mask above.
  const subjectNames = subjectPickerLabels(grades[gradeIdx].id, isAr ? 'ar' : 'en');
  const [subjectIdx, setSubjectIdx] = useState(initialScope.subjectIdx);
  const [topic, setTopic] = useState(params.topic ?? '');
  useWarmGrounding(topic, lang);
  // Live as the teacher types, not gated behind pressing Generate — same
  // timing as `LessonResources`' own `topic` prop just below it.
  const groundedLessonId = useMemo(
    () => resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en').lesson?.id ?? '',
    [topic, lang],
  );
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includePractice, setIncludePractice] = useState(true);
  /**
   * Off by default, and deliberately: a teacher's attachments are their own
   * files pinned to the lesson, not deck content. Merging them in
   * unconditionally meant every regeneration of the same lesson came back
   * with the same photos and voice notes re-inserted as slides, which reads
   * as the generator inventing media it did not make. They go in when asked.
   */
  const [includeAttachments, setIncludeAttachments] = useState(false);
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

  /**
   * What this deck is, in the terms the workspace stores. One definition, used
   * both to save and to recognise a deck that is already saved — if the two
   * ever drift the button starts lying again.
   */
  const deckIdentity = (built: ClassroomActivity) => {
    const s = deckScope();
    return {
      type: 'slides' as const,
      title: built.activityName,
      subject: isAr ? subjects[s.subjectIdx].nameAr : subjects[s.subjectIdx].name,
      grade: isAr ? grades[s.gradeIdx].nameAr : grades[s.gradeIdx].name,
      topic: s.topic,
      language: (isAr ? 'ar' : 'en') as 'ar' | 'en',
    };
  };

  const workspace = useDeckWorkspace({
    deck,
    // Not for the book-only draft: it is replaced within seconds, and its
    // content can never match a stored deck.
    lookupEnabled: !preliminary,
    identity: deckIdentity,
    formState: () => {
      const s = deckScope();
      return {
        gradeIdx: s.gradeIdx, subjectIdx: s.subjectIdx, topic: s.topic,
        ...(generated?.options ?? { includeExamples, includePractice, includeAttachments }),
      };
    },
    // Named for the lesson it was built from, not whatever the topic box holds now.
    exportName: () => deckScope().topic,
    isAr,
    t,
    showToast,
    logTag: 'slides',
  });
  const forgetSaved = workspace.forget;
  const editor = useSlideEditor({ deck, setDeck, isAr, t, showToast, mediaEditing: true });

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
        const query = isAr
          ? `شرح ${deck.lesson} ${subjects[s.subjectIdx].nameAr} لطلبة ${grades[s.gradeIdx].nameAr}`
          : `${deck.lesson} ${subjects[s.subjectIdx].name} ${grades[s.gradeIdx].name} explained`;
        options = await searchDeckVideos(query, isAr ? 'ar' : 'en');
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
    const trimmed = topic.trim();
    const refuse = (msg: string) => { setValidationError(msg); setError(''); setCancelled(false); };
    if (!trimmed) { refuse(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // deck — the book serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, lang as 'ar' | 'en');
    if (scope) { refuse(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    const conflict = groundedSubjectConflict(trimmed, lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { refuse(t('subjectTopicMismatch', isAr ? conflict.nameAr : conflict.name)); return; }
    setValidationError(''); setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const run = ++runRef.current;
    const isCurrent = () => runRef.current === run;
    const previous: DeckSnapshot | null = deckRef.current ? {
      deck: deckRef.current,
      workspace: workspace.snapshot(),
      generated,
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

    const grounding = resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en');
    const generatorContext = buildGeneratorContext(trimmed, lang as 'ar' | 'en');
    const unitId = generatorUnitId(trimmed, lang as 'ar' | 'en');
    const lessonId = generatorLessonId(trimmed, lang as 'ar' | 'en');
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');

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
        });
        prelim = { ...base, slides: insertLessonResources(base.slides, attachedResources, isAr) };
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
      const checksPromise = aiService
        .generateClassroomActivity({
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          activityType: 'quick-check',
          duration: 10,
          difficulty: 'standard',
          groupType: 'whole-class',
          teachingGoal: 'assessment',
          language: isAr ? 'arabic' : 'english',
          // Two mid-lesson checks plus a three-question exit ticket. Asking
          // for exactly what the deck places means no question is generated
          // and then thrown away.
          numQuestions: MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX,
          // The same anchoring the teaching and plan calls send. Without the
          // ids the server re-inferred the unit from the title — the lesson-
          // title trap in CLAUDE.md — and wrote checks for a neighbouring one.
          additionalContext: generatorContext,
          unitId,
          lessonId,
          contextSource: 'curriculum',
        }, { signal: controller.signal })
        .then(a => a.slides)
        .catch((): ActivitySlide[] => []);

      // The explanation section the book data does not carry — hook, concept
      // slides, a worked example, a practice problem (`lessonSlides.ts`).
      // Parallel and independent like the checks: on any failure the deck is
      // built from the book and plan alone, exactly as before this existed.
      const teachingPromise = aiService
        .generateLessonTeaching({
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: generatorContext,
          unitId,
          lessonId,
          contextSource: 'curriculum',
          ...regen,
        }, { signal: controller.signal })
        .catch((): LessonTeachingOutput | null => null);

      let lessonPlan: LessonPlanOutput | null = null;
      // Kept so the failure can still be named if the deck turns out to be
      // unbuildable. The plan error is deliberately swallowed below — the book
      // alone makes a deck — but when there is no book either, "why" is the
      // only useful thing left to say, and a quota reads nothing like a fault.
      let planError: unknown = null;
      try {
        lessonPlan = await aiService.generateLessonPlan({
          // Localised: this string is carried into generated content verbatim —
          // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
          // compared anywhere, only displayed and passed through, so translating it
          // is safe. `subject` is deliberately left in English: it feeds
          // isMathContext and ~30 other call sites.
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: generatorContext,
          unitId,
          lessonId,
          bookFigureCount: generatorFigureCount(trimmed, lang as 'ar' | 'en'),
          contextSource: 'curriculum',
        }, { signal: controller.signal });
      } catch (e) {
        // This screen deliberately survives a failed plan — the curriculum book
        // alone still makes a projectable deck. A cancel is the one rejection
        // that must not be absorbed here: continuing would answer "stop" with
        // a finished deck the teacher asked not to have.
        if (isAbortError(e)) throw e;
        planError = e;
        lessonPlan = null;
      }

      if (!lessonPlan && !grounding.lesson) {
        // Nothing to build, so the checks and the teaching call still running
        // are spend on a deck that will never exist — and teaching is live AI
        // even in demo mode. They were left to run to completion.
        controller.abort();
        setError(t(aiErrorMessageKey(planError)));
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
      const builtBase = buildLessonDeck(trimmed, isAr, {
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
      });
      // The teacher's own resources go in before anything is shown, unlike
      // the searched media which arrives later — they are local, so there is
      // nothing to wait for and no reason to make the deck flicker.
      const built = {
        ...builtBase,
        slides: insertLessonResources(builtBase.slides, attachedResources, isAr),
      };
      builtRef.current = built;
      deckRunRef.current.begin(built);
      setGenerated({
        scope: captureGenerationScope({ gradeIdx, subjectIdx, topic: trimmed }, grounding),
        options: { includeExamples, includePractice, includeAttachments },
      });
      setDeck(built);
      setPreliminary(false);
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
          const { attachBackgroundImage, buildMediaSlide, deckPhotoQueries, insertVideoSlide } =
            await import('@/services/classMedia');
          const [titleQuery, dividerQuery] = deckPhotoQueries(subjects[subjectIdx].id, subjects[subjectIdx].name);
          const captionFor = (photographer: string) => (isAr
            ? `📷 ${photographer} · Unsplash`
            : `📷 Photo by ${photographer} on Unsplash`);

          // The video query uses the lesson topic, not the subject: a generic
          // "mathematics" video is no use mid-lesson, where the point is to
          // explain THIS concept.
          const videoQuery = isAr
            ? `شرح ${trimmed} ${subjects[subjectIdx].nameAr} لطلبة ${grades[gradeIdx].nameAr}`
            : `${trimmed} ${subjects[subjectIdx].name} ${grades[gradeIdx].name} explained`;

          // The search fills a gap, it does not compete with the teacher. A
          // pinned video means no call at all — one fewer thing on the
          // projector, and 100 units of a 10,000/day quota unspent.
          const wantVideo = shouldSearchForVideo(attachedResources);
          const [titlePhoto, dividerPhoto, videos] = await Promise.all([
            searchDeckPhoto(titleQuery),
            searchDeckPhoto(dividerQuery),
            wantVideo ? searchDeckVideos(videoQuery, isAr ? 'ar' : 'en') : Promise.resolve([]),
          ]);
          const video = videos[0] ?? null;
          // A regenerate (or the grade/subject reset) since this search began
          // means these belong to a deck no longer on screen.
          if (!deckRunRef.current.accepts(built)) return;
          // Keep the rest for the editor's "another suggestion" control. They
          // cost nothing extra — one search returned all of them.
          setVideoOptions(videos);
          if (!titlePhoto && !dividerPhoto && !video) return;

          setDeck(cur => {
            // Guard against a stale fetch landing on a deck the teacher has
            // since regenerated — same identity check the verify pass uses.
            if (!cur || cur.slides[0] !== built.slides[0]) return cur;
            let slides = cur.slides;
            if (titlePhoto) slides = attachBackgroundImage(slides, 0, titlePhoto.url, captionFor(titlePhoto.photographer));
            const dividerIdx = slides.findIndex(s => s.type === 'divider');
            if (dividerPhoto && dividerIdx >= 0) {
              slides = attachBackgroundImage(slides, dividerIdx, dividerPhoto.url, captionFor(dividerPhoto.photographer));
            }
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
      else setError(t(aiErrorMessageKey(e)));
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

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <Pressable
      onPress={() => { onChange(!value); Haptics.selectionAsync(); }}
      style={[styles.toggle, {
        borderColor: value ? ACCENT : colors.border,
        backgroundColor: value ? ACCENT + '12' : colors.card,
        borderRadius: colors.radius,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }]}
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? ACCENT : colors.mutedForeground}
      />
      <Text style={[styles.toggleText, {
        color: value ? ACCENT : colors.mutedForeground,
        fontFamily: value ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
      }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ToolHeader topPad={topPad} isRTL={isRTL} title={t('slidesTitle')} subtitle={t('slidesSubtitle')} leading="🖥️" />

        <View style={styles.form}>
          <PickerField label={t('grade')} value={isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name} options={grades.map(g => (isAr ? g.nameAr : g.name))} onChange={setGradeIdx} hidden={teacherScope.gradeHidden} colors={colors} isRTL={isRTL} accent={ACCENT} maxHeight={220} selectedTint={ACCENT + '15'} />
          <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />
          <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} hidden={subjectHidden} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} maxHeight={220} selectedTint={ACCENT + '15'} />

          <TopicSelector
            subjectId={subjects[subjectIdx].id}
            gradeId={grades[gradeIdx].id}
            value={topic}
            onChange={v => { setTopic(v); setError(''); setValidationError(''); }}
            lang={lang as 'ar' | 'en'}
            isRTL={isRTL}
            colors={colors}
            accent={ACCENT}
            hasError={!!validationError && !topic}
            t={t}
          />

          {/* Directly under the lesson picker, because that is what these
              attach to: pin a video to «الاشتقاق» once and every future deck
              for that lesson carries it — and so does Class Mode, which has
              read this store all along. */}
          <LessonResources topic={topic.trim()} onChange={setAttached} />
          <LessonAttachments lessonId={groundedLessonId} onChange={setUploadedAttachments} />

          <View style={{ gap: 10, marginBottom: 18 }}>
            <Toggle label={t('slidesIncludeExamples')} value={includeExamples} onChange={setIncludeExamples} />
            <Toggle label={t('slidesIncludePractice')} value={includePractice} onChange={setIncludePractice} />
            {hasAttachments ? (
              <Toggle label={t('slidesIncludeAttachments')} value={includeAttachments} onChange={setIncludeAttachments} />
            ) : null}
          </View>

          {/*
            Validation errors (no topic, no curriculum for this scope, a topic
            from another subject) stay here, next to the form they are about.
            Generation failures go to GenerationStatus, beside the spinner they
            replace — its Retry would only fail a validation the same way.
          */}
          {validationError ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {validationError}
            </Text>
          ) : null}

          <Button
            label={loading ? t('slidesBuilding') : t('slidesBuild')}
            onPress={() => generate()}
            loading={loading}
            fullWidth
          />
          {/* The free-prompt deck used to be its own card beside this one, with a
              near-identical name. It is the same output from a different start. */}
          <Pressable
            // Carry the typed topic across: the prompt screen reads it as its
            // opening prompt, so the teacher does not retype what they just wrote.
            onPress={() => router.push({ pathname: '/ai-tools/prompt-slides', params: topic.trim() ? { prompt: topic.trim() } : {} })}
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 14 }}
          >
            <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {t('slidesFromPromptLink')}
            </Text>
          </Pressable>
        </View>

        <GenerationStatus
          phase={loading ? 'loading' : cancelled ? 'cancelled' : error ? 'error' : 'idle'}
          loadingLabel={preliminary ? t('slidesBuildingRest') : t('slidesBuilding')}
          errorDetail={error}
          onCancel={cancelGenerate}
          onRetry={() => generate()}
          colors={colors}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          accent={ACCENT}
          t={t}
        />

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
              <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {deck.activityName}
              </Text>
              <Text style={[styles.previewMeta, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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
                      color={v.anySymbolic ? '#067647' : colors.mutedForeground}
                    />
                    <Text style={[styles.verifyText, {
                      color: v.anySymbolic ? '#067647' : colors.mutedForeground,
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
                  <Text style={{ fontSize: 14, color: colors.destructive, fontFamily: 'Cairo_600SemiBold' }}>
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

            <DeckActions workspace={workspace} onPresent={present} showToast={showToast} isRTL={isRTL} colors={colors} t={t} />
          </View>
        )}

        {deck && !loading && <FeedbackWidget materialType="slides" toolId="slides" />}
      </ScrollView>

      <SlideEditModal
        editor={editor}
        onSuggestVideo={suggestAnotherVideo}
        loadingSuggestion={loadingSuggestion}
        isRTL={isRTL}
        colors={colors}
        t={t}
      />

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 20 },
  toggle: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5 },
  toggleText: { fontSize: 13 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17, marginBottom: 4 },
  previewMeta: { fontSize: 12 },
  verifyRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontSize: 12, lineHeight: 19, fontFamily: 'Almarai_400Regular', flex: 1 },
  reportBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderWidth: 1.5, marginTop: 8, alignSelf: 'flex-start' },
});

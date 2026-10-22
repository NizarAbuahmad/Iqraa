/**
 * Today's lesson and everything hung on it: which lesson, the prep board, the
 * tools' params, Start class, the next period, the setup nudge. Moved out of
 * the desktop workspace (app/(tabs)/index.tsx) on 2026-10-22 so the phone
 * Today (components/today/PhoneToday.tsx) reads the same logic: two layouts
 * over one hook can never name two different lessons.
 *
 * Reloads saved materials, classes and the timetable on mount and on every
 * screen focus (one `useFocusEffect`), and on window focus (web): generating
 * a worksheet leaves Today and comes back, and a board that still says
 * "missing" is worse than none.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { buildPrepBoard, prepLessonKey, prepSummary, savedDeckFor, withoutBoardTools, type PrepRow } from '@/services/lessonBoard';
import { getAllItems, type SavedMaterial } from '@/services/workspace';
import { listClasses } from '@/services/roster';
import type { ClassGroup } from '@/services/roster';
import { periodClassLabel } from '@/services/classSubjects';
import { classNameFor } from '@/services/materialClass';
import { loadTimetable } from '@/services/schedule';
import { formatNextPeriod, type NextPeriodLesson, type TimetableSetupStep } from '@/services/scheduleCalendar';
import { todayISO } from '@/services/planEntries';
import {
  HomeLessonPick, dismissSetupNudge, loadLessonPick, loadPrepSkips, setPrepSkip, subscribeLessonPick, timetableWins,
  wasSetupNudgeDismissed,
} from '@/services/lessonContext';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { lessonPickerParams, resolveLessonPrepContext, scopePickerParams } from '@/services/lessonPrep';
import { defaultLessonIdFor } from '@/services/lessonCopilot';
import { buildClassDeck } from '@/services/startClass';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { WORKFLOW, type ToolDef } from '@/services/toolCatalog';
import { trackEvent } from '@/services/analytics';
import { justCompleted, type Progress } from '@/services/celebration';

export type TodayLesson = {
  /** '' when there is no lesson. */
  topic: string;
  /** The resolved lesson: today's pick, else the timetable's, else an older pick, else the chat's default. */
  active: { topic: string; lessonId: string | null; gradeId?: string | null; subjectId?: string | null } | null;
  /** «الحصة القادمة · العاشر ب · 10:15», or '' when the card is not showing that period's lesson. */
  periodLine: string;
  next: NextPeriodLesson | null;
  setup: TimetableSetupStep | null;
  nudgeDismissed: boolean;
  dismissNudge: () => void;
  classes: ClassGroup[];
  board: PrepRow[];
  summary: { done: number; total: number };
  /** True after the checklist for the shown lesson crossed into all-ready on screen; never on opening it already complete. */
  prepJustReady: boolean;
  /** Called by the overlay's `onDone`. */
  clearPrepJustReady: () => void;
  toggleSkip: (row: PrepRow) => void;
  gradeLabel: string;
  subjectLabel: string;
  /** Params that open a generator on this lesson's own grade and subject. */
  toolParams: Record<string, string>;
  quickTools: ToolDef[];
  /** Up to three asks for what the board says is missing. */
  suggestions: string[];
  startingClass: boolean;
  startClassError: string;
  startClass: () => Promise<void>;
  openLessonPicker: () => void;
  /** Opens the chat with `text` already sent. Does nothing for blank text. */
  ask: (text: string) => void;
};

export function useTodayLesson(source: 'workspace' | 'today_phone'): TodayLesson {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';
  const params = useLocalSearchParams<{ startClass?: string }>();

  const [pick, setPick] = useState<HomeLessonPick | null>(null);
  const [next, setNext] = useState<NextPeriodLesson | null>(null);
  const [setup, setSetup] = useState<TimetableSetupStep | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(true); // until read: never flash it
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState('');
  // True once saved materials have been read successfully at least once: before
  // that the board is empty, and the first real read must not look like progress.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadLessonPick().then(setPick);
    return subscribeLessonPick(setPick);
  }, []);

  /*
   * Saved materials are the only record of prep that outlives a chat session,
   * so they are what the board reads. Reloaded on focus rather than once on
   * mount: generating a worksheet leaves this screen and comes back, and a
   * board that still says "missing" after the teacher just made the thing is
   * worse than no board.
   */
  const reload = useCallback(() => {
    getAllItems()
      .then(items => {
        setMaterials(items);
        setLoaded(true);
      })
      // A failed read is not "loaded": the board is still the empty one, and a
      // later good read at 5/5 would otherwise look like a crossing.
      .catch(() => {});
    listClasses().then(setClasses).catch(() => {});
    loadTimetable().then(tt => {
      setNext(tt?.next ?? null);
      setSetup(tt?.setup ?? null);
    });
    wasSetupNudgeDismissed().then(setNudgeDismissed);
  }, []);
  // Web: the browser window regaining focus (a tab switch back) is not a
  // navigation event, so it needs its own listener.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);
  // The one load on mount AND on every return to the screen, native and web:
  // expo-router's useFocusEffect runs its effect at once when the screen is
  // already focused, so a separate mount `reload()` would load everything twice.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  /*
    A teacher who has never opened the lesson picker still has a lesson: the
    chat has always seeded one (`seedDefaultLessonMemory`) and shows it on its
    card. Falling back to the same one keeps the two screens saying the same
    thing — a home that said "no lesson picked" while the chat one click away
    showed «تركيب الاقترانات» would read as a bug in whichever was seen second.
  */
  const fallback = useMemo(
    () => resolveLessonPrepContext(defaultLessonIdFor(user?.teachingAssignments), lang as 'ar' | 'en'),
    [lang, user?.teachingAssignments],
  );
  /*
    The lesson the card is about, in order: a lesson the teacher picked by
    hand today; else the one the pacing plan puts in front of the next class
    on the timetable; else an older pick; else the chat's default. A pick from
    last week is where they were, not where they are — the timetable knows
    better — but a pick from this morning is a decision, and it wins.
  */
  const scheduled = useMemo(
    () => (next?.lessonId ? resolveLessonPrepContext(next.lessonId, lang as 'ar' | 'en') : null),
    [next?.lessonId, lang],
  );
  const fromSchedule = timetableWins(pick, !!scheduled, todayISO());
  const active = fromSchedule && scheduled
    ? { topic: scheduled.topic, lessonId: scheduled.lessonId, gradeId: scheduled.gradeId, subjectId: scheduled.subjectId }
    : pick?.topic?.trim()
      ? { topic: pick.topic.trim(), lessonId: pick.lessonId ?? null, gradeId: pick.gradeId, subjectId: pick.subjectId }
      : fallback
        ? { topic: fallback.topic, lessonId: fallback.lessonId, gradeId: fallback.gradeId, subjectId: fallback.subjectId }
        : null;
  // «الحصة القادمة · العاشر ب · 10:15» — only when the card is showing that period's lesson.
  const periodLine = fromSchedule && next
    ? formatNextPeriod(next, {
        classLabel: periodClassLabel(classNameFor(classes, next.classGroupId, lang as 'ar' | 'en'), next.subjectId, lang),
        today: todayISO(),
        lang: lang as 'ar' | 'en',
        nowLabel: t('homePeriodNow'),
        nextLabel: t('homePeriodNext'),
      })
    : '';

  const topic = active?.topic ?? '';
  // «غير مطلوب» choices for this lesson; reloaded whenever the lesson changes.
  const skipKey = prepLessonKey(topic, active?.lessonId);
  const [skips, setSkips] = useState<string[]>([]);
  // Which lesson `skips` was read for: after a lesson change the old list is
  // still on screen for a moment, and a board judged against it can flip.
  const [skipsFor, setSkipsFor] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadPrepSkips(skipKey).then(list => {
      if (!live) return;
      setSkips(list);
      setSkipsFor(skipKey);
    });
    return () => { live = false; };
  }, [skipKey]);
  const toggleSkip = useCallback((row: PrepRow) => {
    if (!skipKey) return;
    void setPrepSkip(skipKey, row.type, !row.skipped).then(setSkips);
  }, [skipKey]);
  const board = useMemo(
    () => buildPrepBoard(materials, topic, active?.lessonId, skips),
    [materials, topic, active?.lessonId, skips],
  );
  const summary = prepSummary(board);

  /*
    «الدرس جاهز»: the checklist crossing into all-ready while the teacher is
    here (generating the last item and coming back, or ticking «غير مطلوب» on
    the last row). Judged only once materials and this lesson's skips have been
    read, so opening Today at 5/5 is not a moment; `skipKey` is the subject, so
    switching lesson cannot read as a crossing.
  */
  const prepComplete = summary.total > 0 && summary.done >= summary.total;
  const prevPrep = useRef<Progress | null>(null);
  const [prepJustReady, setPrepJustReady] = useState(false);
  useEffect(() => {
    if (!loaded || !topic || !skipKey || skipsFor !== skipKey) return;
    const nextPrep = { key: skipKey, complete: prepComplete };
    if (justCompleted(prevPrep.current, nextPrep)) setPrepJustReady(true);
    prevPrep.current = nextPrep;
  }, [loaded, topic, skipKey, skipsFor, prepComplete]);
  const clearPrepJustReady = useCallback(() => setPrepJustReady(false), []);

  const grade = active?.gradeId ? getPickerGrades().find(g => g.id === active.gradeId) : undefined;
  const subject = active?.subjectId ? getPickerSubjects().find(s => s.id === active.subjectId) : undefined;
  const gradeLabel = grade ? (isAr ? grade.nameAr : grade.name) : '';
  const subjectLabel = subject ? (isAr ? subject.nameAr : subject.name) : '';

  /**
   * Params that open a generator on this lesson's own grade and subject.
   *
   * Never omitted and never hand-rolled: every `/ai-tools/*` screen defaults
   * `subjectIdx` to 0, so a tool opened with a bare topic generates the first
   * subject's material under this lesson's title — the trap CLAUDE.md
   * describes. `lessonPickerParams` computes both indices from the lesson's
   * own book; `scopePickerParams` is the fallback when the pick carries ids
   * but no lesson.
   */
  const toolParams = useMemo((): Record<string, string> => {
    const idx =
      lessonPickerParams(active?.lessonId, lang as 'ar' | 'en') ??
      scopePickerParams(active?.gradeId, active?.subjectId);
    // The lesson id too: a title does not identify a lesson (Slides reads it).
    const lessonId: Record<string, string> = idx && active?.lessonId ? { lessonId: active.lessonId } : {};
    return { ...(topic ? { topic } : {}), ...(idx ?? {}), ...lessonId };
  }, [active?.lessonId, active?.gradeId, active?.subjectId, topic, lang]);

  const openLessonPicker = useCallback(() => {
    // `returnTo`: the picker lives in the chat tab, which is not in the phone
    // tab bar — the chat sends the teacher back here once it closes.
    router.push({ pathname: '/iqra', params: { openLessonPicker: String(Date.now()), returnTo: '/' } });
  }, []);

  const handleStartClass = useCallback(async () => {
    if (startingClass || !topic) return;
    setStartingClass(true);
    setStartClassError('');
    try {
      // A «عرض الحصة» the teacher already made for this lesson is the deck
      // they meant to teach from — present it instead of building a new one.
      const saved = savedDeckFor(materials, topic, active?.lessonId);
      if (saved) {
        setPendingClassroomActivity(saved);
        trackEvent('class_started', { source, deck: 'saved' });
        router.push('/ai-tools/classroom/presentation' as never);
        return;
      }
      // The lesson's own subject, not the deck builder's maths default —
      // `isMathContext` reads the subject *name*, so a chemistry lesson
      // announced as "Mathematics" comes back as a deck of algebra questions
      // under the chemistry title.
      const activity = await buildClassDeck({
        topic,
        lang: lang as 'ar' | 'en',
        subjectId: active?.subjectId ?? undefined,
        subjectName: subject?.name,
        gradeId: active?.gradeId ?? undefined,
        lessonId: active?.lessonId ?? null,
      });
      setPendingClassroomActivity(activity);
      trackEvent('class_started', { source, deck: 'built' });
      router.push('/ai-tools/classroom/presentation' as never);
    } catch {
      setStartClassError(t('startClassFailed'));
    } finally {
      setStartingClass(false);
    }
  }, [startingClass, topic, lang, materials, active?.subjectId, active?.gradeId, active?.lessonId, subject?.name, t, source]);

  // ⌘K → «ابدأ الحصة» arrives as a nonce param, so pressing it twice fires
  // twice (a plain flag would have been swallowed the second time).
  useEffect(() => {
    if (!params.startClass) return;
    void handleStartClass();
    // Intentionally keyed on the nonce alone: re-running when handleStartClass
    // is rebuilt would start a class the teacher never asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startClass]);

  const dismissNudge = useCallback(() => {
    setNudgeDismissed(true);
    void dismissSetupNudge();
  }, []);

  const ask = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    router.push({
      pathname: '/iqra',
      params: { initialMessage: text, askId: String(Date.now()) },
    });
  }, []);

  /*
    Everything the board does not already offer. The first version took the
    first four of BEFORE_CLASS, which put a «خطة درس» card directly under the
    «خطة الدرس» row and a «شرائح الدرس» card under «عرض الحصة» — the same two
    buttons twice, and the card was the worse of each pair because it cannot
    say whether the material already exists. What is left is the rest of the
    catalog: the tools that have no row.
  */
  const quickTools = withoutBoardTools(WORKFLOW.flatMap(section => section.tools)).slice(0, 4);

  const suggestions = useMemo(() => suggestionsFor(board, topic, isAr), [board, topic, isAr]);

  return {
    topic,
    active,
    periodLine,
    next,
    setup,
    nudgeDismissed,
    dismissNudge,
    classes,
    board,
    summary,
    prepJustReady,
    clearPrepJustReady,
    toggleSkip,
    gradeLabel,
    subjectLabel,
    toolParams,
    quickTools,
    suggestions,
    startingClass,
    startClassError,
    startClass: handleStartClass,
    openLessonPicker,
    ask,
  };
}

/** Ask the assistant for whatever the board says is missing, in the board's order. */
function suggestionsFor(board: PrepRow[], topic: string, isAr: boolean): string[] {
  if (!topic) return [];
  const missing = board.filter(r => !r.done && !r.skipped).slice(0, 2);
  const asks = missing.map(row =>
    isAr ? `جهّز ${row.labelAr} عن «${topic}»` : `Prepare a ${row.labelEn.toLowerCase()} for “${topic}”`,
  );
  if (asks.length < 2) {
    asks.push(isAr ? `اشرح لي أصعب فكرة في «${topic}»` : `Explain the hardest idea in “${topic}”`);
  }
  return asks.slice(0, 3);
}

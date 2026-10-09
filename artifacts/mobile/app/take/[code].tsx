/**
 * A student sitting an exam. Usually the only screen in this app with no
 * account behind it — the link is the identity.
 *
 * Five states in one route rather than five routes: a student on a phone in a
 * classroom must never be one stray back-gesture away from losing their place,
 * and a router history they can walk backwards through is exactly that. The
 * only navigation is the one this screen offers.
 *
 * What it will not do, deliberately:
 *
 * - **Never show correctness.** Not by colour, not by ordering, not by a
 *   "check" button. The key is not even in the payload (see `studentView.ts`
 *   on the server), and behaving as if it were would teach students to look
 *   for it.
 * - **Never sign anyone in.** The exam-sitting token stays in this component.
 *   It is not put in the shared token store, where it could be mistaken for a
 *   teacher. The one exception is reading, never writing: if the device is
 *   already signed in as a student (`useAuth`), this screen asks the server
 *   once whether that account's own roster row is in this exam's class
 *   (`claimEvaluationAsSelf`) and skips straight past the name picker if so —
 *   a shortcut for an identity that already existed, not a new one.
 * - **Never lose an answer to a tap.** Every change saves, and a failed save
 *   says so rather than going quiet — a student cannot tell a slow network
 *   from a lost answer, so the screen has to.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isStudentRole, useAuth } from '@/context/AuthContext';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { bookFigureRefsForLessons } from '@/services/bookFigureUri';
import { questionRefersToFigure } from '@/services/questionFigures';
import {
  StudentExamError,
  claimEvaluationAsSelf,
  claimName,
  getExamResult,
  getExamState,
  isAnswered,
  openExam,
  saveStudentAnswer,
  submitStudentExam,
  type ClaimedAttempt,
  type ExamSummary,
  type RosterName,
  type StudentQuestion,
  type StudentResponse,
  type StudentResult,
} from '@/services/studentExam';
import { createSaveQueue, mergeUnsavedAnswers, type SaveQueue, type SaveQueueState } from '@/services/answerSaveQueue';
import { takeErrorKey } from '@/services/takeErrorKey';
import { clearExamSession, loadExamSession, loadUnsavedAnswers, saveExamSession, saveUnsavedAnswers } from '@/services/examSession';
import { formatMarks } from '@/services/studentAnswers';
import { StudentResultCard } from '@/components/StudentResultCard';
import { DictationInput, FillBlankInput, MatchingInput, ReadAloudInput } from '@/components/QuestionInputs';
import { isolateForeignRuns } from '@/services/mathRender';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';
import { Image } from 'expo-image';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

type Phase = 'loading' | 'pick' | 'confirm' | 'answering' | 'review' | 'done' | 'error';

/**
 * How long a keystroke waits before it is saved. A tap (an option, a
 * true/false, a matching pair) goes at once; typing is coalesced so a class
 * writing short answers is not a class hammering the `/take` limiter.
 */
const TYPING_SAVE_DELAY_MS = 600;

/** A typed answer: debounce. Everything else is a tap: save now. */
function isTypedResponse(response: StudentResponse): boolean {
  return typeof response['text'] === 'string' || Array.isArray(response['blanks']);
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}


export default function TakeExamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { code } = useLocalSearchParams<{ code: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [roster, setRoster] = useState<RosterName[]>([]);
  const [chosen, setChosen] = useState<RosterName | null>(null);
  const [token, setToken] = useState('');
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  // Curriculum lessons this paper covers, sent by the server as ids only. The
  // figures are bundled into this app, so they resolve locally with no network
  // and nothing student-facing crosses the wire but a few short strings.
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, StudentResponse>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  // Server time minus device time, measured when the paper is entered. The
  // countdown used to run on the device clock alone: a phone a few minutes
  // fast hit zero early and force-handed the paper in while the server's
  // deadline still stood. A slow clock was always harmless (the server
  // refuses late writes and that refusal hands in).
  const clockOffsetMs = useRef(0);
  const [notice, setNotice] = useState('');
  // Its own flag, not a `notice`: «تابعنا من حيث توقّفت» is about the
  // questions, and as a notice it carried over to «تم التسليم» — on a paper
  // reopened after hand-in, and on one resumed and then handed in.
  const [showResumed, setShowResumed] = useState(false);
  // Answers kept on this device that the server did not have when the paper
  // was re-entered; the save queue sends them as soon as it exists.
  const resendRef = useRef<Record<string, StudentResponse>>({});

  /**
   * Enter the paper with a sitting the server just handed over — a fresh
   * claim, a signed-in resume, or a stored token after a reload. One path,
   * so the three cannot drift on what gets restored.
   */
  const enterWith = useCallback(async (claimed: ClaimedAttempt, resumed: boolean) => {
    const state = await getExamState(claimed.token);
    setToken(claimed.token);
    setQuestions(state.questions.length ? state.questions : claimed.questions);
    const serverAnswers: Record<string, StudentResponse> = Object.fromEntries(
      state.answers.map(a => [a.questionId, a.response]),
    );
    if (code && !state.submittedAt) {
      const local = (await loadUnsavedAnswers(code)) as Record<string, StudentResponse>;
      const { answers: merged, resend } = mergeUnsavedAnswers(serverAnswers, local);
      resendRef.current = Object.fromEntries(resend.map(id => [id, local[id]]));
      setAnswers(merged);
    } else {
      setAnswers(serverAnswers);
    }
    // Resume wins over claim: an older API answers neither and the panel
    // simply stays empty, which is what this screen did before figures.
    setLessonIds(state.lessonIds ?? claimed.lessonIds ?? []);
    setDeadlineAt(state.deadlineAt ?? claimed.deadlineAt ?? null);
    if (state.serverNow) {
      const serverMs = new Date(state.serverNow).getTime();
      if (Number.isFinite(serverMs)) clockOffsetMs.current = serverMs - Date.now();
    }
    setChosen({ id: claimed.student.id, displayName: claimed.student.displayName, taken: true });
    if (code) await saveExamSession(code, { token: claimed.token, studentName: claimed.student.displayName });
    setNotice('');
    setShowResumed(resumed && !state.submittedAt);
    setPhase(state.submittedAt ? 'done' : 'answering');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const openLink = useCallback(async () => {
    if (!code) return;
    setPhase('loading');
    setError('');
    try {
      const data = await openExam(code);
      setExam(data.evaluation);
      setRoster(data.students);

      // A reload is a cold boot on web. A token stored by an earlier sitting
      // of this very code resumes it; without this the student came back to
      // the picker with their own name greyed out as taken.
      const stored = await loadExamSession(code);
      if (stored) {
        try {
          await enterWith(
            { token: stored.token, student: { id: '', displayName: stored.studentName }, questions: [] },
            true,
          );
          return;
        } catch (err) {
          // An expired or revoked token is the one case the store is wrong
          // about; anything else (a dropped connection) keeps it for next time.
          if (err instanceof StudentExamError && err.status === 401) await clearExamSession(code);
        }
      }
      setPhase('pick');
    } catch (err) {
      setError(t(takeErrorKey(err, 'takeLinkFailed')));
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, enterWith]);

  useEffect(() => { void openLink(); }, [openLink]);

  // A signed-in student gets one silent shot at skipping the picker. Gated on
  // `phase === 'pick'` (never 'confirm' or later) and a ref so it fires at
  // most once per mount — this is an identity shortcut, not a retry loop, and
  // firing it again after "ليس أنا" would defeat the point of that button.
  const { user, isLoading: authLoading } = useAuth();
  const autoClaimTried = useRef(false);
  useEffect(() => {
    if (phase !== 'pick' || authLoading || autoClaimTried.current) return;
    if (!code || !isStudentRole(user?.role)) return;
    autoClaimTried.current = true;
    claimEvaluationAsSelf(code).then(claimed => {
      if (!claimed) return;
      return enterWith(claimed, claimed.resumed === true);
    }).catch(() => {
      /* the picker is already showing; the shortcut simply did not apply */
    });
  }, [phase, authLoading, user?.role, code, enterWith]);

  const title = (lang === 'ar' ? exam?.titleAr : exam?.title) || exam?.titleAr || '';

  const start = useCallback(async () => {
    if (!chosen || !code || busy) return;
    setBusy(true);
    setError('');
    try {
      const claimed = await claimName(code, chosen.id);
      // A claim can only happen once, so there is nothing saved yet — but
      // `enterWith` reads the state back anyway rather than assuming, so
      // resume and first-start share one code path.
      await enterWith(claimed, false);
    } catch (err) {
      setError(t(takeErrorKey(err, 'takeStartFailed')));
      // A taken name sends them back to the list rather than stranding them:
      // the usual cause is tapping the wrong name, and the fix is to pick again.
      setPhase(err instanceof StudentExamError && err.code === 'name_taken' ? 'pick' : 'error');
      if (err instanceof StudentExamError && err.code === 'name_taken' && code) {
        openExam(code).then(d => setRoster(d.students)).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }, [chosen, code, busy, t, enterWith]);

  /*
    Answers the server has not confirmed. A failed save used to set a flag and
    nothing else: the answer sat only in this screen's memory unless the student
    happened to touch that question again, and hand-in went ahead without it.
    Now each one is remembered, re-sent on «أعد المحاولة», and re-sent before
    hand-in — which refuses while any is still unsaved. The queue also
    coalesces typing and keeps one request per question in flight; see
    `answerSaveQueue.ts` for the two failures that made it necessary.
  */
  const queueRef = useRef<SaveQueue | null>(null);
  const [saveState, setSaveState] = useState<SaveQueueState>({ pending: [], failed: [] });
  // The one refusal that ends the sitting from the server's side: time up, or
  // the teacher closed the exam. Shown once, and hand-in follows.
  const [writeRefusal, setWriteRefusal] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    const queue = createSaveQueue({
      delayMs: TYPING_SAVE_DELAY_MS,
      onChange: setSaveState,
      save: async (questionId, response) => {
        try {
          await saveStudentAnswer(token, questionId, response);
        } catch (err) {
          if (err instanceof StudentExamError && (err.code === 'time_up' || err.code === 'exam_closed')) {
            setWriteRefusal(err.code);
          }
          throw err;
        }
      },
    });
    queueRef.current = queue;
    for (const [id, response] of Object.entries(resendRef.current)) queue.set(id, response, { immediate: true });
    resendRef.current = {};
    return () => {
      queue.dispose();
      queueRef.current = null;
    };
  }, [token]);
  const unsavedCount = saveState.failed.length;

  // Mirror every answer the server has not confirmed into storage, so a
  // reload or a killed app mid-paper does not take them with it.
  useEffect(() => {
    if (!code || !token) return;
    if (phase === 'done') {
      void saveUnsavedAnswers(code, {});
      return;
    }
    // The queue's own state, not `saveState`: on re-entry the resent answers
    // are in the queue a render before `saveState` hears of them, and writing
    // the stale empty list would wipe them from storage in between.
    const pending = queueRef.current?.state().pending ?? saveState.pending;
    const unsaved = Object.fromEntries(
      pending.filter(id => answers[id] !== undefined).map(id => [id, answers[id]]),
    );
    void saveUnsavedAnswers(code, unsaved);
  }, [code, token, phase, saveState, answers]);

  const retryUnsaved = useCallback(async () => {
    return queueRef.current ? queueRef.current.flush() : true;
  }, []);

  const answer = useCallback(
    (questionId: string, response: StudentResponse, opts?: { immediate?: boolean }) => {
      setAnswers(prev => ({ ...prev, [questionId]: response }));
      // Say it out loud. A student cannot tell a slow network from a lost
      // answer, and finding out at the end is finding out too late.
      queueRef.current?.set(questionId, response, {
        immediate: opts?.immediate ?? !isTypedResponse(response),
      });
    },
    [],
  );

  /**
   * Update what the screen shows without saving. For the read-aloud answer,
   * which the server composes on upload: echoing it back through the save
   * path used to overwrite the stored recording key with the placeholder
   * this screen holds, and would let the client write a transcript at all —
   * which the server now refuses.
   */
  const answerLocal = useCallback((questionId: string, response: StudentResponse) => {
    setAnswers(prev => ({ ...prev, [questionId]: response }));
  }, []);

  const unanswered = useMemo(
    () => questions.filter(q => !isAnswered(answers[q.id])).length,
    [questions, answers],
  );

  const [checkingResult, setCheckingResult] = useState(false);
  const [resultChecked, setResultChecked] = useState(false);
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);

  const checkResult = useCallback(async () => {
    if (!token || checkingResult) return;
    setCheckingResult(true);
    try {
      const data = await getExamResult(token);
      setResultChecked(true);
      setStudentResult(data.ready ? data.result ?? null : null);
    } catch {
      // A network hiccup here is not worth a dedicated error state — the
      // button stays and the student just taps it again.
      setResultChecked(false);
    } finally {
      setCheckingResult(false);
    }
  }, [token, checkingResult]);

  const hand = useCallback(async (opts?: { force?: boolean }) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // Flush first: a keystroke still debouncing is an answer the student
      // gave. When the clock ran out a save may now be refused; what reached
      // the server in time is what gets handed in.
      const saved = await retryUnsaved();
      if (!saved && !opts?.force) {
        setError(t('takeUnsavedBeforeHandIn'));
        return;
      }
      await submitStudentExam(token);
      setPhase('done');
    } catch (err) {
      if (err instanceof StudentExamError && err.code === 'already_submitted') {
        setPhase('done');
        return;
      }
      setError(t(takeErrorKey(err, 'takeSubmitFailed')));
    } finally {
      setBusy(false);
    }
  }, [token, busy, t, retryUnsaved]);

  // The clock. `timeLimitMin` used to be shown to the teacher and enforced
  // nowhere; now the server refuses late answers and this hands in at zero.
  const [now, setNow] = useState(() => Date.now());
  const inPaper = phase === 'answering' || phase === 'review';
  useEffect(() => {
    if (!deadlineAt || !inPaper) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineAt, inPaper]);
  const remainingMs = deadlineAt ? new Date(deadlineAt).getTime() - (now + clockOffsetMs.current) : null;
  const autoHanded = useRef(false);
  useEffect(() => {
    const timeUp = (remainingMs !== null && remainingMs <= 0) || writeRefusal !== null;
    if (!timeUp || !inPaper || autoHanded.current) return;
    autoHanded.current = true;
    setNotice(t(writeRefusal === 'exam_closed' ? 'takeExamClosed' : 'takeTimeUp'));
    void hand({ force: true });
  }, [remainingMs, writeRefusal, inPaper, hand, t]);

  if (phase === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32, gap: 12 }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: 'center' }}>
          {error || t('takeLinkFailed')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
          {t('takeAskTeacher')}
        </Text>
        {/* A dropped connection looks exactly like a dead link from here. */}
        <Pressable
          onPress={openLink}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retryBtn, { borderColor: ACCENT, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="refresh" size={16} color={ACCENT} />
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32, gap: 12 }]}>
        <Ionicons name="checkmark-circle" size={56} color={ACCENT} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 20 }}>
          {t('takeHandedIn')}
        </Text>
        {notice ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
            {notice}
          </Text>
        ) : null}
        {/* Never a score by default. Releasing one is the teacher's decision
            (`releaseResultsToStudent`) and requires the paper to be fully
            marked — this only ever checks, on request, whether both are true
            yet; see `studentResultReady` on the server. */}
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
          {t('takeTeacherWillReview')}
        </Text>

        {studentResult ? (
          <View style={{ marginTop: 12, width: '100%' }}>
            <StudentResultCard result={studentResult} colors={colors} isRTL={isRTL} t={t} />
          </View>
        ) : (
          <View style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
            {resultChecked && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center' }}>
                {t('takeResultNotReady')}
              </Text>
            )}
            <Pressable
              onPress={checkResult}
              disabled={checkingResult}
              style={[styles.retryBtn, { borderColor: ACCENT, opacity: checkingResult ? 0.7 : 1 }]}
            >
              {checkingResult ? (
                <ActivityIndicator color={ACCENT} size="small" />
              ) : (
                <Ionicons name="refresh" size={16} color={ACCENT} />
              )}
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                {checkingResult ? t('takeCheckingResult') : t('takeCheckResult')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const header = (
    <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 14 }]}>
      <Text style={[styles.headerTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]} numberOfLines={2}>
        {title}
      </Text>
      {chosen && (
        <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {chosen.displayName}
        </Text>
      )}
      {remainingMs !== null && inPaper && (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.headerSub,
            { fontFamily: 'ReadexPro_600SemiBold', textAlign: align, color: remainingMs < 5 * 60_000 ? '#FDE68A' : 'rgba(255,255,255,0.95)' },
          ]}
        >
          {t('takeTimeLeft', formatCountdown(remainingMs))}
        </Text>
      )}
    </View>
  );

  if (phase === 'pick' || phase === 'confirm') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align }}>
            {t('takeQuestionsAndMarks', String(exam?.questionCount ?? 0), formatMarks(exam?.totalMarks))}
          </Text>

          {phase === 'confirm' && chosen ? (
            <View style={{ gap: 14, marginTop: 20, alignItems: 'center' }}>
              {/* The confirm step is the cheapest guard against a level landing
                  on the wrong child. It is not decoration. */}
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 22, textAlign: 'center' }}>
                {chosen.displayName}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
                {t('takeConfirmName')}
              </Text>
              {error ? (
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
                  {error}
                </Text>
              ) : null}
              <Pressable onPress={start} disabled={busy} style={[styles.primaryBtn, { backgroundColor: ACCENT_FILL, opacity: busy ? 0.7 : 1 }]}>
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 16 }}>{t('takeYesStart')}</Text>
                )}
              </Pressable>
              {/* Grey caption text read as a label, not a control, and a child who
                  tapped the wrong name never found the way back. */}
              <Pressable
                onPress={() => { setChosen(null); setPhase('pick'); }}
                hitSlop={8}
                accessibilityRole="button"
                style={[styles.navBtn, { borderColor: colors.border, minWidth: 200 }]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
                  {t('takeNotMe')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align, marginTop: 6 }}>
                {t('takePickYourName')}
              </Text>
              {error ? (
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align }}>
                  {error}
                </Text>
              ) : null}
              {roster.map(s => (
                <Pressable
                  key={s.id}
                  disabled={s.taken}
                  onPress={() => { setChosen(s); setError(''); setPhase('confirm'); }}
                  style={[
                    styles.nameRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: s.taken ? 0.45 : 1,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 16, flex: 1, textAlign: align }}>
                    {s.displayName}
                  </Text>
                  {s.taken && (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 }}>
                      {t('takeNameTaken')}
                    </Text>
                  )}
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (phase === 'review') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: align }}>
            {t('takeReviewTitle')}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {questions.map((q, i) => {
              const done = isAnswered(answers[q.id]);
              return (
                <Pressable
                  key={q.id}
                  onPress={() => { setIndex(i); setPhase('answering'); }}
                  style={[
                    styles.reviewDot,
                    { borderColor: done ? ACCENT : colors.border, backgroundColor: done ? ACCENT + '18' : 'transparent' },
                  ]}
                >
                  <Text style={{ color: done ? ACCENT : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                    {i + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name the number. "Are you sure?" is not information. */}
          <Text style={{ color: unanswered > 0 ? palette.warning : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align }}>
            {unanswered > 0 ? t('takeUnansweredWarning', String(unanswered)) : t('takeAllAnswered')}
          </Text>
          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align }}>{error}</Text>
          ) : null}

          <Pressable onPress={() => void hand()} disabled={busy} style={[styles.primaryBtn, { backgroundColor: ACCENT_FILL, opacity: busy ? 0.7 : 1 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 16 }}>{t('takeHandIn')}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setPhase('answering')} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>{t('takeBackToQuestions')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const question = questions[index];
  // Lesson-level, so on its own it sat under every question — a spelling item in a
  // maths paper got the maths lesson's compass rose. Show it only where the
  // question itself points at a figure.
  // A question that carries its own figure (attached by the teacher on the
  // worksheet it came from) shows that one, not the whole lesson's.
  const examFigures = question && !question.body['figure'] && questionRefersToFigure(question.body)
    ? bookFigureRefsForLessons(lessonIds, lang === 'ar')
    : [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <View
        style={{ height: 4, backgroundColor: colors.muted }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: questions.length, now: questions.length - unanswered }}
      >
        <View
          style={{
            height: 4,
            width: `${questions.length ? ((questions.length - unanswered) / questions.length) * 100 : 0}%`,
            backgroundColor: colors.primary,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
            {t('takeProgress', String(index + 1), String(questions.length))}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 }}>
            {t('takeQuestionMarks', question?.marks ?? '')}
          </Text>
          {unsavedCount > 0 && (
            <Pressable
              onPress={() => void retryUnsaved()}
              hitSlop={8}
              accessibilityRole="button"
              style={{ marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}
            >
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 }}>
                {t('takeSaveFailed')} · <Text style={{ fontFamily: 'ReadexPro_600SemiBold', textDecorationLine: 'underline' }}>{t('retry')}</Text>
              </Text>
            </Pressable>
          )}
        </View>

        {notice || showResumed ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
            {notice || t('takeResumed')}
          </Text>
        ) : null}

        {question ? (
          <QuestionCard
            question={question}
            response={answers[question.id] ?? {}}
            onAnswer={(r, o) => answer(question.id, r, o)}
            onLocal={r => answerLocal(question.id, r)}
            colors={colors}
            isRTL={isRTL}
            align={align}
            t={t}
            token={token}
          />
        ) : null}

        {/* The book's own diagrams for the lessons this paper covers.

            Under the question rather than on its own screen, because a student
            reading «انظر الشكل المجاور» — which is how the book itself writes
            such a question — needs to look at it without losing their place.
            Lesson-level, never bound to one question: the model that wrote
            these never saw the figures, so picking one per item would be a
            citation it invented, the same refusal `exportHtml.ts` documents.

            Same panel the teacher sees on the review screen, so the paper a
            student sits and the paper a teacher checked show the same
            diagrams. */}
        <BookFiguresPanel
          figures={examFigures}
          isRTL={isRTL}
          colors={colors}
          labels={{ title: t('bookFiguresTitle'), note: t('bookFiguresStudentNote') }}
        />

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 8 }}>
          <Pressable
            onPress={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0}
            style={[styles.navBtn, { borderColor: colors.border, opacity: index === 0 ? 0.4 : 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>{t('takePrevious')}</Text>
          </Pressable>
          {index < questions.length - 1 ? (
            <Pressable onPress={() => setIndex(i => i + 1)} style={[styles.navBtn, { borderColor: ACCENT, backgroundColor: ACCENT_FILL, flex: 1 }]}>
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('takeNext')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setPhase('review')} style={[styles.navBtn, { borderColor: ACCENT, backgroundColor: ACCENT_FILL, flex: 1 }]}>
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('takeReview')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * One question, rendered by type.
 *
 * Every branch reports its answer through `onAnswer`, which saves — there is
 * no separate "save" affordance, because a student who has to remember to
 * press one will not.
 */
function QuestionCard({
  question, response, onAnswer, onLocal, colors, isRTL, align, t, token,
}: {
  question: StudentQuestion;
  response: StudentResponse;
  /** Save this answer; `immediate` forces a tap-style save for a typed shape. */
  onAnswer: (r: StudentResponse, opts?: { immediate?: boolean }) => void;
  /** Show this answer without saving — the server already holds it. */
  onLocal: (r: StudentResponse) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
  /**
   * Only `read_aloud` needs this: its answer is uploaded directly rather than
   * autosaved through the parent, because the server stores the audio and
   * composes the response itself. The token stays in this tree and never
   * reaches the shared token store — see the header.
   */
  token: string;
}) {
  const body = question.body;
  // Isolated at the source: this is the paper a student actually sits, so an
  // equation reordered by the bidi algorithm is a wrong question in front of
  // someone who cannot ask why it looks odd.
  // Matching and fill-blank are absent here on purpose: neither body carries a
  // prompt field, and their inputs below render their own text. Falling back to
  // an empty string used to leave a matching question as a blank card.
  const prompt = isolateForeignRuns(
    (body['stem'] as string) ??
    (body['statement'] as string) ??
    (body['prompt'] as string) ??
    '',
  );

  const options = Array.isArray(body['options']) ? (body['options'] as { id: string; text: string }[]) : [];
  const picked = new Set(Array.isArray(response['optionIds']) ? (response['optionIds'] as string[]) : []);
  const multi = body['multiSelect'] === true;
  const boolValue = typeof response['value'] === 'boolean' ? (response['value'] as boolean) : null;
  const text = typeof response['text'] === 'string' ? (response['text'] as string) : '';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {prompt ? (
        <Text
          style={{
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            fontSize: 16,
            lineHeight: 26,
            textAlign: align,
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {prompt}
        </Text>
      ) : null}

      {/* The book figure the teacher attached to this question. The server only
          lets a book-figure URL through (questionFigure.ts). */}
      {typeof (body['figure'] as { uri?: unknown } | undefined)?.uri === 'string' ? (
        <View style={styles.figure}>
          <Image
            source={{ uri: (body['figure'] as { uri: string }).uri }}
            style={styles.figureImage}
            contentFit="contain"
            accessibilityLabel={String((body['figure'] as { caption?: unknown }).caption ?? '')}
          />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: 'center' }}>
            {String((body['figure'] as { caption?: unknown }).caption ?? '')}
          </Text>
        </View>
      ) : null}

      {question.type === 'multiple_choice' && (
        <View style={{ gap: 10, marginTop: 16 }}>
          {options.map(o => {
            const on = picked.has(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  if (!multi) return onAnswer({ optionIds: [o.id] });
                  const next = new Set(picked);
                  next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                  onAnswer({ optionIds: [...next] });
                }}
                style={[
                  styles.option,
                  {
                    // Selected, never correct. There is no correctness to show.
                    borderColor: on ? ACCENT : colors.border,
                    backgroundColor: on ? palette.selected : 'transparent',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
              >
                <Ionicons
                  name={on ? (multi ? 'checkbox' : 'radio-button-on') : multi ? 'square-outline' : 'radio-button-off'}
                  size={20}
                  color={on ? ACCENT : colors.mutedForeground}
                />
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: 'Almarai_400Regular',
                    fontSize: 15, lineHeight: 24,
                    flex: 1,
                    textAlign: align,
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {isolateForeignRuns(o.text)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {question.type === 'true_false' && (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 16 }}>
          {[{ v: true, key: 'trueLabel' as TranslationKey }, { v: false, key: 'falseLabel' as TranslationKey }].map(opt => {
            const on = boolValue === opt.v;
            return (
              <Pressable
                key={String(opt.v)}
                onPress={() => onAnswer({ value: opt.v })}
                style={[styles.tf, { borderColor: on ? ACCENT : colors.border, backgroundColor: on ? ACCENT : 'transparent' }]}
              >
                <Text style={{ color: on ? palette.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
                  {t(opt.key)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {question.type === 'matching' && (
        <View style={{ marginTop: 4 }}>
          <MatchingInput
            body={body}
            response={response}
            onChange={onAnswer}
            colors={colors}
            isRTL={isRTL}
            align={align}
            t={t}
          />
        </View>
      )}

      {question.type === 'fill_blank' && (
        // Was in the text-area list below, which saves `{text}` — a shape
        // `fill_blank.grade` does not read, so every one of these marked as
        // unanswered however well the student had filled it in.
        <View style={{ marginTop: 4 }}>
          <FillBlankInput
            body={body}
            response={response}
            onChange={onAnswer}
            onCommit={r => onAnswer(r, { immediate: true })}
            colors={colors}
            align={align}
            t={t}
          />
        </View>
      )}

      {question.type === 'read_aloud' && (
        <ReadAloudInput
          body={body}
          response={response}
          questionId={question.id}
          token={token}
          onSaved={onLocal}
          colors={colors}
          t={t}
        />
      )}

      {question.type === 'dictation' && (
        <DictationInput
          body={body}
          response={response}
          onChange={onAnswer}
          onCommit={r => onAnswer(r, { immediate: true })}
          colors={colors}
          align={align}
          t={t}
        />
      )}

      {['short_answer', 'open_ended', 'problem_solving', 'practical_task'].includes(question.type) && (
        <TextInput
          value={text}
          onChangeText={v => onAnswer({ text: v })}
          placeholder={t('takeWriteHere')}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.textArea,
            { color: colors.foreground, borderColor: colors.border, textAlign: align, fontFamily: 'Almarai_400Regular' },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { marginTop: 12, alignItems: 'center', gap: 4 },
  figureImage: { width: '100%', height: 180 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  headerTitle: { color: '#fff', fontSize: 19 },
  headerSub: { color: 'rgba(255,255,255,0.95)', fontSize: 14, lineHeight: 22 },
  nameRow: { alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18 },
  option: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  tf: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 120, marginTop: 16, fontSize: 15 },
  navBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24, minWidth: 200 },
  reviewDot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
});

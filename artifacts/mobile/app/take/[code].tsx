/**
 * A student sitting an exam. The only screen in this app with no account
 * behind it — the link is the identity.
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
 * - **Never sign anyone in.** The token stays in this component. It is not put
 *   in the shared token store, where it could be mistaken for a teacher.
 * - **Never lose an answer to a tap.** Every change saves, and a failed save
 *   says so rather than going quiet — a student cannot tell a slow network
 *   from a lost answer, so the screen has to.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { bookFigureRefsForLessons } from '@/services/bookFigureUri';
import {
  StudentExamError,
  claimName,
  getExamState,
  isAnswered,
  openExam,
  saveStudentAnswer,
  submitStudentExam,
  type ExamSummary,
  type RosterName,
  type StudentQuestion,
  type StudentResponse,
} from '@/services/studentExam';
import { FillBlankInput, MatchingInput } from '@/components/QuestionInputs';
import { isolateForeignRuns } from '@/services/mathRender';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

type Phase = 'loading' | 'pick' | 'confirm' | 'answering' | 'review' | 'done' | 'error';

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
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    openExam(code)
      .then(data => {
        setExam(data.evaluation);
        setRoster(data.students);
        setPhase('pick');
      })
      .catch(err => {
        setError(err instanceof StudentExamError ? err.message : t('takeLinkFailed'));
        setPhase('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const title = (lang === 'ar' ? exam?.titleAr : exam?.title) || exam?.titleAr || '';

  const start = useCallback(async () => {
    if (!chosen || !code || busy) return;
    setBusy(true);
    setError('');
    try {
      const claimed = await claimName(code, chosen.id);
      setToken(claimed.token);
      setQuestions(claimed.questions);
      setLessonIds(claimed.lessonIds ?? []);
      // A claim can only happen once, so there is nothing saved yet — but read
      // the state back anyway rather than assuming, so resume and first-start
      // share one code path.
      const state = await getExamState(claimed.token);
      setAnswers(Object.fromEntries(state.answers.map(a => [a.questionId, a.response])));
      // Resume wins over claim: an older API answers neither and the panel
      // simply stays empty, which is what this screen did before figures.
      if (state.lessonIds) setLessonIds(state.lessonIds);
      setPhase('answering');
    } catch (err) {
      setError(err instanceof StudentExamError ? err.message : t('takeStartFailed'));
      // A taken name sends them back to the list rather than stranding them:
      // the usual cause is tapping the wrong name, and the fix is to pick again.
      setPhase(err instanceof StudentExamError && err.code === 'name_taken' ? 'pick' : 'error');
      if (err instanceof StudentExamError && err.code === 'name_taken' && code) {
        openExam(code).then(d => setRoster(d.students)).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }, [chosen, code, busy, t]);

  const answer = useCallback(
    (questionId: string, response: StudentResponse) => {
      setAnswers(prev => ({ ...prev, [questionId]: response }));
      saveStudentAnswer(token, questionId, response)
        .then(() => setSaveFailed(false))
        // Say it out loud. A student cannot tell a slow network from a lost
        // answer, and finding out at the end is finding out too late.
        .catch(() => setSaveFailed(true));
    },
    [token],
  );

  const unanswered = useMemo(
    () => questions.filter(q => !isAnswered(answers[q.id])).length,
    [questions, answers],
  );

  const hand = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await submitStudentExam(token);
      setPhase('done');
    } catch (err) {
      setError(err instanceof StudentExamError ? err.message : t('takeSubmitFailed'));
    } finally {
      setBusy(false);
    }
  }, [token, busy, t]);

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
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: 'center' }}>
          {error || t('takeLinkFailed')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center' }}>
          {t('takeAskTeacher')}
        </Text>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32, gap: 12 }]}>
        <Ionicons name="checkmark-circle" size={56} color={ACCENT} />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 20 }}>
          {t('takeHandedIn')}
        </Text>
        {/* No score. Releasing a result is the teacher's decision, and showing
            correctness here would leak the key to everyone still sitting. */}
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: 'center' }}>
          {t('takeTeacherWillReview')}
        </Text>
      </View>
    );
  }

  const header = (
    <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 14 }]}>
      <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]} numberOfLines={2}>
        {title}
      </Text>
      {chosen && (
        <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {chosen.displayName}
        </Text>
      )}
    </View>
  );

  if (phase === 'pick' || phase === 'confirm') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
            {t('takeQuestionsAndMarks', String(exam?.questionCount ?? 0), String(exam?.totalMarks ?? ''))}
          </Text>

          {phase === 'confirm' && chosen ? (
            <View style={{ gap: 14, marginTop: 20, alignItems: 'center' }}>
              {/* The confirm step is the cheapest guard against a level landing
                  on the wrong child. It is not decoration. */}
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 22, textAlign: 'center' }}>
                {chosen.displayName}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: 'center' }}>
                {t('takeConfirmName')}
              </Text>
              {error ? (
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center' }}>
                  {error}
                </Text>
              ) : null}
              <Pressable onPress={start} disabled={busy} style={[styles.primaryBtn, { backgroundColor: ACCENT, opacity: busy ? 0.7 : 1 }]}>
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 16 }}>{t('takeYesStart')}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => { setChosen(null); setPhase('pick'); }} hitSlop={8}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 14 }}>
                  {t('takeNotMe')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: align, marginTop: 6 }}>
                {t('takePickYourName')}
              </Text>
              {error ? (
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
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
                  <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 16, flex: 1, textAlign: align }}>
                    {s.displayName}
                  </Text>
                  {s.taken && (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
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
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: align }}>
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
                  <Text style={{ color: done ? ACCENT : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
                    {i + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name the number. "Are you sure?" is not information. */}
          <Text style={{ color: unanswered > 0 ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: align }}>
            {unanswered > 0 ? t('takeUnansweredWarning', String(unanswered)) : t('takeAllAnswered')}
          </Text>
          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{error}</Text>
          ) : null}

          <Pressable onPress={hand} disabled={busy} style={[styles.primaryBtn, { backgroundColor: ACCENT, opacity: busy ? 0.7 : 1 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 16 }}>{t('takeHandIn')}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setPhase('answering')} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 14 }}>{t('takeBackToQuestions')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const question = questions[index];
  const examFigures = bookFigureRefsForLessons(lessonIds, lang === 'ar');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
            {t('takeProgress', String(index + 1), String(questions.length))}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
            {t('marksAbbrev', question?.marks ?? '')}
          </Text>
          {saveFailed && (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
              {t('takeSaveFailed')}
            </Text>
          )}
        </View>

        {question ? (
          <QuestionCard
            question={question}
            response={answers[question.id] ?? {}}
            onAnswer={r => answer(question.id, r)}
            colors={colors}
            isRTL={isRTL}
            align={align}
            t={t}
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
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14 }}>{t('takePrevious')}</Text>
          </Pressable>
          {index < questions.length - 1 ? (
            <Pressable onPress={() => setIndex(i => i + 1)} style={[styles.navBtn, { borderColor: ACCENT, backgroundColor: ACCENT, flex: 1 }]}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>{t('takeNext')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setPhase('review')} style={[styles.navBtn, { borderColor: ACCENT, backgroundColor: ACCENT, flex: 1 }]}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>{t('takeReview')}</Text>
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
  question, response, onAnswer, colors, isRTL, align, t,
}: {
  question: StudentQuestion;
  response: StudentResponse;
  onAnswer: (r: StudentResponse) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
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
                    backgroundColor: on ? ACCENT + '12' : 'transparent',
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
                    fontSize: 15,
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
                <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
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
            onCommit={onAnswer}
            colors={colors}
            align={align}
            t={t}
          />
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  headerTitle: { color: '#fff', fontSize: 19 },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  nameRow: { alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18 },
  option: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  tf: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 120, marginTop: 16, fontSize: 15 },
  navBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18 },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 24, minWidth: 200 },
  reviewDot: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
});

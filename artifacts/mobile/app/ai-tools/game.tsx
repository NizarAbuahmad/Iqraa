/**
 * Class Challenge builder — set up a phone-free team quiz game.
 *
 * The game is built from a quiz, so this screen generates one and converts it.
 * Two things are worth knowing before reading the code:
 *
 *  1. It asks only for multiple-choice questions. A game deck drops anything
 *     it cannot adjudicate on the projector (see `buildGameDeckFromQuiz`), so
 *     requesting short-answer items would mean generating content that is then
 *     thrown away — and a teacher who asked for 10 questions would be handed 6.
 *
 *  2. Team count is a setup decision, not a runtime one. The teacher physically
 *     rearranges the room before the first slide; changing it mid-game would
 *     invalidate a ledger that is already half-written.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { contentLang, topicInLang } from '@/services/contentLanguage';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PillSelector } from '@/components/ui/PillSelector';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { Button } from '@/components/ui/Button';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { aiErrorMessageKey, isAbortError } from '@/services/ai/aiProvenance';
import { isolateForeignRuns } from '@/services/mathRender';
import type { ClassroomActivity, QuizOutput } from '@/services/ai/AIService';
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { regenerationFields } from '@/services/ai/regeneration';
import { buildGameDeckFromQuiz } from '@/services/classDeck';
import { bookFigureUri } from '@/services/bookFigureUri';
import { createGame, MAX_TEAMS, MIN_TEAMS } from '@/services/classGame';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectPickerLabels, topicPickerParams, scopeFromParams } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { readableOn } from '@/services/readableColor';
import { palette } from '@/constants/colors';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { nextFrame } from '@/services/nextFrame';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const QUESTION_COUNTS = [5, 8, 10, 12];

export default function ClassGameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
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
  const [initialScope] = useState(() => scopeFromParams(params, uiLang, teacherScope.defaultScope));
  const [gradeIdx, setGradeIdx] = useState(initialScope.gradeIdx);
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = teacherScope.subjectHiddenFor(grades[gradeIdx].id);
  // Labels are per-grade too: Grade 6's creative-arts book has no music in
  // it, so it must not be offered under the combined name. Same index
  // alignment as the mask above.
  const subjectNames = subjectPickerLabels(grades[gradeIdx].id, uiLang);
  const [subjectIdx, setSubjectIdx] = useState(initialScope.subjectIdx);
  // The picked subject's material language — an English game is played in
  // English. A subject change clears the deck, so the deck always shares it.
  const lang = contentLang(subjects[subjectIdx].id, uiLang);
  const isAr = lang === 'ar';
  const [topic, setTopic] = useState(() => topicInLang(
    params.topic ?? '', uiLang, contentLang(subjects[initialScope.subjectIdx].id, uiLang),
    { gradeId: grades[initialScope.gradeIdx].id, subjectId: subjects[initialScope.subjectIdx].id },
  ));
  useWarmGrounding(topic, lang);
  const [teamCount, setTeamCount] = useState(4);
  const [questionCount, setQuestionCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  const [grounded, setGrounded] = useState(false);
  const [groundedLesson, setGroundedLesson] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  useAbortOnUnmount(abortRef);
  const [cancelled, setCancelled] = useState(false);
  // The raw quiz behind the current deck — `deck` is a projector-ready
  // transform (slide `content`, no `variantId`) and can't tell a regeneration
  // what to avoid, so the source quiz is kept separately for that.
  const previousQuizRef = useRef<QuizOutput | null>(null);
  /** The grounding the current deck was built with, so it can be rebuilt. */
  const groundingRef = useRef<GeneratorGrounding | null>(null);

  // Preview teams with the same factory the game uses, so the names, emojis and
  // colours a teacher sees here are exactly the ones that appear on the board.
  const previewTeams = createGame(teamCount, questionCount, isAr).teams;

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      // A «subject mismatch» refusal is about the old pairing; it used to
      // stay on screen in red under the now-empty topic field.
      setError('');
      setDeck(null);
      previousQuizRef.current = null;
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  /** `regenerate` is the teacher asking for a replacement, not another copy —
   *  see the matching comment in quiz.tsx. */
  const generate = async (opts?: { regenerate?: boolean }) => {
    // Read before this run's result can replace it.
    const previous = previousQuizRef.current;
    // What a failed or cancelled run must hand back — the deck was cleared
    // up front and never restored.
    const held = { deck, quiz: previousQuizRef.current, grounding: groundingRef.current };
    const trimmed = topic.trim();
    if (!trimmed) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // game — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (scope) { setError(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    const conflict = groundedSubjectConflict(trimmed, lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError(''); setCancelled(false); setLoading(true); setDeck(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    const controller = new AbortController();
    abortRef.current = controller;

    const grounding = resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en');
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');
    const restore = () => {
      if (!held.deck) return;
      setDeck(held.deck);
      previousQuizRef.current = held.quiz;
      groundingRef.current = held.grounding;
      setGrounded(held.grounding?.grounded ?? false);
      setGroundedLesson(held.grounding?.lesson ? (isAr ? held.grounding.lesson.titleAr : held.grounding.lesson.titleEn) : '');
    };

    try {
      const quiz = await aiService.generateQuiz({
        // Localised like quiz.tsx: `grade` is display-only and rides into the
        // generated content verbatim — an Arabic deck should not read
        // «الصف: Grade 10». `subject` stays English on purpose: it feeds
        // isMathContext and the other subject-name branches.
        grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: trimmed,
        numQuestions: questionCount,
        questionTypes: ['multiple_choice'],
        language: isAr ? 'arabic' : 'english',
        additionalContext: buildGeneratorContext(trimmed, lang as 'ar' | 'en'),
        unitId: generatorUnitId(trimmed, lang as 'ar' | 'en'),
        lessonId: generatorLessonId(trimmed, lang as 'ar' | 'en'),
        // The quiz screen asks for the book's figures; this one did not, so
        // a game on a figure-heavy lesson had none to show.
        bookFigureCount: generatorFigureCount(trimmed, lang as 'ar' | 'en'),
        // Nothing here but the lesson the teacher picked, so the quiz behind
        // the deck can be shared with every other teacher who picks it.
        contextSource: 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
      }, { signal: controller.signal });
      previousQuizRef.current = quiz;
      groundingRef.current = grounding;

      const built = buildGameDeckFromQuiz(quiz, trimmed, isAr, {
        teamCount,
        lesson: grounding.lesson,
        verified: false,
        figureUri: bookFigureUri,
        grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        subject: subjectPickerLabels(grades[gradeIdx].id, lang)[subjectIdx],
      });

      // A deck with no scoreable questions is a game that cannot be played —
      // better to say so than to open a projector with only an intro and a
      // podium showing zeros.
      if ((built.game?.questionCount ?? 0) === 0) {
        setError(t('gameNoQuestions'));
        restore();
        return;
      }

      setDeck(built);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own action, not a failure to report.
      if (isAbortError(e)) setCancelled(true);
      else setError(t(aiErrorMessageKey(e)));
      restore();
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  /**
   * The team pill stays live after the deck is built, and the preview
   * follows it — but the deck did not: Start played the count the deck was
   * built with. Rebuild from the source quiz when the pill moves, so the
   * board shows the teams the teacher is looking at.
   */
  useEffect(() => {
    const quiz = previousQuizRef.current;
    if (!deck || !quiz || deck.game?.teamCount === teamCount) return;
    setDeck(buildGameDeckFromQuiz(quiz, topic.trim(), isAr, {
      teamCount,
      lesson: groundingRef.current?.lesson ?? null,
      verified: false,
      figureUri: bookFigureUri,
      // The deck's own, not the pickers': they may have moved since it was built.
      grade: deck.grade,
      subject: deck.subject,
    }));
    // Only the pill drives this; the deck it rebuilds is read, not watched.
  }, [teamCount]);

  const start = () => {
    if (!deck) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPendingClassroomActivity(deck);
    router.push('/ai-tools/classroom/presentation' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ToolHeader topPad={topPad} isRTL={isRTL} title={t('gameTitle')} subtitle={t('gameSubtitle')} leading="🏆" />

        {/* How it works — the format is unfamiliar, and a teacher will not risk
            a class period on a mode they have to guess at. */}
        <View style={[styles.howCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '35', borderRadius: colors.radius }]}>
          <Text style={[styles.howTitle, { color: ACCENT, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('gameHowTitle')}
          </Text>
          {[t('gameHow1'), t('gameHow2'), t('gameHow3'), t('gameHow4')].map((line, i) => (
            <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <View style={[styles.stepNum, { backgroundColor: ACCENT_FILL }]}>
                <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, textAlign: isRTL ? 'right' : 'left' }}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.form}>
          <PillSelector
            label={t('grade')}
            options={grades.map((g, i) => ({ value: i, label: uiLang === 'ar' ? g.nameAr : g.name })).filter(o => !teacherScope.gradeHidden[o.value])}
            value={gradeIdx}
            onChange={setGradeIdx}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
            pillStyle={styles.pill}
          />
          <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />
          <PillSelector
            label={t('subjects')}
            options={subjects.map((s, i) => ({ value: i, label: subjectNames[i] })).filter(o => !subjectHidden[o.value])}
            value={subjectIdx}
            onChange={setSubjectIdx}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
            pillStyle={styles.pill}
          />

          <TopicSelector
            subjectId={subjects[subjectIdx].id}
            gradeId={grades[gradeIdx].id}
            value={topic}
            onChange={v => { setTopic(v); setError(''); }}
            lang={lang as 'ar' | 'en'}
            isRTL={isRTL}
            colors={colors}
            accent={ACCENT}
            hasError={!!error && !topic}
            t={t}
          />

          {/* Teams */}
          <View style={{ marginBottom: 18 }}>
            <PillSelector
              label={t('gameTeamCount')}
              options={Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i).map(n => ({ value: n, label: String(n) }))}
              value={teamCount}
              onChange={setTeamCount}
              colors={colors}
              isRTL={isRTL}
              accent={ACCENT}
              haptics
              pillStyle={styles.pill}
              containerStyle={{ marginBottom: 0 }}
            />

            {/* Which teams the class will actually be split into */}
            <View style={[styles.teamPreview, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {previewTeams.map(team => (
                <View
                  key={team.id}
                  style={[styles.teamChip, {
                    borderColor: team.color + '55',
                    backgroundColor: team.color + '12',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }]}
                >
                  <Text style={{ fontSize: 14 }}>{team.emoji}</Text>
                  <Text style={{ color: readableOn(team.color, colors.card, 5.5) /* on the team tint, so a margin over 4.5 */, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{team.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Questions */}
          <PillSelector
            label={t('gameQuestionCount')}
            options={QUESTION_COUNTS.map(n => ({ value: n, label: String(n) }))}
            value={questionCount}
            onChange={setQuestionCount}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
            haptics
            pillStyle={styles.pill}
          />

          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          <Button
            label={loading ? t('gameBuilding') : t('gameBuild')}
            onPress={() => generate()}
            loading={loading}
            disabled={!topic.trim()}
            fullWidth
          />
          {!topic.trim() ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
              {t('needTopicHint')}
            </Text>
          ) : null}
        </View>

        {cancelled && !loading && !deck && (
          <Text style={{ marginHorizontal: 20, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }}>
            {t('genCancelled')}
          </Text>
        )}

        {loading && (
          <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <ActivityIndicator color={ACCENT} />
            <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }}>
              {t('gameBuilding')}
            </Text>
            <Pressable onPress={cancelGenerate} hitSlop={8}>
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        )}

        {deck && !loading && (
          <View style={{ marginHorizontal: 20 }}>
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

            <View style={[styles.readyCard, { backgroundColor: colors.card, borderColor: ACCENT + '40', borderRadius: colors.radius }]}>
              <Text style={[styles.readyTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isAr ? 'right' : 'left' }]}>
                {deck.activityName}
              </Text>
              <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: colors.border }]}>
                <Stat icon="help-circle-outline" label={t('gameQuestionsReady', deck.game?.questionCount ?? 0)} />
                <Stat icon="people-outline" label={t('gameTeamsReady', deck.game?.teamCount ?? 0)} />
                <Stat icon="time-outline" label={`${deck.duration} ${t('min')}`} />
              </View>
            </View>

            {/* Materials — the one thing that must
                exist in the room before the game starts. */}
            <View style={[styles.materialsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.sectionLabel, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', textAlign: isAr ? 'right' : 'left' }]}>
                {isAr ? 'قبل أن تبدأ' : 'Before you start'}
              </Text>
              {deck.materials.map((m, i) => (
                <View key={i} style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', marginTop: 5 }}>
                  <View style={[styles.dot, { backgroundColor: ACCENT_FILL }]} />
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: 'Almarai_400Regular',
                      fontSize: 15,
                      lineHeight: 23,
                      textAlign: isAr ? 'right' : 'left',
                      writingDirection: isAr ? 'rtl' : 'ltr',
                    }}
                  >
                    {isolateForeignRuns(m)}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={start}
              style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT_FILL, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
            >
              <Ionicons name="play-circle" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 16 }}>{t('gameStart')}</Text>
            </Pressable>

            <Pressable
              onPress={() => generate({ regenerate: true })}
              style={[styles.regenBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="refresh-outline" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('regenerateBtn')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={ACCENT} />
      <Text style={{ fontSize: 12, color: ACCENT, fontFamily: 'ReadexPro_500Medium' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  howCard: { margin: 20, marginBottom: 0, padding: 16, borderWidth: 1 },
  howTitle: { fontSize: 14, marginBottom: 4 },
  stepNum: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  form: { padding: 20 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, minWidth: 46, alignItems: 'center' },
  teamPreview: { flexWrap: 'wrap', gap: 6, marginTop: 10 },
  teamChip: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginHorizontal: 20, marginBottom: 16 },
  readyCard: { borderWidth: 1.5, padding: 16, marginBottom: 12 },
  readyTitle: { fontSize: 17, marginBottom: 12 },
  statsRow: { borderTopWidth: 1, paddingTop: 12, gap: 16 },
  materialsCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  regenBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
});

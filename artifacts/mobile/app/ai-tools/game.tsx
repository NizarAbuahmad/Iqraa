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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { Button } from '@/components/ui/Button';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { ClassroomActivity } from '@/services/ai/AIService';
import { buildGeneratorContext, resolveGeneratorGrounding } from '@/services/kbContext';
import { buildGameDeckFromQuiz } from '@/services/classDeck';
import { createGame, MAX_TEAMS, MIN_TEAMS } from '@/services/classGame';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';

const ACCENT = '#F59E0B';
const QUESTION_COUNTS = [5, 8, 10, 12];

export default function ClassGameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(undefined, grades.length));
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(undefined, subjects.length));
  const [topic, setTopic] = useState('');
  const [teamCount, setTeamCount] = useState(4);
  const [questionCount, setQuestionCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  const [grounded, setGrounded] = useState(false);
  const [groundedLesson, setGroundedLesson] = useState('');
  const [error, setError] = useState('');

  // Preview teams with the same factory the game uses, so the names, emojis and
  // colours a teacher sees here are exactly the ones that appear on the board.
  const previewTeams = createGame(teamCount, questionCount, isAr).teams;

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      setDeck(null);
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  const generate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) { setError(t('topicRequired')); return; }
    setError(''); setLoading(true); setDeck(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const grounding = resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en');
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');

    try {
      const quiz = await aiService.generateQuiz({
        grade: grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: trimmed,
        numQuestions: questionCount,
        questionTypes: ['multiple_choice'],
        language: isAr ? 'arabic' : 'english',
        additionalContext: buildGeneratorContext(trimmed, lang as 'ar' | 'en') || undefined,
      });

      const built = buildGameDeckFromQuiz(quiz, trimmed, isAr, {
        teamCount,
        lesson: grounding.lesson,
        verified: false,
      });

      // A deck with no scoreable questions is a game that cannot be played —
      // better to say so than to open a projector with only an intro and a
      // podium showing zeros.
      if ((built.game?.questionCount ?? 0) === 0) {
        setError(t('gameNoQuestions'));
        return;
      }

      setDeck(built);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      setError(t('generationFailed'));
    } finally {
      setLoading(false);
    }
  };

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
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <AiSourceBadge onDark isRTL={isRTL} />
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 22 }}>🏆</Text>
            <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
              {t('gameTitle')}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}>
            {t('gameSubtitle')}
          </Text>
        </View>

        {/* How it works — the format is unfamiliar, and a teacher will not risk
            a class period on a mode they have to guess at. */}
        <View style={[styles.howCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '35', borderRadius: colors.radius }]}>
          <Text style={[styles.howTitle, { color: ACCENT, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('gameHowTitle')}
          </Text>
          {[t('gameHow1'), t('gameHow2'), t('gameHow3'), t('gameHow4')].map((line, i) => (
            <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
              <View style={[styles.stepNum, { backgroundColor: ACCENT }]}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.form}>
          <PickerRow
            label={t('grade')}
            items={grades.map(g => (isAr ? g.nameAr : g.name))}
            index={gradeIdx}
            onChange={setGradeIdx}
            colors={colors}
            isRTL={isRTL}
          />
          <PickerRow
            label={t('subjects')}
            items={subjects.map(s => (isAr ? s.nameAr : s.name))}
            index={subjectIdx}
            onChange={setSubjectIdx}
            colors={colors}
            isRTL={isRTL}
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
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('gameTeamCount')}
            </Text>
            <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i).map(n => {
                const active = n === teamCount;
                return (
                  <Pressable
                    key={n}
                    onPress={() => { setTeamCount(n); Haptics.selectionAsync(); }}
                    style={[styles.pill, {
                      backgroundColor: active ? ACCENT : colors.card,
                      borderColor: active ? ACCENT : colors.border,
                      borderRadius: colors.radius,
                    }]}
                  >
                    <Text style={[styles.pillText, {
                      color: active ? '#fff' : colors.mutedForeground,
                      fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                    }]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
                  <Text style={{ color: team.color, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>{team.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Questions */}
          <View style={{ marginBottom: 18 }}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('gameQuestionCount')}
            </Text>
            <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {QUESTION_COUNTS.map(n => {
                const active = n === questionCount;
                return (
                  <Pressable
                    key={n}
                    onPress={() => { setQuestionCount(n); Haptics.selectionAsync(); }}
                    style={[styles.pill, {
                      backgroundColor: active ? ACCENT : colors.card,
                      borderColor: active ? ACCENT : colors.border,
                      borderRadius: colors.radius,
                    }]}
                  >
                    <Text style={[styles.pillText, {
                      color: active ? '#fff' : colors.mutedForeground,
                      fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                    }]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          <Button
            label={loading ? t('gameBuilding') : t('gameBuild')}
            onPress={generate}
            loading={loading}
            fullWidth
          />
        </View>

        {loading && (
          <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <ActivityIndicator color={ACCENT} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>
              {t('gameBuilding')}
            </Text>
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
              <Text style={[styles.readyTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {deck.activityName}
              </Text>
              <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: colors.border }]}>
                <Stat icon="help-circle-outline" label={t('gameQuestionsReady', deck.game?.questionCount ?? 0)} />
                <Stat icon="people-outline" label={t('gameTeamsReady', deck.game?.teamCount ?? 0)} />
                <Stat icon="time-outline" label={`${deck.duration} ${t('min')}`} />
              </View>
            </View>

            {/* Materials — the printed letter cards are the one thing that must
                exist in the room before the game starts. */}
            <View style={[styles.materialsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.sectionLabel, { color: ACCENT, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                {isAr ? 'قبل أن تبدأ' : 'Before you start'}
              </Text>
              {deck.materials.map((m, i) => (
                <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', marginTop: 5 }}>
                  <View style={[styles.dot, { backgroundColor: ACCENT }]} />
                  <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                    {m}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={start}
              style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
            >
              <Ionicons name="play-circle" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 16 }}>{t('gameStart')}</Text>
            </Pressable>

            <Pressable
              onPress={generate}
              style={[styles.regenBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="refresh-outline" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>{t('regenerateBtn')}</Text>
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
      <Text style={{ fontSize: 12, color: ACCENT, fontFamily: 'Cairo_500Medium' }}>{label}</Text>
    </View>
  );
}

function PickerRow({
  label, items, index, onChange, colors, isRTL,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  colors: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {items.map((item, i) => {
          const active = i === index;
          return (
            <Pressable
              key={item + i}
              onPress={() => onChange(i)}
              style={[styles.pill, {
                backgroundColor: active ? ACCENT : colors.card,
                borderColor: active ? ACCENT : colors.border,
                borderRadius: colors.radius,
              }]}
            >
              <Text style={[styles.pillText, {
                color: active ? '#fff' : colors.mutedForeground,
                fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
              }]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  howCard: { margin: 20, marginBottom: 0, padding: 16, borderWidth: 1 },
  howTitle: { fontSize: 14, marginBottom: 4 },
  stepNum: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  form: { padding: 20 },
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, minWidth: 46, alignItems: 'center' },
  pillText: { fontSize: 13 },
  teamPreview: { flexWrap: 'wrap', gap: 6, marginTop: 10 },
  teamChip: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginHorizontal: 20, marginBottom: 16 },
  readyCard: { borderWidth: 1.5, padding: 16, marginBottom: 12 },
  readyTitle: { fontSize: 17, marginBottom: 12 },
  statsRow: { borderTopWidth: 1, paddingTop: 12, gap: 16 },
  materialsCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  regenBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
});

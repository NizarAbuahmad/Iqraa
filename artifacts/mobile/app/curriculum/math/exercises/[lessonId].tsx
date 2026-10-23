/**
 * One lesson's exercises, in two modes:
 * - Learn: every question with a «show solution» that reveals the key and, where
 *   a person wrote it, the working. A teacher can reveal them all at once to
 *   go through the set with the class.
 * - Test yourself: tap an option, it is marked at once and locked; a score
 *   line counts up, and the end offers the same set again or a new one.
 *
 * The lesson id in the URL is shareable and untrusted (`resolveExerciseLesson`).
 * A teacher gets a copy-link button to send the lesson's exercises to a class.
 * A finished test-yourself set saves the lesson's best score on this device
 * (`services/mathExerciseProgress.ts`); the set itself lives in this screen only.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { buildExerciseSet, exerciseGradeOf, exerciseLessonPath, resolveExerciseLesson, EXERCISES_ROUTE, type Exercise } from '@/services/mathExercises';
import { useExerciseBests } from '@/services/mathExerciseProgress';
import { PROD_ORIGIN } from '@/services/siteOrigin';
import { copyToClipboard } from '@/services/share';
import { goBack } from '@/services/navigation';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { MathParagraph } from '@/components/ui/MathParagraph';
import { useSurface } from '@/components/ui/Surface';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

type Mode = 'learn' | 'test';

export default function MathExerciseLessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isTeacher = isTeacherRole(user?.role);
  const lesson = resolveExerciseLesson(lessonId);

  const [mode, setMode] = useState<Mode>('learn');
  const [round, setRound] = useState(0);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const { bests, record } = useExerciseBests();
  // `round` is the only thing that asks for a fresh draw.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useMemo(() => (lesson ? buildExerciseSet(lesson, lang) : []), [lesson?.id, lang, round]);

  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';
  const grade = lesson ? exerciseGradeOf(lesson) : null;
  const answeredAll = mode === 'test' && set.length > 0 && Object.keys(picks).length === set.length;
  // Once per finished set: `picks` only changes again on retry or a new set,
  // which clears it, so this does not fire twice for one finish.
  useEffect(() => {
    if (!answeredAll || !lesson) return;
    void record(lesson.id, { correct: set.filter((e, i) => picks[i] === e.answer).length, total: set.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredAll]);

  const back = () => (router.canGoBack() ? goBack() : router.replace(`${EXERCISES_ROUTE}${grade ? `?grade=${grade}` : ''}` as never));

  if (!lesson) {
    return (
      <CornerFrame title={t('mathExTitle')} onBack={back}>
        <Text style={[styles.missing, { color: colors.mutedForeground }]}>{t('mathExNotFound')}</Text>
      </CornerFrame>
    );
  }

  const correct = set.filter((e, i) => picks[i] === e.answer).length;
  const finished = answeredAll;
  const best = bests[lesson.id];
  const allShown = set.length > 0 && shown.size === set.length;

  const reset = (fresh: boolean) => {
    setPicks({});
    setShown(new Set());
    if (fresh) setRound(r => r + 1);
  };
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    reset(false);
  };
  const toggleShown = (i: number) => {
    setShown(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const pick = (i: number, option: string, e: Exercise) => {
    if (picks[i] !== undefined) return;
    Haptics.notificationAsync(option === e.answer ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    setPicks(prev => ({ ...prev, [i]: option }));
  };
  const copyLink = async () => {
    try {
      await copyToClipboard(`${PROD_ORIGIN}${exerciseLessonPath(lesson.id)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (insecure origin, permissions); the button just does not confirm.
    }
  };

  const title = lang === 'ar' ? lesson.titleAr : lesson.titleEn || lesson.titleAr;
  const textStyle = { fontSize: TYPE.body, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align } as const;

  return (
    <CornerFrame title={title} eyebrow={grade ? t('hubGrade', grade) : undefined} onBack={back}>
      <View style={[styles.bar, { flexDirection: row }]}>
        {(['learn', 'test'] as const).map(m => {
          const on = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              accessibilityRole="button"
              aria-selected={on}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
            >
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                {t(m === 'learn' ? 'mathExLearn' : 'mathExTest')}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        {isTeacher ? (
          <Pressable onPress={copyLink} accessibilityRole="button" style={[styles.chip, styles.iconChip, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: row }]}>
            <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={16} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>
              {copied ? t('mathLinkCopied') : t('mathCopyLink')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {mode === 'learn' && isTeacher ? (
        <Pressable
          onPress={() => setShown(allShown ? new Set() : new Set(set.map((_, i) => i)))}
          accessibilityRole="button"
          style={[styles.linkRow, { flexDirection: row }]}
        >
          <Ionicons name={allShown ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
            {allShown ? t('mathExHideSolution') : t('mathExShowAll')}
          </Text>
        </Pressable>
      ) : null}

      {mode === 'test' ? (
        <Text style={[styles.score, { color: colors.foreground, textAlign: align }]}>{t('mathExScore', correct, set.length)}</Text>
      ) : null}
      {mode === 'test' && best ? (
        <Text style={[styles.best, { color: colors.mutedForeground, textAlign: align }]}>{t('mathExBest', best.correct, best.total)}</Text>
      ) : null}

      <View style={styles.list}>
        {set.map((e, i) => {
          const picked = picks[i];
          const reveal = mode === 'learn' ? shown.has(i) : picked !== undefined;
          return (
            <View key={`${round}-${i}`} style={[styles.card, surface]}>
              <Text style={[styles.qNum, { color: colors.mutedForeground, textAlign: align }]}>{t('mathExQuestion', i + 1)}</Text>
              <MathParagraph text={e.text} style={textStyle} isRTL={isRTL} />
              <View style={styles.options}>
                {e.options.map(o => {
                  const isKey = o === e.answer;
                  const mark = reveal && isKey ? colors.success : mode === 'test' && picked === o && !isKey ? colors.destructive : null;
                  return (
                    <Pressable
                      key={o}
                      disabled={mode === 'learn' || picked !== undefined}
                      onPress={() => pick(i, o, e)}
                      accessibilityRole="button"
                      style={[styles.option, { borderColor: mark ?? colors.border, borderWidth: mark ? 2 : 1, flexDirection: row }]}
                    >
                      <MathParagraph text={o} style={textStyle} isRTL={isRTL} containerStyle={{ flex: 1 }} />
                      {mark ? <Ionicons name={isKey ? 'checkmark-circle' : 'close-circle'} size={20} color={mark} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {mode === 'test' && picked !== undefined ? (
                <Text style={[styles.verdict, { color: picked === e.answer ? colors.success : colors.destructive, textAlign: align }]}>
                  {t(picked === e.answer ? 'mathExCorrect' : 'mathExWrong')}
                </Text>
              ) : null}
              {reveal && e.steps?.length ? (
                <View style={[styles.steps, { backgroundColor: colors.muted }]}>
                  {e.steps.map((s, k) => (
                    <MathParagraph key={k} text={s} style={{ ...textStyle, fontSize: TYPE.label }} isRTL={isRTL} />
                  ))}
                </View>
              ) : null}
              {mode === 'learn' ? (
                <Pressable onPress={() => toggleShown(i)} accessibilityRole="button" style={[styles.linkRow, { flexDirection: row, paddingHorizontal: 0 }]}>
                  <Ionicons name={reveal ? 'eye-off-outline' : 'bulb-outline'} size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                    {t(reveal ? 'mathExHideSolution' : 'mathExShowSolution')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {finished ? (
        <View style={[styles.card, surface, styles.done]}>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>{t('mathExDone')}</Text>
          <Text style={[styles.score, { color: colors.foreground, textAlign: 'center' }]}>{t('mathExScore', correct, set.length)}</Text>
          <View style={[styles.bar, { flexDirection: row, justifyContent: 'center' }]}>
            <Pressable onPress={() => reset(false)} accessibilityRole="button" style={[styles.chip, { borderColor: colors.primary, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('mathExRetry')}</Text>
            </Pressable>
            <Pressable onPress={() => reset(true)} accessibilityRole="button" style={[styles.chip, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('mathExNewSet')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => reset(true)} accessibilityRole="button" style={[styles.linkRow, { flexDirection: row, justifyContent: 'center' }]}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('mathExNewSet')}</Text>
        </Pressable>
      )}
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32, fontFamily: 'Almarai_400Regular' },
  bar: { flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  iconChip: { alignItems: 'center', gap: SPACE.xs },
  linkRow: { alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  score: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg },
  best: { paddingHorizontal: SPACE.lg, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption },
  list: { padding: SPACE.lg, gap: SPACE.md },
  card: { padding: SPACE.md, gap: SPACE.sm, borderRadius: RADIUS.lg },
  qNum: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  options: { gap: SPACE.sm },
  option: { alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  verdict: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  steps: { borderRadius: RADIUS.md, padding: SPACE.sm, gap: SPACE.xs },
  done: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg, alignItems: 'center' },
  doneTitle: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.title },
});

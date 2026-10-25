/**
 * The English hub: pick a grade, pick a lesson, play with its words.
 *
 * Under `/curriculum` so students reach it without touching the role gate
 * (`services/routeGating.ts`). Every grade 1–10 has a tab (`ENGLISH_CORNER_GRADES`);
 * word games exist for the grades whose books are glossed (`ENGLISH_HUB_GRADES`,
 * `@workspace/curriculum/englishHub`). A grade without them, or without a semester
 * of them, says so rather than looking empty. Every grade also gets its official
 * books and free listening / reading sites (`ResourceShelves`).
 */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { hubLessonsForGrade } from '@workspace/curriculum/englishHub';
import { ENGLISH_CORNER_GRADES } from '@workspace/curriculum/englishLinks';
import { hubLessonVisible } from '@workspace/curriculum/englishGrammar';
import { BADGE_IDS, badgesEarned, currentStreak, dayOf, lessonStars } from '@/services/englishHub/games';
import { useHubProgress } from '@/services/englishHub/progressStore';
import { goBack } from '@/services/navigation';
import { unitNames } from '@/services/contentLanguage';
import { BADGE_META } from '@/components/englishHub/badgeMeta';
import { BooksShelf, FreeSitesShelf } from '@/components/englishHub/ResourceShelves';
import { disableDailyReminder, enableDailyReminder, isReminderEnabled, syncDailyReminder } from '@/services/englishHub/dailyReminder';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export default function EnglishHubScreen() {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{ grade?: string }>();
  const [grade, setGrade] = useState(() => {
    const g = Number(params.grade);
    return (ENGLISH_CORNER_GRADES as readonly number[]).includes(g) ? g : 1;
  });
  const { progress } = useHubProgress();
  const today = dayOf(new Date());
  const streak = currentStreak(progress, today);
  const practicedToday = progress.lastDay === today;
  const earned = new Set(badgesEarned(progress));
  // A grammar-only lesson (too few words for the word activities) is listed only once a teacher has signed its grammar.
  const lessons = hubLessonsForGrade(grade).filter(l => hubLessonVisible(l.id));
  // Grades 9–10 offer several lessons per unit, so the unit title alone would
  // repeat on card after card; there the lesson's own title tells them apart.
  const unitKey = (l: { semester: number; unitNumber: number }) => `${l.semester}-${l.unitNumber}`;
  const perUnit = new Map<string, number>();
  for (const l of lessons) perUnit.set(unitKey(l), (perUnit.get(unitKey(l)) ?? 0) + 1);
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  const [reminderOn, setReminderOn] = useState(false);
  const reminderTitle = t('hubTitle');
  const reminderBody = t('hubDailyGoalTodo');

  // Re-synced on every focus, not just toggle: the one thing that must stay
  // true is "today's real progress decides whether a reminder is pending",
  // and focus is the only reliable moment this screen learns that changed
  // (see dailyReminder.ts's header for the trade-off this accepts).
  useFocusEffect(
    useCallback(() => {
      isReminderEnabled().then(on => {
        setReminderOn(on);
        if (on) void syncDailyReminder(reminderTitle, reminderBody, practicedToday);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [practicedToday]),
  );

  const toggleReminder = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      const granted = await enableDailyReminder(reminderTitle, reminderBody, practicedToday);
      setReminderOn(granted);
    } else {
      await disableDailyReminder();
      setReminderOn(false);
    }
  };

  return (
    <CornerFrame
      title={t('hubTitle')}
      subtitle={t('hubIntro')}
      // Public page: with no history, `goBack()`'s fallback is `/`, which sends a
      // visitor with no account to the login screen. `/play` is where they came from.
      onBack={() => (router.canGoBack() ? goBack() : router.replace('/play' as never))}
      bandChildren={
        <>
          {streak > 0 ? <Text style={[styles.streak, { textAlign: align }]}>{t('hubStreak', streak)}</Text> : null}
          <View style={[styles.goalRow, { flexDirection: row }]}>
            <Ionicons name={practicedToday ? 'checkmark-circle' : 'ellipse-outline'} size={16} color="#fff" />
            <Text style={styles.bandText}>{t(practicedToday ? 'hubDailyGoalDone' : 'hubDailyGoalTodo')}</Text>
          </View>
          {Platform.OS !== 'web' ? (
            <View style={[styles.goalRow, { flexDirection: row }]}>
              <Switch value={reminderOn} onValueChange={v => void toggleReminder(v)} trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#fff' }} thumbColor={colors.hero} />
              <Text style={[styles.bandText, { flexShrink: 1 }]}>{t('hubRemindMe')}</Text>
            </View>
          ) : null}
        </>
      }
    >
      {/* Only badges already earned show — an empty row for a brand-new student
          would read as "here are seven things you haven't done", not encouragement. */}
      {earned.size > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.badgeRow, { flexDirection: row }]}>
          {BADGE_IDS.filter(b => earned.has(b)).map(b => (
            <View key={b} style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={BADGE_META[b].icon} size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{t(BADGE_META[b].label)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.chips, { flexDirection: row }]}>
        {ENGLISH_CORNER_GRADES.map(g => {
          const on = g === grade;
          return (
            <Pressable
              key={g}
              onPress={() => setGrade(g)}
              accessibilityRole="button"
              aria-selected={on}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
            >
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                {t('hubGrade', g)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <CornerGrid>
        {lessons.map(l => {
          const stars = lessonStars(progress, l.id);
          const names = unitNames({ name: l.unitTitle, nameAr: l.unitTitleAr }, 'english', lang);
          return (
            // Titled by unit, not lesson: every Grade 1–4 hub lesson is the
            // unit's "Vocabulary & Grammar" one, so the lesson title tells a
            // child nothing and the unit title ("Look at my toys!") does —
            // in English, as the book prints it (`unitNames`).
            <PressableScale
              key={l.id}
              onPress={() => router.push({ pathname: '/curriculum/english/[lessonId]', params: { lessonId: l.id } } as never)}
              style={[styles.card, surface, { flexDirection: row }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.unit, { color: colors.mutedForeground, textAlign: align }]}>{t('hubUnit', l.unitNumber)}
                  {(perUnit.get(unitKey(l)) ?? 0) > 1 ? ` · ${lang === 'ar' ? l.titleAr || l.title : l.title}` : ''}
                </Text>
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }} numberOfLines={2}>
                  {names.title}
                </Text>
                {names.gloss ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }} numberOfLines={1}>
                    {names.gloss}
                  </Text>
                ) : null}
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {l.grammarOnly ? t('hubGrammarOnly') : `${t('hubWords', l.words.length)} · ${l.words.slice(0, 4).map(w => w.en).join(', ')}…`}
                </Text>
              </View>
              {stars > 0 ? (
                <Text style={{ fontSize: TYPE.caption, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>⭐ {stars}</Text>
              ) : null}
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
            </PressableScale>
          );
        })}
      </CornerGrid>

      {/* A grade with no word lists (6–8) or only one semester of them (10) must not look finished. */}
      {lessons.length === 0 ? (
        <View style={[styles.notice, surface, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{t('hubNoWordsTitle')}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>{t('hubNoWordsBody')}</Text>
        </View>
      ) : !lessons.some(l => l.semester === 2) ? (
        <View style={[styles.notice, surface, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>{t('hubSem2Soon')}</Text>
        </View>
      ) : null}

      <BooksShelf grade={grade} />
      <FreeSitesShelf grade={grade} />
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  streak: { color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, marginTop: SPACE.sm },
  goalRow: { alignItems: 'center', gap: 6, marginTop: SPACE.sm },
  bandText: { color: '#fff', fontFamily: 'Almarai_400Regular', fontSize: TYPE.body },
  badgeRow: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: 6 },
  chips: { flexWrap: 'wrap', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  unit: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 },
  card: { alignItems: 'center', gap: 10, padding: 14, flexGrow: 1 },
  notice: { gap: 4, padding: 14, marginHorizontal: SPACE.lg, marginTop: SPACE.md },
});

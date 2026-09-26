/**
 * The English hub: pick a grade, pick a lesson, play with its words.
 *
 * Under `/curriculum` so students reach it without touching the role gate
 * (`services/routeGating.ts`). Grades 1–4 only for now — the books whose words
 * are glossed and voiced; see `@workspace/curriculum/englishHub`.
 */
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { ENGLISH_HUB_GRADES, hubLessonsForGrade } from '@workspace/curriculum/englishHub';
import { BADGE_IDS, badgesEarned, currentStreak, dayOf, lessonStars } from '@/services/englishHub/games';
import { useHubProgress } from '@/services/englishHub/progressStore';
import { goBack } from '@/services/navigation';
import { BADGE_META } from '@/components/englishHub/badgeMeta';
import { disableDailyReminder, enableDailyReminder, isReminderEnabled, syncDailyReminder } from '@/services/englishHub/dailyReminder';

export default function EnglishHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{ grade?: string }>();
  const [grade, setGrade] = useState(() => {
    const g = Number(params.grade);
    return (ENGLISH_HUB_GRADES as readonly number[]).includes(g) ? g : 1;
  });
  const { progress } = useHubProgress();
  const today = dayOf(new Date());
  const streak = currentStreak(progress, today);
  const practicedToday = progress.lastDay === today;
  const earned = new Set(badgesEarned(progress));
  const lessons = hubLessonsForGrade(grade);
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.hero, paddingTop: insets.top + 12 }]}>
        {/* Public page: with no history, `goBack()`'s fallback is `/`, which
            sends a visitor with no account to the login screen. `/play` is where
            they came from, or where they'd want to go. */}
        <Pressable onPress={() => (router.canGoBack() ? goBack() : router.replace('/play' as never))} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.title, { textAlign: align }]}>{t('hubTitle')}</Text>
        <Text style={[styles.sub, { textAlign: align }]}>{t('hubIntro')}</Text>
        {streak > 0 ? <Text style={[styles.streak, { textAlign: align }]}>{t('hubStreak', streak)}</Text> : null}
        <View style={[styles.goalRow, { flexDirection: row }]}>
          <Ionicons name={practicedToday ? 'checkmark-circle' : 'ellipse-outline'} size={16} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
            {t(practicedToday ? 'hubDailyGoalDone' : 'hubDailyGoalTodo')}
          </Text>
        </View>
        {Platform.OS !== 'web' ? (
          <View style={[styles.goalRow, { flexDirection: row, marginTop: 10 }]}>
            <Switch value={reminderOn} onValueChange={v => void toggleReminder(v)} trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#fff' }} thumbColor={colors.hero} />
            <Text style={{ color: '#fff', fontFamily: 'Almarai_400Regular', fontSize: 13, flexShrink: 1 }}>{t('hubRemindMe')}</Text>
          </View>
        ) : null}
      </View>

      {/* Only badges already earned show — an empty row for a brand-new student
          would read as "here are seven things you haven't done", not encouragement. */}
      {earned.size > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.badgeRow, { flexDirection: row }]}>
          {BADGE_IDS.filter(b => earned.has(b)).map(b => (
            <View key={b} style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={BADGE_META[b].icon} size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>{t(BADGE_META[b].label)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.chips, { flexDirection: row }]}>
        {ENGLISH_HUB_GRADES.map(g => {
          const on = g === grade;
          return (
            <Pressable
              key={g}
              onPress={() => setGrade(g)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
            >
              <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                {t('hubGrade', g)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 60, gap: 10 }}>
        {lessons.map(l => {
          const stars = lessonStars(progress, l.id);
          return (
            // Titled by unit, not lesson: every hub lesson in these books is the
            // unit's "Vocabulary & Grammar" one, so the lesson title tells a
            // child nothing and the unit title ("Look at my toys!") does.
            <Pressable
                key={l.id}
                onPress={() => router.push({ pathname: '/curriculum/english/[lessonId]', params: { lessonId: l.id } } as never)}
                style={({ pressed }) => [
                  styles.card,
                  { flexDirection: row, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.unit, { color: colors.mutedForeground, textAlign: align }]}>{t('hubUnit', l.unitNumber)}</Text>
                  <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: align }} numberOfLines={2}>
                    {lang === 'ar' ? l.unitTitleAr || l.unitTitle : l.unitTitle}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                    {t('hubWords', l.words.length)} · {l.words.slice(0, 4).map(w => w.en).join(', ')}…
                  </Text>
                </View>
                {stars > 0 ? (
                  <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>⭐ {stars}</Text>
                ) : null}
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
              </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { marginBottom: 12, width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 24, marginBottom: 4 },
  sub: { color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 },
  streak: { color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 14, marginTop: 8 },
  goalRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  badgeRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  unit: { fontFamily: 'Cairo_600SemiBold', fontSize: 12 },
  card: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 14 },
});

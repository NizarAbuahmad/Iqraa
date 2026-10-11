// artifacts/mobile/app/(tabs)/school.tsx
/**
 * «المدرسة» — a student's or parent's weekly timetable, read-only.
 *
 * The server assembles it from the teachers' own timetables, so it is only as
 * complete as the teachers who have filled theirs in: an empty week is "not
 * entered yet", and the empty state says so rather than looking like a free
 * week. A parent sees one child at a time (a picker appears with more than
 * one); exams and results are one tap away on the existing «اختباراتي» screen.
 *
 * Not a Stack screen: it sits under the tab layout, which already pays for the
 * status bar — so no `insets.top` here, same as notifications.tsx.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getChildSchedules, getMySchedule } from '@/services/familyScheduleApi';
import {
  WEEKDAY_KEYS,
  activeChild,
  periodTimeLabel,
  type ChildSchedule,
  type FamilyPeriod,
} from '@/services/familySchedule';
import { subjectLabel } from '@/services/myExams';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

const ACCENT = palette.primary;

export default function SchoolScreen() {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [children, setChildren] = useState<ChildSchedule[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // The list to read depends on the role, so nothing loads until the session
  // has; a newer load wins over an older one still in flight (same guard as
  // my-exams.tsx).
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!user) return;
    const seq = ++loadSeq.current;
    setError('');
    try {
      const next = isParent ? await getChildSchedules() : await getMySchedule();
      if (seq === loadSeq.current) setChildren(next);
    } catch (e) {
      if (seq === loadSeq.current) setError(apiErrorMessage(e, 'schoolScheduleLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);

  // On every focus: a teacher may have entered their periods since last time.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const child = children ? activeChild(children, selected) : null;
  const today = new Date().getDay();
  const empty = children !== null && (child === null || child.schedule.days.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Not insets.top: the tab layout's bar above already pays for the status bar. */}
      <View style={[styles.header, { paddingTop: 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('schoolScheduleTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isParent ? 'schoolScheduleDescParent' : 'schoolScheduleDesc')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          // Clears the floating tab bar; deliberately not one SPACE step.
          paddingBottom: SPACE.hero * 2 + SPACE.xxl,
          gap: 12,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: rowDir },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textDecorationLine: 'underline' }}>
                {t('retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {children === null && !error ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : null}

        {isParent && children && children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, flexDirection: rowDir }, isRTL && { minWidth: '100%' }]}>
            {children.map(c => {
              const on = c.key === child?.key;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  aria-selected={on}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(c.key);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? ACCENT : colors.card, borderColor: on ? ACCENT : colors.border },
                  ]}
                >
                  <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                    {c.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {empty ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: ACCENT + '1F' }]}>
              <Ionicons name="calendar-outline" size={30} color={ACCENT} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: 'center' }}>
              {t('schoolEmptyTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              {t(isParent ? 'schoolEmptyDescParent' : 'schoolEmptyDesc')}
            </Text>
          </View>
        ) : null}

        {child?.schedule.days.map(day => (
          <View
            key={day.dayOfWeek}
            style={[styles.dayCard, { backgroundColor: colors.card, borderColor: day.dayOfWeek === today ? ACCENT : colors.border, borderRadius: colors.radius }]}
          >
            <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
                {t(WEEKDAY_KEYS[day.dayOfWeek] ?? 'schoolDaySun')}
              </Text>
              {day.dayOfWeek === today ? (
                <View style={[styles.todayChip, { backgroundColor: ACCENT + '1A' }]}>
                  <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('schoolToday')}</Text>
                </View>
              ) : null}
            </View>
            {day.periods.map((p, i) => (
              <PeriodRow
                key={`${p.periodNumber}:${p.teacherName}:${i}`}
                period={p}
                lang={lang}
                colors={colors}
                isRTL={isRTL}
                t={t}
              />
            ))}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-exams' as never)}
          style={({ pressed }) => [
            styles.examsRow,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: rowDir, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="document-text-outline" size={20} color={ACCENT} />
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
            {t(isParent ? 'childResultsTitle' : 'myExamsTitle')}
          </Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PeriodRow({
  period, lang, colors, isRTL, t,
}: {
  period: FamilyPeriod;
  lang: 'ar' | 'en';
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const subject = period.subjectId ? subjectLabel(period.subjectId, lang) : null;
  const time = periodTimeLabel(period);
  const meta = [period.teacherName, time].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 12, marginTop: SPACE.md }}>
      <View style={[styles.periodBadge, { backgroundColor: ACCENT + '1F' }]}>
        <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: 14 }}>{period.periodNumber}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
          {subject ?? t('schoolPeriodN', period.periodNumber)}
        </Text>
        {meta ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
            {meta}
          </Text>
        ) : null}
        {period.notes ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
            {period.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: TYPE.title },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 4 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
  empty: { alignItems: 'center', gap: SPACE.md, paddingHorizontal: 24, paddingTop: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: SPACE.lg, paddingVertical: 8 },
  dayCard: { borderWidth: 1, padding: SPACE.lg },
  todayChip: { borderRadius: 999, paddingHorizontal: SPACE.md, paddingVertical: 2 },
  periodBadge: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  examsRow: { alignItems: 'center', gap: 12, borderWidth: 1, padding: SPACE.lg, marginTop: 4 },
});

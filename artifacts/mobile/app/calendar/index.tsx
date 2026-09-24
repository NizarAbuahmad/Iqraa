/**
 * "What is my day?" — a month calendar combining the two schedule features:
 * the weekly recurring period timetable (services/schedule.ts) and each
 * teaching plan's own per-lesson calendar dates (services/planEntries.ts).
 * See services/scheduleCalendar.ts for why they're shown side by side rather
 * than merged into one interleaved timeline.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getSchedule, type SchedulePeriod, type ScheduleSlot } from '@/services/schedule';
import { listTeachingPlans, type TeachingPlan } from '@/services/teachingPlans';
import { listClasses, type ClassGroup } from '@/services/roster';
import { getLessonById } from '@/services/knowledgeBase';
import { buildDayAgenda, dayHasAgenda, isInMonth, monthGridDates } from '@/services/scheduleCalendar';
import { todayISO } from '@/services/planEntries';
import { goBack } from '@/services/navigation';

const ACCENT = '#007C74';
const WEEKDAY_KEYS = [
  'planWeekdaySun', 'planWeekdayMon', 'planWeekdayTue', 'planWeekdayWed',
  'planWeekdayThu', 'planWeekdayFri', 'planWeekdaySat',
] as const;

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const today = todayISO();
  const todayDate = new Date(`${today}T00:00:00`);

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const load = useCallback(async () => {
    setError('');
    try {
      const [schedule, planList] = await Promise.all([getSchedule(), listTeachingPlans()]);
      setPeriods(schedule.periods);
      setSlots(schedule.slots);
      setPlans(planList);
    } catch {
      setError(t('calendarLoadFailed'));
    } finally {
      setLoading(false);
    }
    // Best-effort, same as the other schedule screens: class names label the
    // agenda, they are not what the calendar itself depends on.
    try {
      setClasses(await listClasses());
    } catch {
      /* period rows fall back to showing the id */
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const classNameFor = (id: string): string => {
    const found = classes.find(c => c.id === id);
    if (!found) return id;
    return lang === 'ar' && found.nameAr ? found.nameAr : found.name;
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };
  const goToday = () => {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    setSelectedDate(today);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const dateHeading = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const gridDates = monthGridDates(viewYear, viewMonth);
  const selectedAgenda = buildDayAgenda(selectedDate, periods, slots, plans);
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => goBack()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={goToday} hitSlop={12}>
            <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('tabToday')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>{t('myCalendar')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Month navigation */}
          <View style={{ flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={isRTL ? goNextMonth : goPrevMonth} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
            </Pressable>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>{monthLabel}</Text>
            <Pressable onPress={isRTL ? goPrevMonth : goNextMonth} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={colors.foreground} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
            </Pressable>
          </View>

          {/* Weekday header */}
          <View style={{ flexDirection: rowDir }}>
            {WEEKDAY_KEYS.map(key => (
              <Text
                key={key}
                style={{ flex: 1, textAlign: 'center', color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18 }}
              >
                {t(key)}
              </Text>
            ))}
          </View>

          {/* Month grid: 6 fixed rows of 7 days */}
          <View style={{ gap: 4 }}>
            {Array.from({ length: 6 }, (_, week) => (
              <View key={week} style={{ flexDirection: rowDir, gap: 4 }}>
                {gridDates.slice(week * 7, week * 7 + 7).map(date => {
                  const inMonth = isInMonth(date, viewYear, viewMonth);
                  const isToday = date === today;
                  const isSelected = date === selectedDate;
                  const hasAgenda = inMonth && dayHasAgenda(buildDayAgenda(date, periods, slots, plans));
                  const dayNum = Number(date.slice(-2));
                  return (
                    <Pressable
                      key={date}
                      onPress={() => setSelectedDate(date)}
                      style={{
                        flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? ACCENT : 'transparent',
                        borderWidth: isToday && !isSelected ? 1.5 : 0,
                        borderColor: ACCENT,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? '#fff' : inMonth ? colors.foreground : colors.mutedForeground,
                          fontFamily: isToday || isSelected ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                          fontSize: 13, opacity: inMonth ? 1 : 0.4,
                        }}
                      >
                        {dayNum}
                      </Text>
                      {hasAgenda ? (
                        <View
                          style={{
                            width: 4, height: 4, borderRadius: 2, marginTop: 2,
                            backgroundColor: isSelected ? '#fff' : ACCENT,
                          }}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected day's agenda */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
              {dateHeading}
            </Text>

            {selectedAgenda.periods.length === 0 && selectedAgenda.lessons.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
                {t('calendarNoActivity')}
              </Text>
            ) : (
              <>
                {selectedAgenda.periods.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, lineHeight: 18, textAlign: align }}>
                      {t('calendarPeriodsSection')}
                    </Text>
                    {selectedAgenda.periods.map(p => (
                      <View
                        key={p.periodNumber}
                        style={{
                          flexDirection: rowDir, alignItems: 'center', gap: 8, padding: 10,
                          borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                        }}
                      >
                        <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>
                          {p.startTime || t('schedulePeriodNumber', p.periodNumber)}
                        </Text>
                        <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
                          {classNameFor(p.classGroupId)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedAgenda.lessons.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, lineHeight: 18, textAlign: align }}>
                      {t('calendarLessonsSection')}
                    </Text>
                    {selectedAgenda.lessons.map(l => {
                      const lesson = getLessonById(l.lessonId);
                      const title = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : l.lessonId;
                      return (
                        <View
                          key={`${l.planId}:${l.lessonId}`}
                          style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 2 }}
                        >
                          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13, textAlign: align }}>
                            {title}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, lineHeight: 18, textAlign: align }}>
                            {t('calendarLessonFrom', l.planTitle)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  heroTitle: { fontSize: 26, color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
});

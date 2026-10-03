/**
 * "What is my day?" — a month calendar combining the two schedule features:
 * the weekly recurring period timetable (services/schedule.ts) and each
 * teaching plan's own per-lesson calendar dates (services/planEntries.ts).
 * See services/scheduleCalendar.ts for why they're shown side by side rather
 * than merged into one interleaved timeline.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
import { palette } from '@/constants/colors';
import { LoadError } from '@/components/ui/LoadError';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { dateLocale } from '@/services/dateLabels';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
/** Keeps day cells a normal calendar-app size instead of stretching to CONTENT_MAX_WIDTH / 7. */
const CALENDAR_GRID_MAX_WIDTH = 480;
const WEEKDAY_KEYS = [
  'planWeekdaySun', 'planWeekdayMon', 'planWeekdayTue', 'planWeekdayWed',
  'planWeekdayThu', 'planWeekdayFri', 'planWeekdaySat',
] as const;

const CALENDAR_QUERY_KEY = ['calendar'] as const;
/** Same rationale as the classes list: a minute of cache means a quick
 * back-and-forth to this screen paints instantly instead of blanking to a
 * spinner on every focus. */
const CALENDAR_STALE_MS = 60_000;

type CalendarData = {
  periods: SchedulePeriod[];
  slots: ScheduleSlot[];
  plans: TeachingPlan[];
  classes: ClassGroup[];
};

/**
 * One combined load for the screen: the periods/slots/plans fetch drives the
 * error state shown in the UI, while the classes fetch stays best-effort —
 * class names only label the agenda, they are not what the calendar itself
 * depends on, so a failure there falls back to showing the id instead of
 * failing the whole screen.
 */
async function loadCalendarData(): Promise<CalendarData> {
  const [schedule, planList] = await Promise.all([getSchedule(), listTeachingPlans()]);
  let classes: ClassGroup[] = [];
  try {
    classes = await listClasses();
  } catch {
    /* period rows fall back to showing the id */
  }
  return { periods: schedule.periods, slots: schedule.slots, plans: planList, classes };
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const today = todayISO();
  const todayDate = new Date(`${today}T00:00:00`);

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const {
    data: calendarData,
    isLoading: loading,
    isError: loadFailed,
    refetch,
  } = useQuery({
    queryKey: CALENDAR_QUERY_KEY,
    queryFn: loadCalendarData,
    staleTime: CALENDAR_STALE_MS,
  });
  const { periods = [], slots = [], plans = [], classes = [] } = calendarData ?? {};
  const error = loadFailed ? t('calendarLoadFailed') : '';

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

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(dateLocale(lang === 'ar' ? 'ar' : 'en'), {
    month: 'long',
    year: 'numeric',
  });
  const dateHeading = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(dateLocale(lang === 'ar' ? 'ar' : 'en'), {
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
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => goBack()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={goToday} hitSlop={12}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t('tabToday')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{t('myCalendar')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
          {error ? (
            <LoadError message={error} onRetry={() => void refetch()} />
          ) : null}

          {/* Month nav + weekday header + grid: capped narrower than the page
              content — flex:1 cells sized off the full content width would
              turn into 150px+ squares on a wide desktop window, pushing the
              agenda below several screens' worth of scrolling. */}
          <View style={{ width: '100%', maxWidth: CALENDAR_GRID_MAX_WIDTH, alignSelf: 'center', gap: 16 }}>
            {/* Month navigation */}
            <View style={{ flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={isRTL ? goNextMonth : goPrevMonth} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={colors.foreground} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{monthLabel}</Text>
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
                            color: isSelected ? palette.primaryForeground : inMonth ? colors.foreground : colors.mutedForeground,
                            fontFamily: isToday || isSelected ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
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
          </View>

          {/* Selected day's agenda */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
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
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: align }}>
                      {t('calendarPeriodsSection')}
                    </Text>
                    {selectedAgenda.periods.map(p => (
                      <View
                        key={`${p.schoolName}|${p.periodNumber}`}
                        style={{
                          flexDirection: rowDir, alignItems: 'center', gap: 8, padding: 10,
                          borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                        }}
                      >
                        <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                          {p.startTime || t('schedulePeriodNumber', p.periodNumber)}
                        </Text>
                        <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
                          {classNameFor(p.classGroupId)}
                        </Text>
                        {p.schoolName ? (
                          <Text numberOfLines={1} style={{ maxWidth: 140, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                            {p.schoolName}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedAgenda.lessons.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: align }}>
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
                          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: align }}>
                            {title}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: align }}>
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
  hero: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  heroTitle: { fontSize: 26, color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

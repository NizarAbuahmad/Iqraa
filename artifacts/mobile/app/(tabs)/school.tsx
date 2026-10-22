// artifacts/mobile/app/(tabs)/school.tsx
/**
 * «المدرسة» — a student's or parent's school page: homework, then upcoming
 * exams, then the weekly timetable (read-only).
 *
 * The server assembles it from the teachers' own timetables, so it is only as
 * complete as the teachers who have filled theirs in: an empty week is "not
 * entered yet", and the empty state says so rather than looking like a free
 * week. A parent sees one child at a time (a picker appears with more than
 * one); results are one tap away on the existing «اختباراتي» screen.
 *
 * «الواجبات» comes first: a student ticks homework off (optimistically,
 * reverted if the save fails); a parent sees the same list per child,
 * read-only. A child with no student account cannot tick anything, so that
 * child's rows show only the due date — never «متأخّر» or a done mark.
 * «الاختبارات القادمة» lists the exams that have a planned day from today on
 * (a paper exam too, with no link), soonest first, for the same child the
 * picker shows. Homework, exams and timetable load, fail and refresh
 * independently, each with its own section and error banner, so one failing
 * never reads as another. The exam day is plain text, compared against
 * `ammanToday()` — never a device-local date.
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
import { getChildHomework, getMyHomework, setHomeworkDone } from '@/services/homeworkApi';
import { openResource } from '@/services/openResource';
import { LESSON_GAME_TITLE_KEY } from '@/services/lessonGames';
import {
  ammanToday,
  allTrackedDone,
  applyDone,
  dueBadge,
  formatDueDate,
  gameScoreText,
  homeworkSections,
  resourceKey,
  resultForGame,
  untrackedMode,
  type ChildHomework,
  type FamilyHomework,
} from '@/services/homework';
import {
  WEEKDAY_KEYS,
  activeChild,
  periodTimeLabel,
  type ChildSchedule,
  type FamilyPeriod,
} from '@/services/familySchedule';
import { getChildExams, getMyExams } from '@/services/studentExam';
import { MY_EXAM_STATE_KEY, myExamTitle, subjectLabel, type MyExam } from '@/services/myExams';
import {
  examDayKind,
  formatExamTime,
  formatExamWhen,
  groupChildExams,
  upcomingExams,
  type ExamGroup,
} from '@/services/upcomingExams';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { Celebrate } from '@/components/ui/Celebrate';
import { justCompleted } from '@/services/celebration';

const ACCENT = palette.primary;
/** Minimum touch target for the tick box. */
const TOUCH = 44;

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

  // Homework has its own list, error and sequence so it fails and reloads on
  // its own; `selected` is shared because both lists use the same child keys.
  const [homework, setHomework] = useState<ChildHomework[] | null>(null);
  // The list as last rendered, for a save that finishes after another tick.
  const homeworkNow = useRef(homework);
  homeworkNow.current = homework;
  const [hwError, setHwError] = useState('');
  // Ids whose save is in flight: the ref is the synchronous guard against a
  // double tap, the state only drives the dimmed look.
  const hwInFlight = useRef<Set<string>>(new Set());
  const [celebrateHw, setCelebrateHw] = useState(false);
  const [hwSaving, setHwSaving] = useState<ReadonlySet<string>>(new Set());

  // Exams have their own list, error and sequence, like homework: one failing
  // never blanks the other. A parent's rows are per roster row; grouped by the
  // server's child key so they follow the same picker.
  const [exams, setExams] = useState<ExamGroup[] | null>(null);
  const [examError, setExamError] = useState('');

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

  const hwSeq = useRef(0);
  const loadHomework = useCallback(async () => {
    if (!user) return;
    const seq = ++hwSeq.current;
    setHwError('');
    try {
      const next = isParent ? await getChildHomework() : await getMyHomework();
      if (seq === hwSeq.current) setHomework(next);
    } catch (e) {
      if (seq === hwSeq.current) setHwError(apiErrorMessage(e, 'hwLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);

  const examSeq = useRef(0);
  const loadExams = useCallback(async () => {
    if (!user) return;
    const seq = ++examSeq.current;
    setExamError('');
    try {
      const next: ExamGroup[] = isParent
        ? groupChildExams(await getChildExams())
        : [{ key: 'self', displayName: '', exams: await getMyExams() }];
      if (seq === examSeq.current) setExams(next);
    } catch (e) {
      if (seq === examSeq.current) setExamError(apiErrorMessage(e, 'upcomingExamsLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);

  // On every focus: a teacher may have entered their periods or set homework since last time.
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadHomework();
      void loadExams();
    }, [load, loadHomework, loadExams]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadHomework(), loadExams()]);
    setRefreshing(false);
  }, [load, loadHomework, loadExams]);

  const toggleDone = useCallback(
    async (childKey: string, item: FamilyHomework) => {
      if (hwInFlight.current.has(item.id)) return;
      const next = !item.done;
      hwInFlight.current.add(item.id);
      setHwSaving(new Set(hwInFlight.current));
      Haptics.selectionAsync();
      setHwError('');
      // A load that started before this tap must not land on top of it.
      hwSeq.current++;
      // The child's list as it stood before this tick, captured inside the
      // updater: `homework` in this closure is stale (deps are `[t]`).
      const seen: { before: FamilyHomework[] } = { before: [] };
      const patch = (fn: (items: FamilyHomework[]) => FamilyHomework[]) =>
        setHomework(prev => prev && prev.map(k => {
          if (k.key !== childKey) return k;
          seen.before = k.homework;
          return { ...k, homework: fn(k.homework) };
        }));
      patch(items => applyDone(items, item.id, next));
      try {
        await setHomeworkDone(item.id, next);
        // Only a tick that the server accepted, and only once no other save is
        // still out (an optimistic tick may yet roll back). The last save to
        // finish judges the list as it stands now, so ticking the last two
        // quickly still finishes it. (`hwInFlight` still holds this id here;
        // its `finally` removes it.)
        const othersInFlight = [...hwInFlight.current].some(id => id !== item.id);
        const now = homeworkNow.current?.find(k => k.key === childKey)?.homework ?? [];
        if (next && !othersInFlight && justCompleted(
          { key: childKey, complete: allTrackedDone(seen.before) },
          { key: childKey, complete: allTrackedDone(now) },
        )) setCelebrateHw(true);
      } catch (e) {
        patch(items => items.map(h => (h.id === item.id ? item : h)));
        setHwError(apiErrorMessage(e, 'hwSaveFailed', t));
      } finally {
        hwInFlight.current.delete(item.id);
        setHwSaving(new Set(hwInFlight.current));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const child = children ? activeChild(children, selected) : null;
  const today = new Date().getDay();
  const empty = children !== null && (child === null || child.schedule.days.length === 0);

  // The picker reads whichever list arrived, so it survives one of them failing.
  const pickerKids: readonly { key: string; displayName: string }[] = children ?? homework ?? exams ?? [];
  const hwChild = homework ? (homework.find(c => c.key === selected) ?? homework[0] ?? null) : null;
  // Whether an item can be ticked is the ITEM's flag (ticking is per class), not the child's.
  const hw = homeworkSections(hwChild?.homework ?? []);
  const untrackedKind = untrackedMode(hwChild?.homework ?? []);
  const hwEmpty = homework !== null && !hwError && hw.sections.length === 0;
  const hwToday = ammanToday();
  // Same child as the picker shows, whichever list decided it.
  const activeKey = selected ?? child?.key ?? hwChild?.key ?? null;
  const examChild = exams ? (exams.find(g => g.key === activeKey) ?? exams[0] ?? null) : null;
  const upcoming = upcomingExams(examChild?.exams ?? [], hwToday);
  const loading =
    (children === null && !error) || (homework === null && !hwError) || (exams === null && !examError);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Not insets.top: the tab layout's bar above already pays for the status bar. */}
      <View style={[styles.header, { paddingTop: 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('tabSchool')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isParent ? 'schoolPageDescParent' : 'schoolPageDesc')}
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
        {loading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : null}

        {isParent && pickerKids.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, flexDirection: rowDir }, isRTL && { minWidth: '100%' }]}>
            {pickerKids.map(c => {
              const on = c.key === (child?.key ?? hwChild?.key ?? examChild?.key);
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

        <View style={{ gap: SPACE.md }}>
          <View style={{ gap: SPACE.xs }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
              {t('hwTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
              {t(isParent ? 'hwDescParent' : 'hwDescStudent')}
            </Text>
            {untrackedKind !== 'none' ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
                {t(untrackedKind === 'all' ? 'hwParentNoAccount' : 'hwParentNoAccountSome', hwChild?.displayName ?? '')}
              </Text>
            ) : null}
          </View>

          {hwError ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: rowDir },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {hwError}
              </Text>
              <Pressable onPress={() => void loadHomework()} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>
                  {t('retry')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {hwEmpty ? (
            <EmptyState
              icon="book-outline"
              title={t('hwEmptyTitle')}
              body={t(isParent ? 'hwEmptyDescParent' : 'hwEmptyDesc')}
              style={{ paddingTop: 0, paddingHorizontal: 0 }}
            />
          ) : null}

          {hw.sections.map(group => (
            <View key={group.key} style={{ gap: SPACE.sm }}>
              {/* No heading on the flat list shown when nothing is tickable: «المطلوب» would call it actionable. */}
              {group.key === 'all' ? null : (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
                  {t(group.key === 'todo' ? 'hwTodo' : 'hwDone')}
                </Text>
              )}
              {group.items.map(item => (
                <HomeworkRow
                  key={item.id}
                  item={item}
                  isParent={isParent}
                  today={hwToday}
                  saving={hwSaving.has(item.id)}
                  onToggle={() => void toggleDone(hwChild?.key ?? 'self', item)}
                  colors={colors}
                  isRTL={isRTL}
                  t={t}
                />
              ))}
            </View>
          ))}
        </View>

        <View style={{ gap: SPACE.md, marginTop: SPACE.md }}>
          <View style={{ gap: SPACE.xs }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
              {t('upcomingExamsTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
              {t(isParent ? 'upcomingExamsDescParent' : 'upcomingExamsDescStudent')}
            </Text>
          </View>

          {examError ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: rowDir },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {examError}
              </Text>
              <Pressable onPress={() => void loadExams()} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>
                  {t('retry')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {exams !== null && !examError && upcoming.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}>
              {t('upcomingExamsNone')}
            </Text>
          ) : null}

          {upcoming.map(exam => (
            <UpcomingExamRow key={exam.evaluationId} exam={exam} today={hwToday} colors={colors} isRTL={isRTL} lang={lang} t={t} />
          ))}
        </View>

        <View style={{ gap: SPACE.md, marginTop: SPACE.md }}>
          <View style={{ gap: SPACE.xs }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
              {t('schoolScheduleTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
              {t(isParent ? 'schoolScheduleDescParent' : 'schoolScheduleDesc')}
            </Text>
          </View>

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

          {empty ? (
            <EmptyState
              icon="calendar-outline"
              title={t('schoolEmptyTitle')}
              body={t(isParent ? 'schoolEmptyDescParent' : 'schoolEmptyDesc')}
              style={{ paddingTop: 0, paddingHorizontal: 0 }}
            />
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
        </View>

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
      <Celebrate visible={celebrateHw} size="small" message={t('celebrateHomeworkAll')} onDone={() => setCelebrateHw(false)} />
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
      </View>
    </View>
  );
}

function UpcomingExamRow({
  exam, today, colors, isRTL, lang, t,
}: {
  exam: MyExam;
  today: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  // `upcomingExams` only returns rows with a valid day.
  const kind = examDayKind(exam.examDate!, today);
  const dayColor = kind === 'later' ? colors.mutedForeground : palette.warning;
  const dayText = kind === 'today' ? t('examDayToday') : kind === 'tomorrow' ? t('examDayTomorrow') : formatExamWhen(exam.examDate!, null);
  const subject = subjectLabel(exam.subjectId, lang);
  // A state a newer server adds degrades to «مُغلق» rather than a blank.
  const meta = [subject, formatExamTime(exam.examTime), t(MY_EXAM_STATE_KEY[exam.state] ?? 'myExamsStateClosed')]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/my-exams' as never)}
      style={({ pressed }) => [
        styles.examRow,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.hwBadge, { backgroundColor: dayColor + '1A' }]}>
        <Text style={{ color: dayColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{dayText}</Text>
      </View>
      <View style={{ flex: 1, gap: SPACE.xs }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>
          {myExamTitle(exam, lang) || t('myExamsUntitled', subject ?? '')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, textAlign: align }}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

function HomeworkRow({
  item, isParent, today, saving, onToggle, colors, isRTL, t,
}: {
  item: FamilyHomework;
  isParent: boolean;
  today: string;
  saving: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  // Which lines are cut off is not knowable up front, so a row with
  // instructions is simply tappable to show them all.
  const [expanded, setExpanded] = useState(false);
  // Nobody can tick an untracked item (no row of the child in its class has a
  // student account), so "late" would be a claim the system cannot back: the
  // neutral date badge stands in for every kind.
  const untracked = !item.canTrack;
  const badge = untracked ? { kind: 'later' as const, days: 0 } : dueBadge(item.dueDate, today);
  const badgeColor =
    badge.kind === 'overdue' ? colors.destructive : badge.kind === 'today' || badge.kind === 'tomorrow' ? palette.warning : colors.mutedForeground;
  const badgeText =
    badge.kind === 'overdue'
      ? t('hwDueOverdue', Math.abs(badge.days))
      : badge.kind === 'today'
        ? t('hwDueToday')
        : badge.kind === 'tomorrow'
          ? t('hwDueTomorrow')
          : t('hwDueOn', formatDueDate(item.dueDate));
  const done = item.done && !untracked;
  const meta = [item.className, item.teacherName].filter(Boolean).join(' · ');
  const hasInstructions = item.instructions.trim() !== '';

  return (
    <View
      style={[
        styles.hwRow,
        { backgroundColor: colors.card, borderColor: item.state === 'overdue' && !untracked ? colors.destructive + '55' : colors.border, borderRadius: colors.radius, flexDirection: rowDir },
      ]}
    >
      {untracked ? null : isParent ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t(item.done ? 'hwDone' : 'hwTodo')}
          style={styles.hwMark}
        >
          <Ionicons
            name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={item.done ? ACCENT : colors.mutedForeground}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={item.done}
          accessibilityLabel={`${t(item.done ? 'hwMarkUndone' : 'hwMarkDone')}: ${item.title}`}
          aria-busy={saving}
          aria-disabled={saving}
          hitSlop={8}
          onPress={onToggle}
          style={[styles.hwMark, { opacity: saving ? 0.5 : 1 }]}
        >
          <Ionicons
            name={item.done ? 'checkbox' : 'square-outline'}
            size={26}
            color={item.done ? ACCENT : colors.mutedForeground}
          />
        </Pressable>
      )}

      <View style={{ flex: 1, gap: SPACE.xs }}>
        <Pressable
          disabled={!hasInstructions}
          accessibilityRole={hasInstructions ? 'button' : undefined}
          aria-expanded={hasInstructions ? expanded : undefined}
          onPress={() => setExpanded(v => !v)}
          style={{ gap: SPACE.xs }}
        >
          <Text
            style={{
              color: done ? colors.mutedForeground : colors.foreground,
              fontFamily: 'ReadexPro_600SemiBold',
              fontSize: TYPE.body,
              textAlign: align,
              textDecorationLine: done ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </Text>
          {meta ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, textAlign: align }}>
              {meta}
            </Text>
          ) : null}
          <View style={{ flexDirection: rowDir }}>
            {done ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                {t('hwDueOn', formatDueDate(item.dueDate))}
              </Text>
            ) : (
              <View style={[styles.hwBadge, { backgroundColor: badgeColor + '1A' }]}>
                <Text style={{ color: badgeColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{badgeText}</Text>
              </View>
            )}
          </View>
          {hasInstructions ? (
            <Text
              numberOfLines={expanded ? undefined : 3}
              style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}
            >
              {item.instructions}
            </Text>
          ) : null}
        </Pressable>
        {item.examTitle ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push('/my-exams' as never)}
            style={{ paddingVertical: SPACE.xs }}
          >
            <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: align }}>
              {`${t('hwOpenExam')}: ${item.examTitle}`}
            </Text>
          </Pressable>
        ) : null}
        {item.resources.map(r => {
          const isGame = r.kind === 'game';
          const result = isGame ? resultForGame(item.gameResults, r.lessonId, r.game) : null;
          return (
            <View key={resourceKey(r)}>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => openResource(r, { teacher: false, isAr: isRTL, homeworkId: item.id })}
                style={{ flexDirection: rowDir, alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.xs }}
              >
                {isGame ? (
                  <Text style={{ fontSize: TYPE.caption }}>🎮</Text>
                ) : (
                  <Ionicons name="attach-outline" size={16} color={ACCENT} />
                )}
                <Text style={{ flex: 1, color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: align }}>
                  {isGame ? `${t(LESSON_GAME_TITLE_KEY[r.game])}: ${r.title}` : r.title}
                </Text>
              </Pressable>
              {result ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {t(isParent ? 'hwGameChildResult' : 'hwGameYourResult', gameScoreText(result.score, result.total, isRTL))}
                </Text>
              ) : null}
            </View>
          );
        })}
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
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: SPACE.lg, paddingVertical: 8 },
  dayCard: { borderWidth: 1, padding: SPACE.lg },
  todayChip: { borderRadius: 999, paddingHorizontal: SPACE.md, paddingVertical: 2 },
  periodBadge: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  hwRow: { alignItems: 'flex-start', gap: SPACE.md, borderWidth: 1, padding: SPACE.md },
  hwMark: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  hwBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs },
  examRow: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, padding: SPACE.md },
  examsRow: { alignItems: 'center', gap: 12, borderWidth: 1, padding: SPACE.lg, marginTop: 4 },
});

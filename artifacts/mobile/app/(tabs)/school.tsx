// artifacts/mobile/app/(tabs)/school.tsx
/**
 * «المدرسة» — a student's or parent's school page: homework, then the weekly
 * timetable (read-only).
 *
 * The server assembles it from the teachers' own timetables, so it is only as
 * complete as the teachers who have filled theirs in: an empty week is "not
 * entered yet", and the empty state says so rather than looking like a free
 * week. A parent sees one child at a time (a picker appears with more than
 * one); exams and results are one tap away on the existing «اختباراتي» screen.
 *
 * «الواجبات» comes first: a student ticks homework off (optimistically,
 * reverted if the save fails); a parent sees the same list per child,
 * read-only. A child with no student account cannot tick anything, so that
 * child's rows show only the due date — never «متأخّر» or a done mark.
 * Homework and timetable load, fail and refresh independently, each with its
 * own section and error banner, so one failing never reads as the other.
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
import {
  ammanToday,
  applyDone,
  dueBadge,
  formatDueDate,
  splitHomework,
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
import { subjectLabel } from '@/services/myExams';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

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
  const [hwError, setHwError] = useState('');
  // Ids whose save is in flight: the ref is the synchronous guard against a
  // double tap, the state only drives the dimmed look.
  const hwInFlight = useRef<Set<string>>(new Set());
  const [hwSaving, setHwSaving] = useState<ReadonlySet<string>>(new Set());

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

  // On every focus: a teacher may have entered their periods or set homework since last time.
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadHomework();
    }, [load, loadHomework]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadHomework()]);
    setRefreshing(false);
  }, [load, loadHomework]);

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
      const patch = (fn: (items: FamilyHomework[]) => FamilyHomework[]) =>
        setHomework(prev => prev && prev.map(k => (k.key === childKey ? { ...k, homework: fn(k.homework) } : k)));
      patch(items => applyDone(items, item.id, next));
      try {
        await setHomeworkDone(item.id, next);
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
  const pickerKids: readonly { key: string; displayName: string }[] = children ?? homework ?? [];
  const hwChild = homework ? (homework.find(c => c.key === selected) ?? homework[0] ?? null) : null;
  const hwSplit = splitHomework(hwChild?.homework ?? []);
  const hwEmpty = homework !== null && !hwError && hwSplit.todo.length + hwSplit.done.length === 0;
  const hwToday = ammanToday();
  // Only a parent's child can lack an account; a student's own list is always trackable.
  const hwUntracked = isParent && hwChild?.canTrack === false;
  const loading = (children === null && !error) || (homework === null && !hwError);

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
              const on = c.key === (child?.key ?? hwChild?.key);
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
            {hwUntracked ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
                {t('hwParentNoAccount', hwChild?.displayName ?? '')}
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
            <View style={styles.hwEmpty}>
              <View style={[styles.emptyIcon, { backgroundColor: ACCENT + '1F' }]}>
                <Ionicons name="book-outline" size={30} color={ACCENT} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: 'center' }}>
                {t('hwEmptyTitle')}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: 'center' }}>
                {t(isParent ? 'hwEmptyDescParent' : 'hwEmptyDesc')}
              </Text>
            </View>
          ) : null}

          {[
            { key: 'todo', title: 'hwTodo' as const, items: hwSplit.todo },
            { key: 'done', title: 'hwDone' as const, items: hwSplit.done },
          ].map(group =>
            group.items.length > 0 ? (
              <View key={group.key} style={{ gap: SPACE.sm }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
                  {t(group.title)}
                </Text>
                {group.items.map(item => (
                  <HomeworkRow
                    key={item.id}
                    item={item}
                    isParent={isParent}
                    untracked={hwUntracked}
                    today={hwToday}
                    saving={hwSaving.has(item.id)}
                    onToggle={() => void toggleDone(hwChild?.key ?? 'self', item)}
                    colors={colors}
                    isRTL={isRTL}
                    t={t}
                  />
                ))}
              </View>
            ) : null,
          )}
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

function HomeworkRow({
  item, isParent, untracked, today, saving, onToggle, colors, isRTL, t,
}: {
  item: FamilyHomework;
  isParent: boolean;
  /** The child has no student account: show the date only, no status. */
  untracked: boolean;
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
  // Nobody can tick an untracked child's homework, so "late" would be a claim
  // the system cannot back: the neutral date badge stands in for every kind.
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
  hwEmpty: { alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.xl },
  hwRow: { alignItems: 'flex-start', gap: SPACE.md, borderWidth: 1, padding: SPACE.md },
  hwMark: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  hwBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs },
  examsRow: { alignItems: 'center', gap: 12, borderWidth: 1, padding: SPACE.lg, marginTop: 4 },
});

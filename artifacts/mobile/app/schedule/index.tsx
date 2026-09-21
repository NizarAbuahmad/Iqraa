/**
 * A teacher's weekly period timetable — "جدول الحصص": which class meets on
 * which day at which period, and what time each period actually is.
 *
 * Laid out as an actual timetable: day rows × period columns, the day column
 * pinned while the periods scroll sideways on a phone. Periods are set up by
 * the wizard (components/schedule/PeriodsWizard) and edited by tapping a
 * column heading; a cell's class is picked from a dropdown anchored to the
 * cell (SlotPopover) and saved on pick.
 *
 * Distinct from /teaching-plans: a plan is *what curriculum lesson* is
 * covered on a date, for one class; this is *which class* a teacher is in
 * front of at a recurring day+period, every week. See services/schedule.ts.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import {
  ScheduleError,
  deleteSchedulePeriod,
  getSchedule,
  setSchedulePeriod,
  setScheduleSlot,
  type SchedulePeriod,
  type ScheduleSlot,
} from '@/services/schedule';
import { listClasses, type ClassGroup } from '@/services/roster';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';
import { MAX_PERIOD_COUNT, endTime, formatRange, type GeneratedPeriod } from '@/services/schedulePeriods';
import type { Anchor } from '@/components/schedule/Popover';
import { SlotPopover } from '@/components/schedule/SlotPopover';
import { PeriodPopover } from '@/components/schedule/PeriodPopover';
import { PeriodsWizard } from '@/components/schedule/PeriodsWizard';

const ACCENT = '#1B6B62';
/** Same weekday keys teaching-plans/index.tsx and calendar/index.tsx use. */
const WEEKDAY_KEYS = [
  'planWeekdaySun', 'planWeekdayMon', 'planWeekdayTue', 'planWeekdayWed',
  'planWeekdayThu', 'planWeekdayFri', 'planWeekdaySat',
] as const satisfies readonly TranslationKey[];

const ROW_H = 60;
const HEAD_H = 52;

type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const COL_W = isDesktop ? 124 : 104;
  const DAY_W = isDesktop ? 96 : 72;

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [slotEdit, setSlotEdit] = useState<{ dayOfWeek: number; periodNumber: number; anchor: Anchor } | null>(null);
  const [periodEdit, setPeriodEdit] = useState<{
    periodNumber: number; isNew: boolean; initialStart: string; initialDuration: number; anchor: Anchor;
  } | null>(null);
  const cellRefs = useRef(new Map<string, Measurable | null>());
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getSchedule();
      setPeriods(data.periods);
      setSlots(data.slots);
    } catch (err) {
      setError(
        err instanceof ScheduleError && err.isStorageUnavailable
          ? t('scheduleStorageUnavailable')
          : t('scheduleLoadFailed'),
      );
    } finally {
      setLoading(false);
    }
    // Best-effort, same as the other schedule screens: class names and
    // colours label filled cells, they are not what the grid depends on.
    try {
      setClasses(await listClasses());
    } catch {
      /* cells still work by id; the label just won't resolve */
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sortedPeriods = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const slotAt = (dayOfWeek: number, periodNumber: number) =>
    slots.find(s => s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber);
  const classById = (id: string | null | undefined) => (id ? classes.find(c => c.id === id) : undefined);

  // Class labelling: a cell is coloured by its class's subject — the same
  // `color` the curriculum browser uses for that subject — so one class
  // reads as one colour across the week.
  const nameOf = (c: ClassGroup) => (lang === 'ar' && c.nameAr ? c.nameAr : c.name);
  const subjectOf = (c: ClassGroup) => SUBJECTS.find(s => s.id === c.subjectId);
  const gradeOf = (c: ClassGroup) => GRADES.find(g => g.id === c.gradeId);
  const colorOf = (c: ClassGroup) => subjectOf(c)?.color ?? ACCENT;
  const subjectName = (c: ClassGroup) => {
    const s = subjectOf(c);
    return s ? (lang === 'ar' ? s.nameAr : s.name) : '';
  };
  const captionOf = (c: ClassGroup) => {
    const g = gradeOf(c);
    return [g ? (lang === 'ar' ? g.nameAr : g.name) : '', subjectName(c)].filter(Boolean).join(' · ');
  };

  const fail = (msg: string) => {
    setError(msg);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  /** Save one cell. Optimistic: the grid updates on pick; a failed save puts the old value back and says so. */
  const saveSlot = async (dayOfWeek: number, periodNumber: number, patch: { classGroupId?: string | null; notes?: string }) => {
    const before = slots;
    const existing = slotAt(dayOfWeek, periodNumber);
    const optimistic: ScheduleSlot = {
      id: existing?.id ?? '',
      dayOfWeek,
      periodNumber,
      classGroupId: patch.classGroupId !== undefined ? patch.classGroupId : existing?.classGroupId ?? null,
      notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? '',
    };
    setSlots(prev => [...prev.filter(s => !(s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber)), optimistic]);
    setError('');
    try {
      const saved = await setScheduleSlot(dayOfWeek, periodNumber, patch);
      setSlots(prev => [...prev.filter(s => !(s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber)), saved]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSlots(before);
      fail(t('scheduleSaveFailed'));
    }
  };

  const savePeriod = async (periodNumber: number, input: { startTime: string; durationMinutes: number }) => {
    setError('');
    try {
      const saved = await setSchedulePeriod(periodNumber, input);
      setPeriods(prev => [...prev.filter(p => p.periodNumber !== periodNumber), saved]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      fail(t('scheduleSaveFailed'));
    }
  };

  const removePeriod = async (periodNumber: number) => {
    const ok = await confirm({
      title: t('remove'),
      message: t('scheduleDeletePeriodConfirm', periodNumber),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setError('');
    try {
      await deleteSchedulePeriod(periodNumber);
      setPeriods(prev => prev.filter(p => p.periodNumber !== periodNumber));
    } catch {
      fail(t('scheduleSaveFailed'));
    }
  };

  /**
   * The wizard's output replaces the whole set: upsert each generated period
   * (the API is per-period; ≤ 12 calls, idempotent), then drop any period
   * numbered past the new count. Slots keep their period numbers — a class
   * in الحصة 3 is still in الحصة 3, just at the new time.
   */
  const applyWizard = async (generated: GeneratedPeriod[]) => {
    if (generated.length === 0) return;
    if (sortedPeriods.length > 0) {
      const ok = await confirm({
        title: t('scheduleApply'),
        message: t('scheduleReplaceConfirm'),
        confirmLabel: t('scheduleApply'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setApplying(true);
    setError('');
    try {
      const saved: SchedulePeriod[] = [];
      for (const p of generated) {
        saved.push(await setSchedulePeriod(p.periodNumber, { startTime: p.startTime, durationMinutes: p.durationMinutes }));
      }
      for (const p of sortedPeriods.filter(x => x.periodNumber > generated.length)) {
        await deleteSchedulePeriod(p.periodNumber);
      }
      setPeriods(saved);
      setWizardOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      fail(t('scheduleSaveFailed'));
      void load(); // whatever partially landed is the truth now; show it
    } finally {
      setApplying(false);
    }
  };

  const measure = (key: string, cb: (anchor: Anchor) => void) => {
    const el = cellRefs.current.get(key);
    if (!el) return;
    el.measureInWindow((x, y, width, height) => cb({ x, y, width, height }));
  };
  const openSlot = (dayOfWeek: number, periodNumber: number) =>
    measure(`s:${dayOfWeek}:${periodNumber}`, anchor => setSlotEdit({ dayOfWeek, periodNumber, anchor }));
  const openPeriod = (period: SchedulePeriod) =>
    measure(`p:${period.periodNumber}`, anchor =>
      setPeriodEdit({ periodNumber: period.periodNumber, isNew: false, initialStart: period.startTime, initialDuration: period.durationMinutes, anchor }),
    );
  const openNewPeriod = () => {
    const last = sortedPeriods.at(-1);
    measure('p:new', anchor =>
      setPeriodEdit({
        periodNumber: (last?.periodNumber ?? 0) + 1,
        isNew: true,
        initialStart: last ? endTime(last) || last.startTime : '08:00',
        initialDuration: last?.durationMinutes ?? 45,
        anchor,
      }),
    );
  };
  const setRef = (key: string) => (el: Measurable | null) => {
    cellRefs.current.set(key, el);
  };

  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const canAddPeriod = sortedPeriods.length < MAX_PERIOD_COUNT;

  const dayLabel = (key: TranslationKey) => (
    <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13, textAlign: align }}>{t(key)}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          {sortedPeriods.length > 0 ? (
            <Pressable onPress={() => setWizardOpen(true)} hitSlop={12} accessibilityLabel={t('schedulePeriodsTitle')}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('myWeeklySchedule')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                {error}
              </Text>
            </View>
          ) : null}

          {sortedPeriods.length === 0 ? (
            // First run: the wizard is the screen, not a button to a modal.
            <View style={[styles.wizardCard, { backgroundColor: colors.card, borderColor: colors.border, alignSelf: 'center' }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: align }}>
                {t('schedulePeriodsTitle')}
              </Text>
              <PeriodsWizard isRTL={isRTL} colors={colors} t={t} busy={applying} onApply={p => { void applyWizard(p); }} />
            </View>
          ) : (
            <View style={{ flexDirection: rowDir, alignItems: 'flex-start', width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
              {/* Pinned day column: corner cell + one row header per weekday,
                  sharing the grid's row heights so rows line up with the
                  scrolling half. */}
              <View style={{ width: DAY_W }}>
                <View style={{ height: HEAD_H }} />
                {WEEKDAY_KEYS.map((key, dayOfWeek) => (
                  <View key={dayOfWeek} style={{ height: ROW_H, justifyContent: 'center', paddingHorizontal: 6 }}>
                    {dayLabel(key)}
                  </View>
                ))}
              </View>

              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator
                style={{ flex: 1, minWidth: 0 }}
                // A horizontal ScrollView opens at its content's start — the
                // left — so in RTL the first period would begin off-screen.
                onContentSizeChange={() => { if (isRTL) scrollRef.current?.scrollToEnd({ animated: false }); }}
              >
                <View>
                  {/* Period headings */}
                  <View style={{ flexDirection: rowDir, height: HEAD_H }}>
                    {sortedPeriods.map(p => (
                      <Pressable
                        key={p.periodNumber}
                        ref={setRef(`p:${p.periodNumber}`) as never}
                        onPress={() => openPeriod(p)}
                        style={{ width: COL_W, height: HEAD_H, padding: 4 }}
                      >
                        <View style={{ flex: 1, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>
                            {t('schedulePeriodNumber', p.periodNumber)}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5 }}>
                            {formatRange(p)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                    {canAddPeriod ? (
                      <Pressable ref={setRef('p:new') as never} onPress={openNewPeriod} style={{ width: COL_W, height: HEAD_H, padding: 4 }}>
                        <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: rowDir, gap: 4 }}>
                          <Ionicons name="add" size={14} color={colors.mutedForeground} />
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>{t('scheduleAddPeriod')}</Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* One row per weekday */}
                  {WEEKDAY_KEYS.map((_, dayOfWeek) => (
                    <View key={dayOfWeek} style={{ flexDirection: rowDir, height: ROW_H }}>
                      {sortedPeriods.map(p => {
                        const slot = slotAt(dayOfWeek, p.periodNumber);
                        const cls = classById(slot?.classGroupId);
                        const color = cls ? colorOf(cls) : null;
                        return (
                          <Pressable
                            key={p.periodNumber}
                            ref={setRef(`s:${dayOfWeek}:${p.periodNumber}`) as never}
                            onPress={() => openSlot(dayOfWeek, p.periodNumber)}
                            style={{ width: COL_W, height: ROW_H, padding: 4 }}
                          >
                            <View
                              style={{
                                flex: 1, borderRadius: 10, paddingHorizontal: 8, justifyContent: 'center',
                                borderWidth: cls ? 0 : 1, borderStyle: cls ? 'solid' : 'dashed', borderColor: colors.border,
                                backgroundColor: color ? `${color}24` : 'transparent',
                                ...(color ? (isRTL ? { borderRightWidth: 3, borderRightColor: color } : { borderLeftWidth: 3, borderLeftColor: color }) : {}),
                              }}
                            >
                              {cls ? (
                                <>
                                  <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, textAlign: align }}>
                                    {nameOf(cls)}
                                  </Text>
                                  <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 4 }}>
                                    <Text numberOfLines={1} style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5, textAlign: align }}>
                                      {subjectName(cls)}
                                    </Text>
                                    {slot?.notes ? <Ionicons name="document-text-outline" size={11} color={colors.mutedForeground} /> : null}
                                  </View>
                                </>
                              ) : (
                                <View style={{ flexDirection: rowDir, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                  <Ionicons name="add" size={16} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
                                  {slot?.notes ? <Ionicons name="document-text-outline" size={11} color={colors.mutedForeground} /> : null}
                                </View>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                      {canAddPeriod ? <View style={{ width: COL_W }} /> : null}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* Re-run the wizard from the gear icon. Same form as the empty state, in a dialog. */}
      <Modal visible={wizardOpen} transparent animationType="fade" onRequestClose={() => setWizardOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 18, textAlign: align }}>
              {t('schedulePeriodsTitle')}
            </Text>
            <PeriodsWizard isRTL={isRTL} colors={colors} t={t} busy={applying} onApply={p => { void applyWizard(p); }} onCancel={() => setWizardOpen(false)} />
          </View>
        </View>
      </Modal>

      {slotEdit ? (
        <SlotPopover
          anchor={slotEdit.anchor}
          isDesktop={isDesktop}
          isRTL={isRTL}
          colors={colors}
          t={t}
          classes={classes}
          current={slotAt(slotEdit.dayOfWeek, slotEdit.periodNumber) ?? null}
          title={t('scheduleSlotTitle', t(WEEKDAY_KEYS[slotEdit.dayOfWeek]!), slotEdit.periodNumber)}
          nameOf={nameOf}
          captionOf={captionOf}
          colorOf={colorOf}
          onPick={classGroupId => {
            const { dayOfWeek, periodNumber } = slotEdit;
            setSlotEdit(null);
            void saveSlot(dayOfWeek, periodNumber, { classGroupId });
          }}
          onNote={notes => { void saveSlot(slotEdit.dayOfWeek, slotEdit.periodNumber, { notes }); }}
          onClose={() => setSlotEdit(null)}
        />
      ) : null}

      {periodEdit ? (
        <PeriodPopover
          anchor={periodEdit.anchor}
          isDesktop={isDesktop}
          isRTL={isRTL}
          colors={colors}
          t={t}
          periodNumber={periodEdit.periodNumber}
          initialStart={periodEdit.initialStart}
          initialDuration={periodEdit.initialDuration}
          isNew={periodEdit.isNew}
          onSave={input => {
            const n = periodEdit.periodNumber;
            setPeriodEdit(null);
            void savePeriod(n, input);
          }}
          onDelete={() => {
            const n = periodEdit.periodNumber;
            setPeriodEdit(null);
            void removePeriod(n);
          }}
          onClose={() => setPeriodEdit(null)}
        />
      ) : null}
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
  wizardCard: { width: '100%', maxWidth: 560, borderRadius: 16, borderWidth: 1, padding: 20, gap: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 560, borderRadius: 16, padding: 20, gap: 14 },
});

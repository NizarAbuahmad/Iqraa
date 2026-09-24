/**
 * A teacher's weekly period timetable — "جدول الحصص": which class meets on
 * which day at which period, and what time each period actually is.
 *
 * Distinct from /teaching-plans: a plan is *what curriculum lesson* is
 * covered on a date, for one class; this is *which class* a teacher is in
 * front of at a recurring day+period, every week, regardless of which lesson
 * that class happens to be on. See services/schedule.ts.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
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
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Same weekday keys teaching-plans/index.tsx uses — a fixed enumeration, not screen-specific. */
const WEEKDAY_KEYS = [
  'planWeekdaySun', 'planWeekdayMon', 'planWeekdayTue', 'planWeekdayWed',
  'planWeekdayThu', 'planWeekdayFri', 'planWeekdaySat',
] as const satisfies readonly TranslationKey[];

type T = (key: TranslationKey, ...args: any[]) => string;

/** One period's time+duration editor, inline. The always-present blank row
 *  at the bottom (`isNew`) is how a period gets added — no separate "add"
 *  flow, just fill it in and confirm. */
function PeriodRow({ period, isNew, onSave, onDelete, isRTL, colors, t }: {
  period: SchedulePeriod | { periodNumber: number; startTime: string; durationMinutes: number };
  isNew?: boolean;
  onSave: (periodNumber: number, input: { startTime: string; durationMinutes: number }) => void;
  onDelete: (periodNumber: number) => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: T;
}) {
  const [time, setTime] = useState(period.startTime);
  const [duration, setDuration] = useState(String(period.durationMinutes));

  const validTime = TIME_RE.test(time);
  const durationNum = Number(duration);
  const validDuration = /^\d{1,3}$/.test(duration) && durationNum >= 1 && durationNum <= 480;
  const dirty = time !== period.startTime || duration !== String(period.durationMinutes);
  const canSave = validTime && validDuration && (isNew || dirty);

  return (
    <View style={{ gap: 6, paddingBottom: 10, borderBottomWidth: isNew ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
        {t('schedulePeriodNumber', period.periodNumber)}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="HH:MM"
          placeholderTextColor={colors.mutedForeground}
          maxLength={5}
          style={{
            width: 76, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1.5,
            borderColor: colors.border, color: colors.foreground, fontFamily: 'Almarai_400Regular',
            fontSize: 13, textAlign: 'center',
          }}
        />
        <TextInput
          value={duration}
          onChangeText={v => (v === '' || /^\d{1,3}$/.test(v)) && setDuration(v)}
          placeholder={t('scheduleDuration')}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={3}
          style={{
            width: 60, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1.5,
            borderColor: colors.border, color: colors.foreground, fontFamily: 'Almarai_400Regular',
            fontSize: 13, textAlign: 'center',
          }}
        />
        <Pressable
          onPress={() => onSave(period.periodNumber, { startTime: time, durationMinutes: durationNum })}
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.35, padding: 8, borderRadius: 8, backgroundColor: ACCENT_FILL }}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
        </Pressable>
        {!isNew ? (
          <Pressable onPress={() => onDelete(period.periodNumber)} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PeriodsEditorModal({ visible, periods, onClose, onSave, onDelete, isRTL, colors, t }: {
  visible: boolean;
  periods: SchedulePeriod[];
  onClose: () => void;
  onSave: (periodNumber: number, input: { startTime: string; durationMinutes: number }) => void;
  onDelete: (periodNumber: number) => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: T;
}) {
  const align = isRTL ? 'right' : 'left';
  const nextNumber = (periods.at(-1)?.periodNumber ?? 0) + 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('schedulePeriodsTitle')}
          </Text>
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
            {periods.map(period => (
              <PeriodRow key={period.periodNumber} period={period} onSave={onSave} onDelete={onDelete} isRTL={isRTL} colors={colors} t={t} />
            ))}
            {/* Keyed by nextNumber, which changes the moment a save grows the
                list — React unmounts this instance and mounts a fresh one for
                the new next number, which is what resets its draft text
                without any explicit reset code. */}
            <PeriodRow
              key={`new-${nextNumber}`}
              period={{ periodNumber: nextNumber, startTime: '', durationMinutes: 45 }}
              isNew
              onSave={onSave}
              onDelete={onDelete}
              isRTL={isRTL}
              colors={colors}
              t={t}
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SlotEditorModal({ dayLabel, periodNumber, classes, current, onClose, onSave, isRTL, lang, colors, t }: {
  dayLabel: string;
  periodNumber: number;
  classes: ClassGroup[];
  current: ScheduleSlot | null;
  onClose: () => void;
  onSave: (patch: { classGroupId: string | null; notes: string }) => void;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useColors>;
  t: T;
}) {
  const [selected, setSelected] = useState<string | null>(current?.classGroupId ?? null);
  const [notes, setNotes] = useState(current?.notes ?? '');
  const align = isRTL ? 'right' : 'left';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('scheduleSlotTitle', dayLabel, periodNumber)}
          </Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 12 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
              {[{ id: null as string | null, name: t('planNoClass'), nameAr: t('planNoClass') }, ...classes].map(c => {
                const active = selected === c.id;
                const label = lang === 'ar' && c.nameAr ? c.nameAr : c.name;
                return (
                  <Pressable
                    key={c.id ?? '__none'}
                    onPress={() => setSelected(c.id)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5,
                      borderColor: active ? ACCENT : colors.border,
                      backgroundColor: active ? ACCENT + '16' : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? ACCENT : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular', fontSize: 13 }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('scheduleSlotNotesPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{
                borderWidth: 1, borderRadius: 10, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, minHeight: 64, textAlignVertical: 'top', color: colors.foreground,
                fontFamily: 'Almarai_400Regular', textAlign: align,
              }}
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave({ classGroupId: selected, notes })}
              style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: ACCENT_FILL }]}
            >
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>{t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPeriodsEditor, setShowPeriodsEditor] = useState(false);
  const [editingCell, setEditingCell] = useState<{ dayOfWeek: number; periodNumber: number } | null>(null);

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
    // Best-effort, same as teaching-plans: class names are a convenience for
    // labelling filled slots, not the point of this screen.
    try {
      setClasses(await listClasses());
    } catch {
      /* slots still work by id; the label just won't resolve */
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
  const classNameFor = (id: string | null): string => {
    if (!id) return '';
    const found = classes.find(c => c.id === id);
    return found ? (lang === 'ar' && found.nameAr ? found.nameAr : found.name) : '';
  };

  const onSavePeriod = async (periodNumber: number, input: { startTime: string; durationMinutes: number }) => {
    try {
      const saved = await setSchedulePeriod(periodNumber, input);
      setPeriods(prev => [...prev.filter(p => p.periodNumber !== periodNumber), saved]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t('scheduleSaveFailed'));
    }
  };

  const onDeletePeriod = async (periodNumber: number) => {
    const ok = await confirm({
      title: t('remove'),
      message: t('scheduleDeletePeriodConfirm', periodNumber),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSchedulePeriod(periodNumber);
      setPeriods(prev => prev.filter(p => p.periodNumber !== periodNumber));
    } catch {
      setError(t('scheduleSaveFailed'));
    }
  };

  const onSaveSlot = async (dayOfWeek: number, periodNumber: number, patch: { classGroupId: string | null; notes: string }) => {
    try {
      const saved = await setScheduleSlot(dayOfWeek, periodNumber, patch);
      setSlots(prev => [...prev.filter(s => !(s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber)), saved]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingCell(null);
    } catch {
      setError(t('scheduleSaveFailed'));
    }
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => goBack()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setShowPeriodsEditor(true)} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}>
          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                {error}
              </Text>
            </View>
          ) : null}

          {sortedPeriods.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={40} color={colors.mutedForeground} />
              <Text
                style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 280 }}
              >
                {t('scheduleEmptyPeriods')}
              </Text>
              <Pressable
                onPress={() => setShowPeriodsEditor(true)}
                style={{ marginTop: 4, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: ACCENT_FILL }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13.5 }}>
                  {t('scheduleSetupPeriods')}
                </Text>
              </Pressable>
            </View>
          ) : (
            WEEKDAY_KEYS.map((dayKey, dayOfWeek) => (
              <View key={dayOfWeek} style={{ gap: 8 }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
                  {t(dayKey)}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}
                >
                  {sortedPeriods.map(period => {
                    const slot = slotAt(dayOfWeek, period.periodNumber);
                    const className = classNameFor(slot?.classGroupId ?? null);
                    const filled = Boolean(className);
                    return (
                      <Pressable
                        key={period.periodNumber}
                        onPress={() => setEditingCell({ dayOfWeek, periodNumber: period.periodNumber })}
                        style={{
                          width: 108, padding: 10, borderRadius: 12, borderWidth: 1.5, gap: 3,
                          borderColor: filled ? ACCENT : colors.border,
                          backgroundColor: filled ? ACCENT + '12' : colors.card,
                        }}
                      >
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5, lineHeight: 17, textAlign: align }}>
                          {`${t('schedulePeriodNumber', period.periodNumber)} · ${period.startTime}`}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: filled ? ACCENT : colors.mutedForeground,
                            fontFamily: filled ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                            fontSize: 12.5, textAlign: align,
                          }}
                        >
                          {filled ? className : '+'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <PeriodsEditorModal
        visible={showPeriodsEditor}
        periods={sortedPeriods}
        onClose={() => setShowPeriodsEditor(false)}
        onSave={onSavePeriod}
        onDelete={onDeletePeriod}
        isRTL={isRTL}
        colors={colors}
        t={t}
      />

      {editingCell ? (
        <SlotEditorModal
          dayLabel={t(WEEKDAY_KEYS[editingCell.dayOfWeek]!)}
          periodNumber={editingCell.periodNumber}
          classes={classes}
          current={slotAt(editingCell.dayOfWeek, editingCell.periodNumber) ?? null}
          onClose={() => setEditingCell(null)}
          onSave={patch => { void onSaveSlot(editingCell.dayOfWeek, editingCell.periodNumber, patch); }}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          t={t}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  heroTitle: { fontSize: 26, color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20, gap: 14 },
  modalTitle: { fontSize: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 90, alignItems: 'center' },
});

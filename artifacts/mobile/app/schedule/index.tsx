/**
 * A teacher's weekly period timetable — "جدول الحصص": which class meets on
 * which day at which period, and what time each period actually is.
 *
 * Distinct from /teaching-plans: a plan is *what curriculum lesson* is
 * covered on a date, for one class; this is *which class* a teacher is in
 * front of at a recurring day+period, every week, regardless of which lesson
 * that class happens to be on. See services/schedule.ts.
 *
 * Three views of the same data. الجدول (days × periods) and البطاقات show one
 * school at a time, because each school has its own bell times and their
 * period rows do not line up. اليوم merges every school into one clock-ordered
 * list — "where am I today" does not care which bell schedule a period is on.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useLanguage } from '@/context/LanguageContext';
import {
  ScheduleError,
  deleteSchedulePeriod,
  getSchedule,
  renameScheduleSchool,
  setSchedulePeriod,
  setScheduleSlot,
  type SchedulePeriod,
  type ScheduleSlot,
} from '@/services/schedule';
import {
  dayRows,
  defaultDay,
  endTime,
  isHappeningNow,
  schoolsOf,
  visibleWeekdays,
} from '@/services/scheduleCalendar';
import { listClasses, type ClassGroup } from '@/services/roster';
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VIEW_KEY = 'schedule.view';
/** Below this the timetable's five day columns no longer fit, so the day list is the better default. */
const WIDE_MIN = 760;

/** Same weekday keys teaching-plans/index.tsx uses — a fixed enumeration, not screen-specific. */
const WEEKDAY_KEYS = [
  'planWeekdaySun', 'planWeekdayMon', 'planWeekdayTue', 'planWeekdayWed',
  'planWeekdayThu', 'planWeekdayFri', 'planWeekdaySat',
] as const satisfies readonly TranslationKey[];

type T = (key: TranslationKey, ...args: any[]) => string;
type Colors = ReturnType<typeof useColors>;
type ViewMode = 'table' | 'day' | 'cards';
type Cell = { schoolName: string; dayOfWeek: number; periodNumber: number };

const VIEW_MODES: { mode: ViewMode; label: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'table', label: 'scheduleViewTable', icon: 'grid-outline' },
  { mode: 'day', label: 'scheduleViewDay', icon: 'list-outline' },
  { mode: 'cards', label: 'scheduleViewCards', icon: 'albums-outline' },
];

/** Mirrors the API's parseSchoolName, so a local comparison agrees with the unique key. */
const normalizeSchool = (s: string) => s.trim().replace(/\s+/g, ' ');

function Chip({ label, active, onPress, icon, colors }: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  colors: Colors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5,
        borderColor: active ? ACCENT : colors.border,
        backgroundColor: active ? ACCENT + '16' : colors.card,
      }}
    >
      {icon ? <Ionicons name={icon} size={15} color={active ? ACCENT : colors.mutedForeground} /> : null}
      <Text style={{ color: active ? ACCENT : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One period's time+duration editor, inline. The always-present blank row
 *  at the bottom (`isNew`) is how a period gets added — no separate "add"
 *  flow, just fill it in and confirm. */
function PeriodRow({ period, isNew, onSave, onDelete, isRTL, colors, t }: {
  period: { periodNumber: number; startTime: string; durationMinutes: number };
  isNew?: boolean;
  onSave: (periodNumber: number, input: { startTime: string; durationMinutes: number }) => void;
  onDelete: (periodNumber: number) => void;
  isRTL: boolean;
  colors: Colors;
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
          style={[styles.smallInput, { width: 76, borderColor: colors.border, color: colors.foreground }]}
        />
        <TextInput
          value={duration}
          onChangeText={v => (v === '' || /^\d{1,3}$/.test(v)) && setDuration(v)}
          placeholder={t('scheduleDuration')}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          maxLength={3}
          style={[styles.smallInput, { width: 60, borderColor: colors.border, color: colors.foreground }]}
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

function PeriodsEditorModal({ visible, schoolName, periods, onClose, onSave, onDelete, onRename, isRTL, colors, t }: {
  visible: boolean;
  schoolName: string;
  periods: SchedulePeriod[];
  onClose: () => void;
  onSave: (periodNumber: number, input: { startTime: string; durationMinutes: number }) => void;
  onDelete: (periodNumber: number) => void;
  /** Resolves to an error message, or '' on success. */
  onRename: (to: string) => Promise<string>;
  isRTL: boolean;
  colors: Colors;
  t: T;
}) {
  const align = isRTL ? 'right' : 'left';
  const nextNumber = (periods.at(-1)?.periodNumber ?? 0) + 1;
  const [name, setName] = useState(schoolName);
  const [renameError, setRenameError] = useState('');
  useEffect(() => {
    setName(schoolName);
    setRenameError('');
  }, [schoolName, visible]);
  const nameDirty = normalizeSchool(name) !== schoolName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('schedulePeriodsTitle')}
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
              {t('scheduleSchoolLabel')}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                value={name}
                onChangeText={v => { setName(v); setRenameError(''); }}
                placeholder={t('scheduleSchoolPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                maxLength={80}
                style={[styles.smallInput, { flex: 1, borderColor: colors.border, color: colors.foreground, textAlign: align }]}
              />
              {nameDirty ? (
                <Pressable
                  onPress={async () => setRenameError(await onRename(normalizeSchool(name)))}
                  style={{ padding: 8, borderRadius: 8, backgroundColor: ACCENT_FILL }}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: renameError ? colors.destructive : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align }}>
              {renameError || t('scheduleSchoolHint')}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 10 }}>
            {periods.map(period => (
              <PeriodRow key={period.periodNumber} period={period} onSave={onSave} onDelete={onDelete} isRTL={isRTL} colors={colors} t={t} />
            ))}
            {/* Keyed by nextNumber, which changes the moment a save grows the
                list — React unmounts this instance and mounts a fresh one for
                the new next number, which is what resets its draft text
                without any explicit reset code. */}
            <PeriodRow
              key={`new-${schoolName}-${nextNumber}`}
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

function AddSchoolModal({ existing, onClose, onAdd, isRTL, colors, t }: {
  existing: string[];
  onClose: () => void;
  onAdd: (name: string) => void;
  isRTL: boolean;
  colors: Colors;
  t: T;
}) {
  const [name, setName] = useState('');
  const align = isRTL ? 'right' : 'left';
  const clean = normalizeSchool(name);
  const taken = existing.includes(clean);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('scheduleNewSchoolTitle')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder={t('scheduleSchoolPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            maxLength={80}
            style={[styles.smallInput, { borderColor: colors.border, color: colors.foreground, textAlign: align, paddingVertical: 10 }]}
          />
          <Text style={{ color: taken ? colors.destructive : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align }}>
            {taken ? t('scheduleSchoolNameTaken') : t('scheduleSchoolHint')}
          </Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onAdd(clean)}
              disabled={!clean || taken}
              style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: ACCENT_FILL, opacity: !clean || taken ? 0.4 : 1 }]}
            >
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>{t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SlotEditorModal({ title, classes, current, onClose, onSave, isRTL, lang, colors, t }: {
  title: string;
  classes: ClassGroup[];
  current: ScheduleSlot | null;
  onClose: () => void;
  onSave: (patch: { classGroupId: string | null; notes: string }) => void;
  isRTL: boolean;
  lang: string;
  colors: Colors;
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
            {title}
          </Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 12 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
              {[{ id: null as string | null, name: t('planNoClass'), nameAr: t('planNoClass') }, ...classes].map(c => (
                <Chip
                  key={c.id ?? '__none'}
                  label={lang === 'ar' && c.nameAr ? c.nameAr : c.name}
                  active={selected === c.id}
                  onPress={() => setSelected(c.id)}
                  colors={colors}
                />
              ))}
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

/**
 * A horizontal scroller that starts at the reading edge. The app lays out RTL
 * by hand (row-reverse) rather than through I18nManager, so the scroll origin
 * is still the left edge — without this an Arabic row that overflows opens on
 * its *last* column.
 */
function EdgeScroll({ isRTL, children }: { isRTL: boolean; children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 1 }}
      onContentSizeChange={() => { if (isRTL) ref.current?.scrollToEnd({ animated: false }); }}
    >
      {children}
    </ScrollView>
  );
}

function SlotContent({ className, notes, compact, colors }: {
  className: string;
  notes: string;
  compact?: boolean;
  colors: Colors;
}) {
  if (!className) {
    return <Ionicons name="add-circle-outline" size={compact ? 18 : 22} color={colors.mutedForeground} style={{ opacity: 0.45 }} />;
  }
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text numberOfLines={2} style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, textAlign: 'center' }}>
        {className}
      </Text>
      {notes ? (
        <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5, textAlign: 'center' }}>
          {notes}
        </Text>
      ) : null}
    </View>
  );
}

function TableView({ periods, weekdays, today, slotAt, classNameFor, onCell, isRTL, colors, t }: {
  periods: SchedulePeriod[];
  weekdays: number[];
  today: number;
  slotAt: (day: number, period: number) => ScheduleSlot | undefined;
  classNameFor: (id: string | null) => string;
  onCell: (day: number, period: number) => void;
  isRTL: boolean;
  colors: Colors;
  t: T;
}) {
  const row = isRTL ? 'row-reverse' : 'row';
  const cellBorder = { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth };

  return (
    <EdgeScroll isRTL={isRTL}>
      <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        <View style={{ flexDirection: row, backgroundColor: colors.muted }}>
          <View style={[styles.periodCol, cellBorder]} />
          {weekdays.map(d => (
            <View key={d} style={[styles.dayCol, cellBorder, { paddingVertical: 10, alignItems: 'center' }]}>
              <Text style={{ color: d === today ? ACCENT : colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 13.5 }}>
                {t(WEEKDAY_KEYS[d]!)}
              </Text>
              {d === today ? <View style={{ marginTop: 3, width: 18, height: 3, borderRadius: 2, backgroundColor: ACCENT }} /> : null}
            </View>
          ))}
        </View>
        {periods.map(p => (
          <View key={p.periodNumber} style={{ flexDirection: row }}>
            <View style={[styles.periodCol, cellBorder, { justifyContent: 'center', alignItems: 'center', gap: 2, backgroundColor: colors.muted }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>
                {t('schedulePeriodNumber', p.periodNumber)}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5 }}>
                {`${p.startTime}–${endTime(p.startTime, p.durationMinutes)}`}
              </Text>
            </View>
            {weekdays.map(d => {
              const slot = slotAt(d, p.periodNumber);
              const className = classNameFor(slot?.classGroupId ?? null);
              return (
                <Pressable
                  key={d}
                  onPress={() => onCell(d, p.periodNumber)}
                  style={[
                    styles.dayCol,
                    cellBorder,
                    {
                      minHeight: 64, padding: 8, justifyContent: 'center', alignItems: 'center',
                      backgroundColor: className ? ACCENT + '12' : colors.card,
                    },
                  ]}
                >
                  <SlotContent className={className} notes={slot?.notes ?? ''} compact colors={colors} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </EdgeScroll>
  );
}

function DayView({ day, setDay, weekdays, today, periods, slots, classNameFor, multiSchool, schoolLabel, onRow, isRTL, colors, t }: {
  day: number;
  setDay: (d: number) => void;
  weekdays: number[];
  today: number;
  periods: SchedulePeriod[];
  slots: ScheduleSlot[];
  classNameFor: (id: string | null) => string;
  multiSchool: boolean;
  schoolLabel: (name: string) => string;
  onRow: (cell: Cell) => void;
  isRTL: boolean;
  colors: Colors;
  t: T;
}) {
  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const rows = dayRows(day, periods, slots);
  const now = new Date();

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
        {weekdays.map(d => (
          <Chip
            key={d}
            label={d === today ? `${t(WEEKDAY_KEYS[d]!)} · ${t('scheduleToday')}` : t(WEEKDAY_KEYS[d]!)}
            active={d === day}
            onPress={() => setDay(d)}
            colors={colors}
          />
        ))}
      </View>
      <View style={{ gap: 8 }}>
        {rows.map(r => {
          const className = classNameFor(r.classGroupId);
          const live = day === today && isHappeningNow(r.startTime, r.durationMinutes, now);
          return (
            <Pressable
              key={`${r.schoolName}|${r.periodNumber}`}
              onPress={() => onRow({ schoolName: r.schoolName, dayOfWeek: day, periodNumber: r.periodNumber })}
              style={{
                flexDirection: row, alignItems: 'stretch', gap: 12, padding: 12, borderRadius: 14,
                borderWidth: live ? 2 : 1,
                borderColor: live ? ACCENT : colors.border,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ width: 54, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 14 }}>{r.startTime}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>
                  {endTime(r.startTime, r.durationMinutes)}
                </Text>
              </View>
              <View style={{ width: 3, borderRadius: 2, backgroundColor: className ? ACCENT : colors.border }} />
              <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: className ? colors.foreground : colors.mutedForeground, fontFamily: className ? 'Cairo_700Bold' : 'Almarai_400Regular', fontSize: 15, textAlign: align }}>
                    {className || t('scheduleFreePeriod')}
                  </Text>
                  {live ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: ACCENT_FILL }}>
                      <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>{t('scheduleNow')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                  {[
                    t('schedulePeriodNumber', r.periodNumber),
                    multiSchool ? schoolLabel(r.schoolName) : '',
                    className ? '' : t('scheduleTapToAssign'),
                  ].filter(Boolean).join(' · ')}
                </Text>
                {r.notes ? (
                  <View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
                    <Ionicons name="document-text-outline" size={13} color={colors.mutedForeground} />
                    <Text numberOfLines={2} style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                      {r.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CardsView({ periods, weekdays, today, slotAt, classNameFor, onCell, isRTL, colors, t }: {
  periods: SchedulePeriod[];
  weekdays: number[];
  today: number;
  slotAt: (day: number, period: number) => ScheduleSlot | undefined;
  classNameFor: (id: string | null) => string;
  onCell: (day: number, period: number) => void;
  isRTL: boolean;
  colors: Colors;
  t: T;
}) {
  const row = isRTL ? 'row-reverse' : 'row';
  return (
    <View style={{ gap: 18 }}>
      {weekdays.map(d => (
        <View key={d} style={{ gap: 10 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
            <Text style={{ color: d === today ? ACCENT : colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 15 }}>
              {t(WEEKDAY_KEYS[d]!)}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.6 }} />
          </View>
          <EdgeScroll isRTL={isRTL}>
            <View style={{ flex: 1, flexDirection: row, gap: 8 }}>
              {periods.map(p => {
                const slot = slotAt(d, p.periodNumber);
                const className = classNameFor(slot?.classGroupId ?? null);
                return (
                  <Pressable
                    key={p.periodNumber}
                    onPress={() => onCell(d, p.periodNumber)}
                    style={{
                      width: 116, minHeight: 80, padding: 10, borderRadius: 12, borderWidth: 1.5, gap: 6,
                      borderColor: className ? ACCENT : colors.border,
                      backgroundColor: className ? ACCENT + '12' : colors.card,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ alignSelf: 'stretch', color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10.5, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' }}>
                      {`${t('schedulePeriodNumber', p.periodNumber)} · ${p.startTime}`}
                    </Text>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <SlotContent className={className} notes={slot?.notes ?? ''} colors={colors} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </EdgeScroll>
        </View>
      ))}
    </View>
  );
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const width = useViewportWidth();
  const { t, isRTL, lang } = useLanguage();

  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storedView, setStoredView] = useState<ViewMode | null>(null);
  const [selectedSchool, setSelectedSchool] = useState('');
  /** Schools added in this session that have no saved period yet — they only exist once a period is saved. */
  const [draftSchools, setDraftSchools] = useState<string[]>([]);
  const [showWeekend, setShowWeekend] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const [showPeriodsEditor, setShowPeriodsEditor] = useState(false);
  const [addingSchool, setAddingSchool] = useState(false);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY)
      .then(v => { if (v === 'table' || v === 'day' || v === 'cards') setStoredView(v); })
      .catch(() => { /* a remembered view is a convenience; the width default covers it */ });
  }, []);
  const view: ViewMode = storedView ?? (width >= WIDE_MIN ? 'table' : 'day');
  const chooseView = (v: ViewMode) => {
    setStoredView(v);
    AsyncStorage.setItem(VIEW_KEY, v).catch(() => {});
  };

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

  const savedSchools = schoolsOf(periods);
  const schools = [...savedSchools, ...draftSchools.filter(s => !savedSchools.includes(s))];
  if (schools.length === 0) schools.push('');
  const school = schools.includes(selectedSchool) ? selectedSchool : schools[0]!;
  const multiSchool = schools.length > 1;
  const schoolLabel = (name: string) => name || t('scheduleDefaultSchool');

  const today = new Date().getDay();
  const weekdays = visibleWeekdays(slots, showWeekend);
  const shownDay = day !== null && weekdays.includes(day) ? day : defaultDay(today, weekdays);

  const schoolPeriods = periods.filter(p => p.schoolName === school).sort((a, b) => a.periodNumber - b.periodNumber);
  const slotIn = (schoolName: string, dayOfWeek: number, periodNumber: number) =>
    slots.find(s => s.schoolName === schoolName && s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber);
  const slotAt = (dayOfWeek: number, periodNumber: number) => slotIn(school, dayOfWeek, periodNumber);
  const classNameFor = (id: string | null): string => {
    if (!id) return '';
    const found = classes.find(c => c.id === id);
    return found ? (lang === 'ar' && found.nameAr ? found.nameAr : found.name) : '';
  };
  const openCell = (dayOfWeek: number, periodNumber: number) => setEditingCell({ schoolName: school, dayOfWeek, periodNumber });

  const onSavePeriod = async (periodNumber: number, input: { startTime: string; durationMinutes: number }) => {
    try {
      const saved = await setSchedulePeriod(school, periodNumber, input);
      setPeriods(prev => [...prev.filter(p => !(p.schoolName === school && p.periodNumber === periodNumber)), saved]);
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
      await deleteSchedulePeriod(school, periodNumber);
      setPeriods(prev => prev.filter(p => !(p.schoolName === school && p.periodNumber === periodNumber)));
    } catch {
      setError(t('scheduleSaveFailed'));
    }
  };

  const onRenameSchool = async (to: string): Promise<string> => {
    if (to === school) return '';
    if (schools.includes(to)) return t('scheduleSchoolNameTaken');
    // A school with nothing saved yet exists only on this screen.
    if (!savedSchools.includes(school)) {
      setDraftSchools(prev => [...prev.filter(s => s !== school), to]);
      setSelectedSchool(to);
      return '';
    }
    try {
      await renameScheduleSchool(school, to);
      setPeriods(prev => prev.map(p => (p.schoolName === school ? { ...p, schoolName: to } : p)));
      setSlots(prev => prev.map(s => (s.schoolName === school ? { ...s, schoolName: to } : s)));
      setSelectedSchool(to);
      return '';
    } catch (err) {
      return err instanceof ScheduleError && err.isSchoolNameTaken ? t('scheduleSchoolNameTaken') : t('scheduleSaveFailed');
    }
  };

  const onSaveSlot = async (cell: Cell, patch: { classGroupId: string | null; notes: string }) => {
    try {
      const saved = await setScheduleSlot(cell.schoolName, cell.dayOfWeek, cell.periodNumber, patch);
      setSlots(prev => [
        ...prev.filter(s => !(s.schoolName === cell.schoolName && s.dayOfWeek === cell.dayOfWeek && s.periodNumber === cell.periodNumber)),
        saved,
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingCell(null);
    } catch {
      setError(t('scheduleSaveFailed'));
    }
  };

  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const hasAnyPeriod = periods.length > 0;
  const perSchoolView = view !== 'day';

  const emptyState = (
    <View style={styles.empty}>
      <Ionicons name="time-outline" size={40} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
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
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => goBack()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: row, gap: 18 }}>
            <Pressable onPress={() => router.push('/calendar')} hitSlop={12} accessibilityLabel={t('scheduleOpenCalendar')}>
              <Ionicons name="calendar-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setShowPeriodsEditor(true)} hitSlop={12} accessibilityLabel={t('schedulePeriodsTitle')}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </Pressable>
          </View>
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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' }}>
          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.destructive, flexDirection: row }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                {error}
              </Text>
              <Pressable onPress={() => setError('')} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.destructive} />
              </Pressable>
            </View>
          ) : null}

          {!hasAnyPeriod && draftSchools.length === 0 ? emptyState : (
            <>
              <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
                {VIEW_MODES.map(v => (
                  <Chip key={v.mode} label={t(v.label)} icon={v.icon} active={view === v.mode} onPress={() => chooseView(v.mode)} colors={colors} />
                ))}
              </View>

              {perSchoolView ? (
                <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Ionicons name="school-outline" size={16} color={colors.mutedForeground} />
                  {schools.map(s => (
                    <Chip key={s || '__default'} label={schoolLabel(s)} active={s === school} onPress={() => setSelectedSchool(s)} colors={colors} />
                  ))}
                  <Chip label={t('scheduleAddSchool')} icon="add" active={false} onPress={() => setAddingSchool(true)} colors={colors} />
                </View>
              ) : null}

              {view === 'day' ? (
                <DayView
                  day={shownDay}
                  setDay={setDay}
                  weekdays={weekdays}
                  today={today}
                  periods={periods}
                  slots={slots}
                  classNameFor={classNameFor}
                  multiSchool={multiSchool}
                  schoolLabel={schoolLabel}
                  onRow={setEditingCell}
                  isRTL={isRTL}
                  colors={colors}
                  t={t}
                />
              ) : schoolPeriods.length === 0 ? emptyState : view === 'table' ? (
                <TableView
                  periods={schoolPeriods}
                  weekdays={weekdays}
                  today={today}
                  slotAt={slotAt}
                  classNameFor={classNameFor}
                  onCell={openCell}
                  isRTL={isRTL}
                  colors={colors}
                  t={t}
                />
              ) : (
                <CardsView
                  periods={schoolPeriods}
                  weekdays={weekdays}
                  today={today}
                  slotAt={slotAt}
                  classNameFor={classNameFor}
                  onCell={openCell}
                  isRTL={isRTL}
                  colors={colors}
                  t={t}
                />
              )}

              <Pressable onPress={() => setShowWeekend(v => !v)} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', paddingVertical: 4 }}>
                <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>
                  {showWeekend ? t('scheduleHideWeekend') : t('scheduleShowWeekend')}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      <PeriodsEditorModal
        visible={showPeriodsEditor}
        schoolName={school}
        periods={schoolPeriods}
        onClose={() => setShowPeriodsEditor(false)}
        onSave={onSavePeriod}
        onDelete={onDeletePeriod}
        onRename={onRenameSchool}
        isRTL={isRTL}
        colors={colors}
        t={t}
      />

      {addingSchool ? (
        <AddSchoolModal
          existing={schools}
          onClose={() => setAddingSchool(false)}
          onAdd={name => {
            setDraftSchools(prev => [...prev, name]);
            setSelectedSchool(name);
            setAddingSchool(false);
            setShowPeriodsEditor(true);
          }}
          isRTL={isRTL}
          colors={colors}
          t={t}
        />
      ) : null}

      {editingCell ? (
        <SlotEditorModal
          title={[
            t('scheduleSlotTitle', t(WEEKDAY_KEYS[editingCell.dayOfWeek]!), editingCell.periodNumber),
            multiSchool ? schoolLabel(editingCell.schoolName) : '',
          ].filter(Boolean).join(' · ')}
          classes={classes}
          current={slotIn(editingCell.schoolName, editingCell.dayOfWeek, editingCell.periodNumber) ?? null}
          onClose={() => setEditingCell(null)}
          onSave={patch => { void onSaveSlot(editingCell, patch); }}
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
  errorBox: { alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  periodCol: { width: 92, paddingVertical: 8, paddingHorizontal: 6 },
  dayCol: { flex: 1, minWidth: 104 },
  smallInput: {
    paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1.5,
    fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20, gap: 14 },
  modalTitle: { fontSize: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 90, alignItems: 'center' },
});

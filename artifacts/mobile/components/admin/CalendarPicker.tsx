/**
 * A month calendar in a popup — what phones get in place of the browser's
 * `<input type="date">` (see `DateField`). Plain React Native views rather than
 * `@react-native-community/datetimepicker`: a native module would need a new
 * store build, while this ships over the air.
 *
 * Sunday first and laid out right to left in Arabic. Days outside `min`..`max`
 * are shown dimmed and cannot be picked. Dates are `YYYY-MM-DD`, days of UTC,
 * as everywhere on the admin screens.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT } from './widgets';
import { TYPE } from '@/constants/theme';
import {
  MONTHS_AR,
  MONTHS_EN,
  WEEKDAYS_AR,
  WEEKDAYS_EN,
  addMonths,
  formatYmd,
  isOutOfRange,
  monthWeeks,
  parseYmd,
} from '@/services/calendarGrid';

const CELL = 44; // a finger-sized target

export function CalendarPicker({ visible, value, min, max, clearable, ar, isRTL, colors, onPick, onClose }: {
  visible: boolean;
  value: string;
  min?: string;
  max?: string;
  /** Offers «مسح» — for a filter where an empty date means open-ended. */
  clearable?: boolean;
  ar: boolean;
  isRTL: boolean;
  colors: any;
  onPick: (ymd: string) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const start = parseYmd(value) ?? parseYmd(today)!;
  const [shown, setShown] = useState({ y: start.y, m: start.m });
  // Opening it again lands on the chosen day's month, not wherever it was last paged to.
  useEffect(() => {
    if (visible) setShown({ y: start.y, m: start.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const row = isRTL ? 'row-reverse' : 'row';
  const months = ar ? MONTHS_AR : MONTHS_EN;
  const weekdays = ar ? WEEKDAYS_AR : WEEKDAYS_EN;
  const step = (delta: number) => setShown(cur => addMonths(cur.y, cur.m, delta));
  const text = { fontFamily: 'Almarai_400Regular', color: colors.foreground } as const;

  const button = (label: string, onPress: () => void, tone: 'primary' | 'plain' = 'plain', disabled = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      aria-disabled={disabled}
      style={({ pressed }) => ({
        minHeight: CELL,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: tone === 'primary' ? ACCENT : colors.border,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, color: tone === 'primary' ? ACCENT : colors.mutedForeground }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        onPress={onClose}
        accessibilityLabel={ar ? 'إغلاق' : 'Close'}
        style={{ flex: 1, backgroundColor: 'rgba(11,27,51,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        {/* A press inside the card must not fall through to the backdrop and close it. */}
        <Pressable
          onPress={() => {}}
          accessible={false}
          style={{ width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 }}
        >
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => step(-1)}
              accessibilityRole="button"
              accessibilityLabel={ar ? 'الشهر السابق' : 'Previous month'}
              style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.foreground} />
            </Pressable>
            <Text accessibilityRole="header" style={{ ...text, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.body }}>
              {months[shown.m]} {shown.y}
            </Text>
            <Pressable
              onPress={() => step(1)}
              accessibilityRole="button"
              accessibilityLabel={ar ? 'الشهر التالي' : 'Next month'}
              style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={{ flexDirection: row }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            {weekdays.map((w, i) => (
              <Text key={i} style={{ ...text, flex: 1, textAlign: 'center', fontSize: TYPE.caption, color: colors.mutedForeground }}>{w}</Text>
            ))}
          </View>

          {monthWeeks(shown.y, shown.m).map((week, wi) => (
            <View key={wi} style={{ flexDirection: row }}>
              {week.map((day, di) => {
                if (day === null) return <View key={di} style={{ flex: 1, height: CELL }} />;
                const ymd = formatYmd({ y: shown.y, m: shown.m, d: day });
                const off = isOutOfRange(ymd, min, max);
                const selected = ymd === value;
                return (
                  <Pressable
                    key={di}
                    disabled={off}
                    onPress={() => onPick(ymd)}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${months[shown.m]} ${shown.y}`}
                    aria-selected={selected}
                    aria-disabled={off}
                    style={{ flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: colors.radius,
                        backgroundColor: selected ? ACCENT : 'transparent',
                        borderWidth: ymd === today && !selected ? 1 : 0,
                        borderColor: ACCENT,
                        opacity: off ? 0.35 : 1,
                      }}
                    >
                      <Text style={{ ...text, fontSize: TYPE.label, fontFamily: selected ? 'ReadexPro_700Bold' : 'Almarai_400Regular', color: selected ? '#fff' : colors.foreground }}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
            <View style={{ flexDirection: row, gap: 8 }}>
              {button(ar ? 'اليوم' : 'Today', () => onPick(today), 'primary', isOutOfRange(today, min, max))}
              {clearable && !!value && button(ar ? 'مسح' : 'Clear', () => onPick(''))}
            </View>
            {button(ar ? 'إغلاق' : 'Close', onClose)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

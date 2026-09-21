/**
 * Edit one period's time and length — opened by tapping its column heading.
 * Also how a new period is added: the trailing "+" heading opens this with
 * `isNew`, pre-filled with the previous period's end time so back-to-back is
 * the default and a gap is the deliberate choice.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { TranslationKey } from '@/services/i18n';
import { endTime, isValidDuration, isValidTime } from '@/services/schedulePeriods';
import { Popover, type Anchor } from './Popover';

type T = (key: TranslationKey, ...args: any[]) => string;

export function PeriodPopover({
  anchor, isDesktop, isRTL, colors, t, periodNumber, initialStart, initialDuration, isNew, onSave, onDelete, onClose,
}: {
  anchor: Anchor | null;
  isDesktop: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: T;
  periodNumber: number;
  initialStart: string;
  initialDuration: number;
  isNew: boolean;
  onSave: (input: { startTime: string; durationMinutes: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [time, setTime] = useState(initialStart);
  const [duration, setDuration] = useState(String(initialDuration));
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;

  const durationNum = Number(duration);
  const valid = isValidTime(time) && /^\d{1,3}$/.test(duration) && isValidDuration(durationNum);
  const end = valid ? endTime({ startTime: time, durationMinutes: durationNum }) : '';
  const dirty = time !== initialStart || duration !== String(initialDuration);
  const canSave = valid && end !== '' && (isNew || dirty);

  const input = {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: 'center' as const,
  };

  return (
    <Popover anchor={anchor} isDesktop={isDesktop} isRTL={isRTL} colors={colors} onClose={onClose}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
        {isNew ? t('scheduleAddPeriod') : `${t('scheduleEditPeriod')} · ${t('schedulePeriodNumber', periodNumber)}`}
      </Text>
      <View style={{ flexDirection: rowDir, gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align }}>{t('scheduleStartTime')}</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} maxLength={5} style={input} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align }}>{t('scheduleDuration')}</Text>
          <TextInput
            value={duration}
            onChangeText={v => (v === '' || /^\d{1,3}$/.test(v)) && setDuration(v)}
            keyboardType="number-pad" maxLength={3} placeholderTextColor={colors.mutedForeground} style={input}
          />
        </View>
      </View>
      <Text style={{ color: end ? colors.mutedForeground : colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
        {end ? `${time}–${end}` : valid ? t('scheduleDoesNotFit') : ' '}
      </Text>
      <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        {!isNew ? (
          <Pressable onPress={onDelete} hitSlop={8} style={{ flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>{t('remove')}</Text>
          </Pressable>
        ) : <View />}
        <Pressable
          onPress={() => onSave({ startTime: time, durationMinutes: durationNum })}
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary }}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('save')}</Text>
        </Pressable>
      </View>
    </Popover>
  );
}

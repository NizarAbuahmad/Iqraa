/**
 * "Set up my periods" in one go: how many, when the first starts, how long
 * each is, optional break — preview, then apply. See
 * services/schedulePeriods.ts for why this exists instead of typing seven
 * times by hand. Shown inline as the empty state, and from the gear icon.
 *
 * Applying (and the "replace what's there?" confirm) is the screen's job;
 * this reports the generated list.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { useColors } from '@/hooks/useColors';
import type { TranslationKey } from '@/services/i18n';
import {
  MAX_PERIOD_COUNT,
  formatRange,
  generatePeriods,
  isValidDuration,
  isValidTime,
  type GeneratedPeriod,
} from '@/services/schedulePeriods';

type T = (key: TranslationKey, ...args: any[]) => string;

export function PeriodsWizard({ isRTL, colors, t, busy, onApply, onCancel }: {
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: T;
  busy: boolean;
  onApply: (periods: GeneratedPeriod[]) => void;
  onCancel?: () => void;
}) {
  const [count, setCount] = useState('7');
  const [firstStart, setFirstStart] = useState('08:00');
  const [duration, setDuration] = useState('45');
  const [breakAfter, setBreakAfter] = useState('3');
  const [breakMinutes, setBreakMinutes] = useState('20');
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;

  const countNum = Number(count);
  const durationNum = Number(duration);
  const breakAfterNum = breakAfter === '' ? null : Number(breakAfter);
  const breakMinutesNum = Number(breakMinutes || '0');
  const fieldsValid =
    Number.isInteger(countNum) && countNum >= 1 && countNum <= MAX_PERIOD_COUNT &&
    isValidTime(firstStart) && isValidDuration(durationNum) &&
    (breakAfterNum === null || (Number.isInteger(breakAfterNum) && breakAfterNum >= 1)) &&
    (breakAfterNum === null || (Number.isInteger(breakMinutesNum) && breakMinutesNum >= 0));
  const preview = fieldsValid
    ? generatePeriods({ count: countNum, firstStart, durationMinutes: durationNum, breakAfter: breakAfterNum, breakMinutes: breakMinutesNum })
    : [];
  const doesNotFit = fieldsValid && preview.length === 0;

  const digits = (max: number) => (set: (v: string) => void) => (v: string) => {
    if (v === '' || (/^\d+$/.test(v) && v.length <= max)) set(v);
  };
  const input = {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: 'center' as const,
  };
  const label = { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align } as const;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>
        {t('scheduleWizardIntro')}
      </Text>
      <View style={{ flexDirection: rowDir, gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexBasis: 120, flexGrow: 1, gap: 4 }}>
          <Text style={label}>{t('schedulePeriodCount')}</Text>
          <TextInput value={count} onChangeText={digits(2)(setCount)} keyboardType="number-pad" style={input} />
        </View>
        <View style={{ flexBasis: 120, flexGrow: 1, gap: 4 }}>
          <Text style={label}>{t('scheduleFirstStart')}</Text>
          <TextInput value={firstStart} onChangeText={setFirstStart} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} maxLength={5} style={input} />
        </View>
        <View style={{ flexBasis: 120, flexGrow: 1, gap: 4 }}>
          <Text style={label}>{t('scheduleDuration')}</Text>
          <TextInput value={duration} onChangeText={digits(3)(setDuration)} keyboardType="number-pad" style={input} />
        </View>
      </View>
      <View style={{ flexDirection: rowDir, gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexBasis: 120, flexGrow: 1, gap: 4 }}>
          <Text style={label}>{t('scheduleBreakAfter')}</Text>
          <TextInput value={breakAfter} onChangeText={digits(2)(setBreakAfter)} keyboardType="number-pad" placeholder={t('scheduleNoBreak')} placeholderTextColor={colors.mutedForeground} style={input} />
        </View>
        <View style={{ flexBasis: 120, flexGrow: 1, gap: 4 }}>
          <Text style={label}>{t('scheduleBreakMinutes')}</Text>
          <TextInput value={breakMinutes} onChangeText={digits(3)(setBreakMinutes)} keyboardType="number-pad" editable={breakAfterNum !== null} style={[input, { opacity: breakAfterNum === null ? 0.5 : 1 }]} />
        </View>
      </View>

      {/* Preview: the exact list that Apply will save, so nothing is a surprise. */}
      <View style={{ gap: 4 }}>
        <Text style={label}>{t('schedulePreview')}</Text>
        {doesNotFit ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12.5, textAlign: align }}>{t('scheduleDoesNotFit')}</Text>
        ) : null}
        <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 6 }}>
          {preview.map(p => (
            <View key={p.periodNumber} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.secondary }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                {`${t('schedulePeriodNumber', p.periodNumber)} · ${formatRange(p)}`}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: rowDir, justifyContent: 'flex-start', gap: 10, alignItems: 'center' }}>
        <Pressable
          onPress={() => onApply(preview)}
          disabled={busy || preview.length === 0}
          style={{ opacity: busy || preview.length === 0 ? 0.5 : 1, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary, minWidth: 130, alignItems: 'center' }}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : (
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13.5 }}>{t('scheduleApply')}</Text>
          )}
        </Pressable>
        {onCancel ? (
          <Pressable onPress={onCancel} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13.5 }}>{t('cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

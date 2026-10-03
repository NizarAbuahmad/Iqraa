/**
 * From/to filter for the admin lists. Presets for the common questions, two
 * date boxes for everything else (native date pickers on web). The value is
 * two 'YYYY-MM-DD' strings or '' for open-ended; `rangeQuery` turns it into
 * the `&from=&to=` the API expects (lib/adminMetrics.ts parseDateRange).
 */
import React from 'react';
import { Platform, TextInput, View } from 'react-native';
import { FilterChip } from './widgets';

export type Range = { from: string; to: string };
export const EMPTY_RANGE: Range = { from: '', to: '' };

export const dayAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
export const monthStart = () => `${dayAgo(0).slice(0, 8)}01`;

export function rangeQuery(r: Range): string {
  return (r.from ? `&from=${r.from}` : '') + (r.to ? `&to=${r.to}` : '');
}

export function DateRange({ value, onChange, ar, isRTL, colors }: {
  value: Range;
  onChange: (r: Range) => void;
  ar: boolean;
  isRTL: boolean;
  colors: any;
}) {
  const presets: [string, string, Range][] = [
    ['الكل', 'All', EMPTY_RANGE],
    ['٧ أيام', '7d', { from: dayAgo(6), to: '' }],
    ['٣٠ يومًا', '30d', { from: dayAgo(29), to: '' }],
    ['هذا الشهر', 'This month', { from: monthStart(), to: '' }],
  ];
  const input = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.foreground,
    fontFamily: 'Almarai_400Regular',
    fontSize: 13,
    width: 130,
  };
  const web = Platform.OS === 'web' ? ({ type: 'date' } as object) : {};
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {presets.map(([a, e, r]) => (
        <FilterChip key={e} label={ar ? a : e} active={value.from === r.from && value.to === r.to} onPress={() => onChange(r)} colors={colors} />
      ))}
      <TextInput value={value.from} onChangeText={from => onChange({ ...value, from })} placeholder={ar ? 'من' : 'From'} placeholderTextColor={colors.mutedForeground} style={input} {...web} />
      <TextInput value={value.to} onChangeText={to => onChange({ ...value, to })} placeholder={ar ? 'إلى' : 'To'} placeholderTextColor={colors.mutedForeground} style={input} {...web} />
    </View>
  );
}

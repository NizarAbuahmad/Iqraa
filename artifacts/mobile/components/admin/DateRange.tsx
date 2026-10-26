/**
 * From/to filter for the admin lists. Presets for the common questions, two
 * date boxes for everything else (the browser's calendar picker on web). The value is
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

/**
 * One date box. On web a real <input type="date"> (react-native-web's TextInput
 * forces type="text", so passing `type` to it never gave a picker); a plain
 * 'YYYY-MM-DD' text box on native. Clicking anywhere on the box opens the calendar.
 */
export function DateField({ value, onChange, label, min, max, isRTL, colors }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  min?: string;
  max?: string;
  isRTL: boolean;
  colors: any;
}) {
  if (Platform.OS !== 'web') {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.mutedForeground}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 10, paddingVertical: 7, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, width: 130 }}
      />
    );
  }
  return (
    <label style={{ display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, borderRadius: colors.radius, background: colors.card, padding: '0 10px', height: 36, cursor: 'pointer' }}>
      <span style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        onClick={e => { try { e.currentTarget.showPicker(); } catch { /* already open, or no showPicker */ } }}
        style={{ border: 0, outline: 0, background: 'transparent', color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, direction: 'ltr', cursor: 'pointer' }}
      />
    </label>
  );
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
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {presets.map(([a, e, r]) => (
        <FilterChip key={e} label={ar ? a : e} active={value.from === r.from && value.to === r.to} onPress={() => onChange(r)} colors={colors} />
      ))}
      <DateField value={value.from} onChange={from => onChange({ ...value, from })} label={ar ? 'من' : 'From'} max={value.to || undefined} isRTL={isRTL} colors={colors} />
      <DateField value={value.to} onChange={to => onChange({ ...value, to })} label={ar ? 'إلى' : 'To'} min={value.from || undefined} isRTL={isRTL} colors={colors} />
    </View>
  );
}

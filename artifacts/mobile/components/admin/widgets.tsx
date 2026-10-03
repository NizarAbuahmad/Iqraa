/**
 * The pieces every admin screen is built from (dashboard, AI costs, …).
 * Operator UI: one accent, inline strings, nothing themed per product area.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const ACCENT = '#4F46E5';

export function SectionTitle({ text, isRTL, colors }: { text: string; isRTL: boolean; colors: any }) {
  return (
    <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
      {text}
    </Text>
  );
}

export function StatCard({ label, value, colors }: { label: string; value: number | string; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, lineHeight: 18, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export function KeyValue({ k, v, isRTL, colors }: { k: string; v: string; isRTL: boolean; colors: any }) {
  return (
    <View style={[styles.barRow, { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }]}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 20, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{k}</Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 13 }}>{v}</Text>
    </View>
  );
}

export function Bar({ ratio, isRTL, colors }: { ratio: number; isRTL: boolean; colors: any }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: 'hidden', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <View style={{ width: `${r * 100}%`, backgroundColor: r >= 0.9 ? colors.destructive : ACCENT }} />
    </View>
  );
}

export function Table({ head, rows, empty, isRTL, colors }: { head: string[]; rows: string[][]; empty?: string; isRTL: boolean; colors: any }) {
  const cellStyle = (i: number) => ({
    flex: i === 0 ? 2 : 1,
    color: colors.foreground,
    fontFamily: 'Almarai_400Regular',
    fontSize: 12.5,
    lineHeight: 20,
    textAlign: (i === 0 ? (isRTL ? 'right' : 'left') : 'center') as 'right' | 'left' | 'center',
  });
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10, gap: 2 }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border }}>
        {head.map((h, i) => <Text key={h} style={[cellStyle(i), { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>{h}</Text>)}
      </View>
      {rows.length === 0 && !!empty && (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 20, textAlign: 'center' }}>{empty}</Text>
      )}
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', paddingVertical: 2 }}>
          {r.map((c, i) => <Text key={i} numberOfLines={1} style={cellStyle(i)}>{c}</Text>)}
        </View>
      ))}
    </View>
  );
}

export function FilterChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: active ? ACCENT : colors.card,
        borderColor: active ? ACCENT : colors.border,
        borderRadius: colors.radius,
      }]}
    >
      <Text style={{ color: active ? '#fff' : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}

/** One bar per day between `from` and `to` (inclusive, 'YYYY-MM-DD'); hover shows the value on web. */
export function DayBars({ from, to, valueOf, isRTL, colors }: {
  from: string;
  to: string;
  valueOf: (day: string) => number;
  isRTL: boolean;
  colors: any;
}) {
  const days: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to) && days.length < 400; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const max = Math.max(1e-9, ...days.map(valueOf));
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-end', height: 90, gap: 2 }}>
      {days.map(d => {
        const n = valueOf(d);
        return (
          <View
            key={d}
            style={{ flex: 1, maxWidth: 36, height: `${(n / max) * 100}%`, minHeight: n ? 3 : 1, backgroundColor: n ? ACCENT : colors.border, borderRadius: 2 }}
            {...({ title: `${d}: ${Number.isInteger(n) ? n : n.toFixed(4)}` } as object)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, marginBottom: 10, marginTop: 10 },
  statCard: { flex: 1, minWidth: 110, alignItems: 'center', padding: 14, borderWidth: 1 },
  card: { padding: 14, borderWidth: 1, gap: 6 },
  barRow: { alignItems: 'center', paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
});

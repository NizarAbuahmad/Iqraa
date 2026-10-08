/**
 * Elements 1–20 in their table positions, with a detail panel and a Bohr-style
 * shell diagram. Selecting an element shows its number, Arabic name, mass,
 * period, group and electron configuration.
 *
 * The grid is laid out left-to-right on purpose, even on an RTL screen: that is
 * how the textbook prints the table, and mirroring it puts group 1 on the
 * wrong side. The Arabic labels inside keep their own direction.
 */
import React, { useMemo, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ELEMENTS, electronConfiguration, formatConfiguration, shellCounts, type Element } from '@workspace/curriculum/elements';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { formatLabNumber } from '@/services/labFormat';

const CELL = 44;
const GAP = 4;
const COLS = 18;
const ROWS = 4;
// Right-edge fade, drawn as stacked strips: a gradient would need expo-linear-gradient.
const FADE_STEPS = [0.15, 0.3, 0.5, 0.7, 0.9];

export function LabPeriodicTable() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [z, setZ] = useState(11);
  const selected = ELEMENTS.find(e => e.z === z) as Element;
  const align = isRTL ? 'right' : 'left';
  // The table is wider than a phone and the scroll bar is hidden, so without a
  // cue it reads as a seven-element table. Show the cue only while there is
  // more to the right.
  const [viewW, setViewW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const overflows = viewW > 0 && contentW > viewW + 1;
  const moreRight = overflows && !atEnd;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setAtEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 4);
  };

  const byCell = useMemo(() => {
    const m = new Map<string, Element>();
    for (const e of ELEMENTS) m.set(`${e.period}:${e.group}`, e);
    return m;
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('labPtSelect')}
      </Text>

      <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={overflows}
        contentContainerStyle={{ direction: 'ltr' as const }}
        onLayout={e => setViewW(e.nativeEvent.layout.width)}
        onContentSizeChange={w => setContentW(w)}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        <View style={{ width: COLS * (CELL + GAP), direction: 'ltr' }}>
          {Array.from({ length: ROWS }, (_, r) => (
            <View key={r} style={{ flexDirection: 'row', direction: 'ltr' }}>
              {Array.from({ length: COLS }, (_, c) => {
                const e = byCell.get(`${r + 1}:${c + 1}`);
                if (!e) return <View key={c} style={{ width: CELL, height: CELL, margin: GAP / 2 }} />;
                const on = e.z === z;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setZ(e.z)}
                    accessibilityRole="button"
                    aria-selected={on}
                    style={[
                      styles.cell,
                      { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.cellZ, { color: on ? colors.primaryForeground : colors.mutedForeground }]}>{e.z}</Text>
                    <Text style={[styles.cellSym, { color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>
                      {e.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {moreRight && (
        <View pointerEvents="none" style={styles.fade}>
          {FADE_STEPS.map(o => (
            <View key={o} style={{ width: 6, backgroundColor: colors.background, opacity: o }} />
          ))}
        </View>
      )}
      </View>
      {moreRight && (
        <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {t('labPtScrollHint')}
        </Text>
      )}

      <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <ShellDiagram z={selected.z} color={colors.primary} muted={colors.border} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, textAlign: align, fontFamily: 'ReadexPro_700Bold' }}>
            {selected.symbol} · {lang === 'ar' ? selected.nameAr : selected.nameEn}
          </Text>
          <Row label={t('labPtNumber')} value={formatLabNumber(selected.z, lang)} align={align} colors={colors} />
          <Row label={t('labPtMass')} value={formatLabNumber(selected.atomicMass, lang, 3)} align={align} colors={colors} />
          <Row label={t('labPtPeriod')} value={formatLabNumber(selected.period, lang)} align={align} colors={colors} />
          <Row label={t('labPtGroup')} value={formatLabNumber(selected.group, lang)} align={align} colors={colors} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: align, marginTop: 6, fontFamily: 'Almarai_400Regular' }}>
            {t('labPtConfig')}
          </Text>
          <View
            accessible
            accessibilityLabel={formatConfiguration(selected.z)}
            style={{ flexDirection: 'row', flexWrap: 'wrap', direction: 'ltr', justifyContent: isRTL ? 'flex-end' : 'flex-start', columnGap: 8 }}
          >
            {electronConfiguration(selected.z).map(c => (
              <View key={`${c.n}${c.sub}`} style={{ flexDirection: 'row' }}>
                <Text style={{ color: colors.foreground, fontSize: 16 }}>{c.n}{c.sub}</Text>
                <Text style={{ color: colors.foreground, fontSize: 10, marginTop: 1 }}>{c.electrons}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  align,
  colors,
}: {
  label: string;
  value: string;
  align: 'left' | 'right';
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <Text style={{ color: colors.foreground, fontSize: 14, textAlign: align, fontFamily: 'Almarai_400Regular' }}>
      <Text style={{ color: colors.mutedForeground }}>{label}: </Text>
      {value}
    </Text>
  );
}

/** Concentric shells with one dot per electron, spread evenly round each ring. */
function ShellDiagram({ z, color, muted }: { z: number; color: string; muted: string }) {
  const counts = shellCounts(z);
  const size = 120;
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={5} fill={color} />
      {counts.map((n, i) => {
        const r = 14 + i * 14;
        return (
          <React.Fragment key={i}>
            <Circle cx={c} cy={c} r={r} fill="none" stroke={muted} strokeWidth={1} />
            {Array.from({ length: n }, (_, k) => {
              const a = (2 * Math.PI * k) / n - Math.PI / 2;
              return <Circle key={k} cx={c + r * Math.cos(a)} cy={c + r * Math.sin(a)} r={2.6} fill={color} />;
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  hint: { fontSize: 13 },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  cell: {
    width: CELL,
    height: CELL,
    margin: GAP / 2,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellZ: { fontSize: 9, position: 'absolute', top: 2, left: 4 },
  cellSym: { fontSize: 16 },
  detail: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14, alignItems: 'center' },
});

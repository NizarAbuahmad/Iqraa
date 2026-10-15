/**
 * The unit converter: pick a category, type a number, pick two units. All the
 * arithmetic is `services/mathUnits.ts`; this file only draws it.
 *
 * The result updates as the user types and is never a guess: an empty box shows
 * a hint, a bad number or an impossible temperature shows a named message.
 * There is a ± button because a decimal keypad has no minus and temperatures go
 * negative. Digits are shown Arabic-Indic in Arabic and always forced
 * left-to-right (see `forceLtr`), the same trap as the calculator.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import type { TranslationKey } from '@/services/i18n';
import { forceLtr, formatCalcNumber } from '@/services/mathCalc';
import {
  UNIT_CATEGORIES,
  convert,
  defaultPair,
  getUnit,
  unitsFor,
  type ConvertFailure,
  type UnitCategory,
  type UnitDef,
} from '@/services/mathUnits';

const CATEGORY_KEY: Record<UnitCategory, TranslationKey> = {
  length: 'mathUnitCatLength',
  mass: 'mathUnitCatMass',
  time: 'mathUnitCatTime',
  area: 'mathUnitCatArea',
  volume: 'mathUnitCatVolume',
  angle: 'mathUnitCatAngle',
  temperature: 'mathUnitCatTemperature',
  speed: 'mathUnitCatSpeed',
};

// Exhaustive on purpose: a new failure reason without a message fails to compile.
const ERROR_KEY: Record<ConvertFailure, TranslationKey> = {
  empty: 'mathUnitErrEmpty',
  'bad-number': 'mathUnitErrBadNumber',
  'unknown-unit': 'mathUnitErrUnit',
  'category-mismatch': 'mathUnitErrUnit',
  'below-absolute-zero': 'mathUnitErrAbsZero',
  overflow: 'mathUnitErrOverflow',
};

type Colors = ReturnType<typeof useColors>;
type Lang = 'ar' | 'en';

const unitLabel = (u: UnitDef, lang: Lang): string => (lang === 'ar' ? u.ar : u.symbol);
const unitName = (u: UnitDef, lang: Lang): string => (lang === 'ar' ? u.ar : u.en);

function Chip({
  label,
  a11y,
  selected,
  colors,
  onPress,
}: {
  label: string;
  a11y?: string;
  selected: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      aria-selected={selected}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.primaryForeground : colors.foreground,
          fontFamily: 'ReadexPro_500Medium',
          fontSize: TYPE.label,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MathUnitConverter() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [category, setCategory] = useState<UnitCategory>('length');
  const [pair, setPair] = useState<[string, string]>(defaultPair('length'));
  const [raw, setRaw] = useState('');
  const [from, to] = pair;
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const units = unitsFor(category);
  const result = useMemo(() => convert(raw, from, to), [raw, from, to]);
  const toUnit = getUnit(to);

  const pickCategory = (c: UnitCategory) => {
    setCategory(c);
    setPair(defaultPair(c));
  };
  const toggleSign = () => setRaw(r => (r.trim().startsWith('-') ? r.trim().slice(1) : `-${r.trim()}`));

  return (
    <View style={styles.wrap}>
      <View style={[styles.chips, { flexDirection: rowDir }]}>
        {UNIT_CATEGORIES.map(c => (
          <Chip key={c} label={t(CATEGORY_KEY[c])} selected={c === category} colors={colors} onPress={() => pickCategory(c)} />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('mathUnitValue')}
      </Text>
      <View style={[styles.inputRow, { flexDirection: rowDir }]}>
        <TextInput
          value={raw}
          onChangeText={setRaw}
          placeholder={t('mathUnitPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t('mathUnitValue')}
          keyboardType="decimal-pad"
          autoCorrect={false}
          style={[
            styles.input,
            { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' },
          ]}
        />
        <Pressable
          onPress={toggleSign}
          accessibilityRole="button"
          accessibilityLabel={t('mathUnitSign')}
          style={({ pressed }) => [styles.signButton, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg }}>±</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('mathUnitFrom')}
      </Text>
      <View style={[styles.chips, { flexDirection: rowDir }]}>
        {units.map(u => (
          <Chip
            key={u.id}
            label={unitLabel(u, lang)}
            a11y={unitName(u, lang)}
            selected={u.id === from}
            colors={colors}
            onPress={() => setPair([u.id, to])}
          />
        ))}
      </View>

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setPair([to, from]);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('mathUnitSwap')}
        style={({ pressed }) => [styles.swap, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="swap-vertical" size={20} color={colors.primary} />
      </Pressable>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('mathUnitTo')}
      </Text>
      <View style={[styles.chips, { flexDirection: rowDir }]}>
        {units.map(u => (
          <Chip
            key={u.id}
            label={unitLabel(u, lang)}
            a11y={unitName(u, lang)}
            selected={u.id === to}
            colors={colors}
            onPress={() => setPair([from, u.id])}
          />
        ))}
      </View>

      <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
          {t('mathUnitResult')}
        </Text>
        {result.ok ? (
          <View accessibilityLiveRegion="polite" style={[styles.valueRow, { flexDirection: rowDir }]}>
            {(() => {
              const q = formatCalcNumber(result.value, lang);
              return (
                <View style={styles.numberRow}>
                  <Text style={[styles.value, { color: colors.foreground }]}>{forceLtr(q.text)}</Text>
                  {q.exponent !== null ? <Text style={[styles.exp, { color: colors.foreground }]}>{forceLtr(q.exponent)}</Text> : null}
                </View>
              );
            })()}
            {toUnit ? (
              <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unitLabel(toUnit, lang)}</Text>
            ) : null}
          </View>
        ) : (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: result.reason === 'empty' ? colors.mutedForeground : colors.destructive,
              fontFamily: 'ReadexPro_600SemiBold',
              fontSize: TYPE.body,
              textAlign: align,
            }}
          >
            {t(ERROR_KEY[result.reason])}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACE.lg, gap: SPACE.sm },
  chips: { flexWrap: 'wrap', gap: SPACE.sm },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
  label: { fontSize: TYPE.caption, marginTop: SPACE.sm },
  inputRow: { gap: SPACE.sm, alignItems: 'stretch' },
  input: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, fontSize: TYPE.bodyLg },
  signButton: { width: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  swap: { alignSelf: 'center', width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.sm },
  result: { marginTop: SPACE.lg, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.xs },
  valueRow: { alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  numberRow: { flexDirection: 'row', alignItems: 'flex-start' },
  value: { fontSize: TYPE.hero, lineHeight: 40, fontFamily: 'ReadexPro_700Bold' },
  exp: { fontSize: TYPE.body, marginTop: SPACE.xs, fontFamily: 'ReadexPro_700Bold' },
  unit: { fontSize: TYPE.title, fontFamily: 'ReadexPro_600SemiBold' },
});

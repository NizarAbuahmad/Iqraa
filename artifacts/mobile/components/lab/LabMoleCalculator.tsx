/**
 * Type a formula, give one of grams / moles / particles, get the other two and
 * the molar mass. Everything is computed by `solveMole`; this file only reads
 * inputs and prints results. A formula it cannot read shows a named message —
 * never a number.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { solveMole, type MoleKnown } from '@/services/labMole';
import { formatLabNumber, formatLabQuantity, parseLabNumber } from '@/services/labFormat';
import type { TranslationKey } from '@/services/i18n';

const PRESETS = ['H2O', 'CO2', 'NaCl', 'Ca(OH)2'];

const KNOWN_LABEL: Record<MoleKnown, TranslationKey> = {
  grams: 'labMoleGrams',
  moles: 'labMoleMoles',
  particles: 'labMoleParticles',
};

export function LabMoleCalculator() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [formula, setFormula] = useState('H2O');
  const [known, setKnown] = useState<MoleKnown>('grams');
  const [raw, setRaw] = useState('36');

  const result = useMemo(() => {
    // Accepts latin and Arabic-Indic digits, «٫» / "," as the decimal mark and
    // `6.022e23` / `6.022×10^23`; anything else (including "1,000", which could
    // be a thousand or one) is NaN, which reports "enter a number".
    const value = parseLabNumber(raw);
    return solveMole({ formula, known, value });
  }, [formula, known, raw]);

  const error = !result.ok
    ? ({
        empty: t('labMoleErrEmpty'),
        syntax: t('labMoleErrSyntax'),
        'unknown-element': t('labMoleErrUnknown'),
        'bad-value': t('labMoleErrValue'),
      }[result.reason] as string)
    : null;

  // One path for all three rows: tiny and huge values go scientific instead of
  // printing "0" (1000 particles is 1.66e-21 mol).
  const quantities = result.ok
    ? {
        grams: formatLabQuantity(result.grams, lang, 3),
        moles: formatLabQuantity(result.moles, lang, 4),
        particles: formatLabQuantity(result.particles, lang, 3),
      }
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleFormula')}</Text>
      <TextInput
        value={formula}
        onChangeText={setFormula}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
      />
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {PRESETS.map(p => (
          <Pressable key={p} onPress={() => setFormula(p)} accessibilityRole="button" style={[styles.chip, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.foreground, writingDirection: 'ltr' }}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleKnown')}</Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(Object.keys(KNOWN_LABEL) as MoleKnown[]).map(k => (
          <Pressable
            key={k}
            onPress={() => setKnown(k)}
            accessibilityRole="button"
            aria-selected={known === k}
            style={[styles.chip, { backgroundColor: known === k ? colors.primary : colors.muted }]}
          >
            <Text style={{ color: known === k ? colors.primaryForeground : colors.foreground }}>{t(KNOWN_LABEL[k])}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleValue')}</Text>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
      />

      {error ? (
        <Text style={{ color: colors.destructive, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{error}</Text>
      ) : result.ok && quantities ? (
        <View style={[styles.results, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ResultRow label={t('labMoleMolarMass')} colors={colors} align={align}>
            <Text style={styles.value}>{formatLabNumber(result.molarMass, lang, 3)}</Text>
          </ResultRow>
          <ResultRow label={t('labMoleGrams')} colors={colors} align={align}>
            <Quantity q={quantities.grams} />
          </ResultRow>
          <ResultRow label={t('labMoleMoles')} colors={colors} align={align}>
            <Quantity q={quantities.moles} />
          </ResultRow>
          <ResultRow label={t('labMoleParticles')} colors={colors} align={align}>
            <Quantity q={quantities.particles} />
          </ResultRow>
        </View>
      ) : null}
    </View>
  );
}

function Quantity({ q }: { q: { text: string; exponent: string | null } }) {
  return (
    <>
      <Text style={styles.value}>{q.text}</Text>
      {q.exponent !== null ? <Text style={styles.exp}>{q.exponent}</Text> : null}
    </>
  );
}

function ResultRow({
  label,
  children,
  colors,
  align,
}: {
  label: string;
  children: React.ReactNode;
  colors: { foreground: string; mutedForeground: string; border: string };
  align: 'left' | 'right';
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  label: { fontSize: 13, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, writingDirection: 'ltr' },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  results: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 8, gap: 4 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  value: { fontSize: 22, fontFamily: 'ReadexPro_700Bold' },
  exp: { fontSize: 13, marginTop: 2, fontFamily: 'ReadexPro_700Bold' },
});

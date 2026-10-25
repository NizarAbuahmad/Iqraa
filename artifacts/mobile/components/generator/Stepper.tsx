/**
 * A numeric list as minus / value / plus: the quiz's duration, marks and question
 * count. The value shown is the option's own label («20 دقيقة»), and pressing a
 * button moves the screen's INDEX one step through its real option array, never
 * a number: the arrays are uneven (10, 15, 20, 25, 30, 45) and their positions
 * are saved (CLAUDE.md, «Picker order is persisted state»). The buttons are
 * disabled at either end rather than wrapping.
 *
 * The minus button comes first, so in RTL it sits at the start (right) and in
 * LTR at the left. One layout at every width: the label on one side, the controls
 * on the other. The controls need about 176 points, so three of these never sit
 * side by side (they overflowed their cards at desktop widths when they did).
 *
 * The value is deliberately not a live region: with one, a screen reader said
 * each step twice. The summary line in `DockedAction` is the one live region.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';

export interface StepperProps {
  label: string;
  /** The option labels, index-aligned with the screen's option array. */
  options: readonly string[];
  index: number;
  onChange: (index: number) => void;
  accent: string;
}

export function Stepper({ label, options, index, onChange, accent }: StepperProps) {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const ink = readableOn(accent, colors.card);
  const last = options.length - 1;
  const atStart = index <= 0;
  const atEnd = index >= last;
  const step = (to: number) => {
    Haptics.selectionAsync();
    onChange(to);
  };
  const button = (kind: 'less' | 'more') => {
    const disabled = kind === 'less' ? atStart : atEnd;
    return (
      <PressableScale
        accessibilityLabel={`${t(kind === 'less' ? 'genStepperLess' : 'genStepperMore')}: ${label}`}
        disabled={disabled}
        aria-disabled={disabled}
        onPress={() => step(kind === 'less' ? index - 1 : index + 1)}
        style={[
          styles.button,
          { backgroundColor: colors.muted, borderColor: colors.border, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        <Ionicons name={kind === 'less' ? 'remove' : 'add'} size={ICON.lg} color={ink} />
      </PressableScale>
    );
  };
  return (
    <View style={[surface, styles.card, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View style={[styles.controls, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {button('less')}
        <Text
          accessibilityLabel={`${label}: ${options[index]}`}
          style={[styles.value, { color: colors.foreground }]}
        >
          {options[index]}
        </Text>
        {button('more')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, gap: SPACE.sm, alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, flexShrink: 1 },
  controls: { alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  button: { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 72, textAlign: 'center', fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.body },
});

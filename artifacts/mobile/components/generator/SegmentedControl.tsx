/**
 * A short list as touch targets side by side: the quiz's level and its
 * distribution. Four options at most (a longer list stays a dropdown): each
 * takes an equal share of the track and wraps its label rather than clipping it.
 *
 * It moves the same index the screen's old dropdown moved, over the same option
 * array, so a saved `diffIdx` keeps its meaning (CLAUDE.md, «Picker order is
 * persisted state»). Colour: the selected segment is the card colour with the
 * tool's accent as text and a ring (`readableOn(accent, colors.card)`, so it holds
 * 4.5:1 in dark mode too); the rest is muted text on the track.
 *
 * Accessibility: a radio group, `aria-checked` on each radio (never
 * `accessibilityState`, which react-native-web ignores).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';

export interface SegmentedControlProps {
  label: string;
  options: readonly string[];
  index: number;
  onChange: (index: number) => void;
  /** The tool's concept colour. */
  accent: string;
}

export function SegmentedControl({ label, options, index, onChange, accent }: SegmentedControlProps) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const ink = readableOn(accent, colors.card);
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[
          styles.track,
          { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {options.map((option, i) => {
          const on = i === index;
          return (
            <PressableScale
              key={i}
              accessibilityRole="radio"
              aria-checked={on}
              accessibilityLabel={option}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync();
                onChange(i);
              }}
              style={[
                styles.segment,
                on ? { backgroundColor: colors.card, borderColor: ink } : { borderColor: 'transparent' },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.text,
                  { color: on ? ink : colors.mutedForeground, fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular' },
                ]}
              >
                {option}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, marginBottom: SPACE.sm },
  track: { gap: SPACE.xs, padding: SPACE.xs, borderWidth: 1, borderRadius: RADIUS.md },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
  },
  text: { fontSize: TYPE.label, textAlign: 'center' },
});

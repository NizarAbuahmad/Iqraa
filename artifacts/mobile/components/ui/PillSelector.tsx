/**
 * A labelled row of selectable pills.
 *
 * Four screens (game.tsx, classroom/builder.tsx, slides.tsx, activity.tsx's
 * sibling forms) each hand-rolled their own version of this, byte-for-byte
 * identical in structure and differing only in pixel values — game.tsx's
 * pills are wider with a minWidth so a single digit doesn't look cramped,
 * builder.tsx and slides.tsx use a narrower default. `pillStyle` carries that
 * one difference; everything else is shared.
 */
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface PillOption<T extends string | number> {
  value: T;
  label: string;
}

interface Colors {
  foreground: string;
  card: string;
  border: string;
  mutedForeground: string;
  radius: number;
}

interface Props<T extends string | number> {
  label: string;
  /**
   * One line under the pills saying what the choice actually changes.
   *
   * Added for classroom/builder.tsx's «تجهيزات الصف» row, where the two
   * options rewrite the materials list and the on-screen wording but leave
   * the questions alone — a difference invisible until you read both outputs
   * side by side, so the row read as decorative.
   */
  hint?: string;
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  colors: Colors;
  isRTL: boolean;
  accent: string;
  /** Fires a selection haptic on change — only some of the original pill rows did this. */
  haptics?: boolean;
  /** Per-screen pixel override, e.g. game.tsx's wider `{ minWidth: 46, alignItems: 'center' }` pills. */
  pillStyle?: StyleProp<ViewStyle>;
  /**
   * Overrides the wrapper's default `marginBottom: 18` — needed where a
   * caller renders extra content (e.g. game.tsx's team preview chips)
   * directly under the pill row and wants to own the spacing after it.
   */
  containerStyle?: StyleProp<ViewStyle>;
}

export function PillSelector<T extends string | number>({
  label, options, value, onChange, colors, isRTL, accent, hint, haptics = false, pillStyle, containerStyle,
}: Props<T>) {
  return (
    <View style={[{ marginBottom: 18 }, containerStyle]}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (haptics) Haptics.selectionAsync();
                onChange(o.value);
              }}
              style={[
                styles.pill,
                pillStyle,
                {
                  backgroundColor: active ? accent : colors.card,
                  borderColor: active ? accent : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.pillText, {
                color: active ? '#fff' : colors.mutedForeground,
                fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
              }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  pillText: { fontSize: 13 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 6 },
});

/**
 * A labelled dropdown: a pressable value row that expands into a scrollable
 * option list. Used by the AI-tools generator screens for grade, subject,
 * difficulty, duration and the rest; the pill-row pattern used elsewhere
 * lives in PillSelector.
 *
 * This said "activity.tsx was the only screen using this pattern" for a long
 * time, and it was never true: quiz, lesson-plan and worksheet each kept a
 * private copy. The four drifted, so adding one prop meant editing four
 * files. New screens import this — do not copy it.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Colors {
  foreground: string;
  card: string;
  border: string;
  secondary: string;
  mutedForeground: string;
  radius: number;
}

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (index: number) => void;
  colors: Colors;
  isRTL: boolean;
  accent: string;
  /**
   * Index-aligned with `options`: true marks an option that is not offered
   * right now and is left out of the dropdown entirely.
   *
   * The array is index-aligned rather than the caller pre-filtering `options`
   * because these positions are persisted as bare indices elsewhere
   * (`subjectIdx` in formState and route URLs). Hiding is a rendering
   * decision only — `onChange` still reports the option's ORIGINAL index, so
   * a shorter visible list never shifts what a stored index means.
   */
  hidden?: boolean[];
  /** Scrollable height of the open dropdown. quiz and worksheet use 180. */
  maxHeight?: number;
  /**
   * Background of the selected row. Defaults to `colors.secondary`, a fixed
   * teal. quiz, worksheet and the evaluations paper builder pass
   * `accent + '15'` instead, because their accents are amber, violet and teal
   * and a fixed teal row on the first two looks like a bug — that tint is
   * keyed to the screen, not to the theme.
   */
  selectedTint?: string;
}

export function PickerField({ label, value, options, onChange, colors, isRTL, accent, hidden, maxHeight = 200, selectedTint }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: open ? accent : colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight }}>
            {/* `i` is carried through the filter deliberately: it is the index
                onChange must report, not the position in the visible list. */}
            {options
              .map((o, i) => ({ o, i }))
              .filter(({ i }) => hidden?.[i] !== true)
              .map(({ o, i }) => (
                <Pressable
                  key={i}
                  accessibilityState={{ selected: o === value }}
                  onPress={() => { onChange(i); setOpen(false); }}
                  style={[styles.pickerOption, { borderBottomColor: colors.border, backgroundColor: o === value ? selectedTint ?? colors.secondary : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Text style={[{ color: o === value ? accent : colors.foreground, fontFamily: o === value ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{o}</Text>
                  {o === value && <Ionicons name="checkmark" size={16} color={accent} />}
                </Pressable>
              ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  pickerBtn: { alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pickerDropdown: { borderWidth: 1, marginTop: -8, marginBottom: 8, overflow: 'hidden' },
  pickerOption: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
});

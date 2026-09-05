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
   * Index-aligned with `options`: true marks an option that exists in the list
   * but cannot be chosen right now. The entry is still rendered, because the
   * list's positions are persisted as bare indices elsewhere and must not
   * shift — it is greyed and made unpressable, with `disabledNote` saying why.
   */
  disabled?: boolean[];
  disabledNote?: string;
}

export function PickerField({ label, value, options, onChange, colors, isRTL, accent, disabled, disabledNote }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map((o, i) => {
              const isOff = disabled?.[i] === true;
              return (
                <Pressable
                  key={i}
                  disabled={isOff}
                  accessibilityState={{ disabled: isOff, selected: o === value }}
                  onPress={() => { if (isOff) return; onChange(i); setOpen(false); }}
                  style={[styles.pickerOption, { borderBottomColor: colors.border, backgroundColor: !isOff && o === value ? colors.secondary : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Text style={[{ color: isOff ? colors.mutedForeground : (o === value ? accent : colors.foreground), fontFamily: o === value && !isOff ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{o}</Text>
                  {isOff && disabledNote
                    ? <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }]}>{disabledNote}</Text>
                    : o === value && <Ionicons name="checkmark" size={16} color={accent} />}
                </Pressable>
              );
            })}
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

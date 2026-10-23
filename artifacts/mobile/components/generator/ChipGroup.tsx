/**
 * A multi-select as wrapping chips: the quiz's question types. Each chip is a
 * toggle (`aria-pressed`) and a selected one also draws a tick, so the state is
 * never carried by colour alone.
 *
 * `min` is the fewest chips that may stay selected. The last one cannot be
 * cleared when `min` is 1 (the quiz's existing rule: a paper with no question
 * type is not a paper); it is marked disabled instead of silently ignoring the
 * press. The screen keeps its own guard in `onToggle` as well, because the
 * selection it owns is what is saved.
 *
 * An option may be `disabled` (the worksheet's four formats are greyed when the
 * lesson's question bank cannot build them): it is drawn dimmed, is announced
 * `aria-disabled` and ignores presses. A disabled chip does not count towards
 * `min` even if the screen lists it in `selected`, so it can never be what keeps
 * the last enabled chip from being locked. (The worksheet passes its greyed
 * formats unselected anyway, as its old checkboxes drew them.)
 *
 * Options come in the order the screen's source of truth gives them
 * (`QUIZ_TYPE_ORDER` for the quiz), never re-sorted here.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  /** Not offered right now: dimmed, `aria-disabled`, and a press does nothing. */
  disabled?: boolean;
}

export interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  selected: ReadonlySet<T>;
  onToggle: (id: T) => void;
  /** The fewest chips that may stay selected. */
  min?: number;
  accent: string;
}

export function ChipGroup<T extends string>({ label, options, selected, onToggle, min = 0, accent }: ChipGroupProps<T>) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const ink = readableOn(accent, colors.card);
  // Only enabled, selected chips count towards `min`.
  const counted = options.filter(o => !o.disabled && selected.has(o.id)).length;
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View role="group" accessibilityLabel={label} style={[styles.wrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {options.map(option => {
          const on = selected.has(option.id);
          const off = option.disabled === true;
          const locked = on && !off && counted <= min;
          return (
            <PressableScale
              key={option.id}
              accessibilityRole="button"
              aria-pressed={on}
              aria-disabled={locked || off}
              disabled={off}
              accessibilityLabel={option.label}
              onPress={() => {
                if (locked || off) return;
                Haptics.selectionAsync();
                onToggle(option.id);
              }}
              style={[
                styles.chip,
                { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: off ? 0.5 : 1 },
                on
                  ? { backgroundColor: accent + '1F', borderColor: ink }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {on ? <Ionicons name="checkmark" size={ICON.md} color={ink} /> : null}
              <Text style={[styles.text, { color: on ? ink : colors.mutedForeground, fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular' }]}>
                {option.label}
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
  wrap: { flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  text: { fontSize: TYPE.label },
});

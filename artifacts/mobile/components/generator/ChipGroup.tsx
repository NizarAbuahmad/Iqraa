/**
 * A multi-select as wrapping chips: the quiz's question types. Each chip is a
 * toggle (`aria-pressed`) and a selected one also draws a tick, so the state is
 * never carried by colour alone.
 *
 * `single` turns it into a single choice (the activity's type, five labels too
 * long for a segmented control): a radio group whose chips are `radio` with
 * `aria-checked`, exactly one of them in `selected`. Pressing the chosen chip
 * does nothing (no haptic, no `onToggle`: a radio is not switched off), pressing
 * another calls `onToggle` with its id, and the screen moves its index. `min` has
 * no meaning there.
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
import { readableOn, tintOver } from '@/services/readableColor';

/** How much of the accent a selected chip carries (0x1F of 0xFF). */
export const SELECTED_ALPHA = 0x1f / 255;

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
  /** One choice, not several: radio semantics, and the chosen chip is inert. */
  single?: boolean;
  accent: string;
}

export function ChipGroup<T extends string>({ label, options, selected, onToggle, min = 0, single = false, accent }: ChipGroupProps<T>) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  // A selected chip is the accent at 12% over the card, drawn as that one opaque colour so what it sits on
  // is known (the group sits on the page, not on a card). Its label, tick and ring are judged against THAT
  // fill: against the plain card, #C2410C was 4.35:1 on its own tint.
  const selectedFill = tintOver(accent, SELECTED_ALPHA, colors.card);
  const ink = readableOn(accent, selectedFill);
  // Only enabled, selected chips count towards `min`.
  const counted = options.filter(o => !o.disabled && selected.has(o.id)).length;
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View role={single ? 'radiogroup' : 'group'} accessibilityLabel={label} style={[styles.wrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {options.map(option => {
          const on = selected.has(option.id);
          const off = option.disabled === true;
          const locked = !single && on && !off && counted <= min;
          return (
            <PressableScale
              key={option.id}
              accessibilityRole={single ? 'radio' : 'button'}
              aria-pressed={single ? undefined : on}
              aria-checked={single ? on : undefined}
              aria-disabled={locked || off}
              disabled={off}
              accessibilityLabel={option.label}
              onPress={() => {
                if (locked || off || (single && on)) return;
                Haptics.selectionAsync();
                onToggle(option.id);
              }}
              style={[
                styles.chip,
                { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: off ? 0.5 : 1 },
                on
                  ? { backgroundColor: selectedFill, borderColor: ink }
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

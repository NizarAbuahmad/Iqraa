/**
 * Says why the selected option is not in the list it came from.
 *
 * The pickers drop a grade/subject pair with no book instead of greying it
 * (see `subjectsWithoutCurriculum`), but `gradeIdx` / `subjectIdx` still
 * arrive from formState and from URLs bookmarked before any of this existed.
 * When one of those points at a dropped entry the screen looked *normal*: the
 * trigger showed the subject, the dropdown simply did not contain it, and
 * nothing said why until generation refused by name. This is the missing
 * sentence — the greyed row used to carry it, and hiding took it away.
 *
 * It is not the backstop. `scopeWithoutCurriculum` still refuses at generate
 * time, because a note is only seen by someone looking at the field.
 *
 * Deliberately not a fix: repairing the index here would silently swap the
 * teacher's subject for a neighbouring one, which is the failure the whole
 * index-alignment rule exists to prevent. Explain, and let them choose.
 *
 * Shared across all three picker surfaces — PickerField, PillSelector and
 * lesson-flow's chip row — so the rule for when the note appears lives in one
 * place rather than in eight screens.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** Index-aligned with the picker's full option list — the same array passed to the picker. */
  hidden: boolean[] | undefined;
  /** The currently selected position in that full list. */
  index: number;
  message: string;
  isRTL: boolean;
  colors: {
    muted: string;
    mutedForeground: string;
    foreground: string;
    border: string;
  };
};

export function StrandedSelectionNote({ hidden, index, message, isRTL, colors }: Props) {
  if (hidden?.[index] !== true) return null;
  return (
    <View
      style={[
        styles.wrap,
        { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.muted, borderColor: colors.border },
      ]}
      accessibilityRole="text"
    >
      <Ionicons name="alert-circle-outline" size={15} color={colors.mutedForeground} />
      <Text
        style={[
          styles.text,
          { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: -4,
    marginBottom: 16,
  },
  text: { flex: 1, fontSize: 11.5, lineHeight: 18 },
});

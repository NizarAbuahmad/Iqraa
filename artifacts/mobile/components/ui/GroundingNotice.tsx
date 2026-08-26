/**
 * Says whether generated material is anchored to the curriculum.
 *
 * The generators have always known this — `resolveGeneratorGrounding` returns a
 * `grounded` flag and, when it is false, an explicit note telling the model not
 * to claim curriculum backing. The teacher was the only one never told. Two
 * worksheets that look identical on screen can be a lesson from the NCCD book
 * and a generic sheet about a topic that was never matched, and there was no
 * way to tell them apart.
 *
 * That matters most where the app is weakest. Maths draws on a curated bank of
 * real problems; chemistry and financial literacy fall through to templates. A
 * teacher deciding whether to hand something to a class deserves to know which
 * of those they are holding.
 *
 * Deliberately quiet. This is information, not an error: ungrounded output is
 * still useful, it just carries a different claim.
 *
 * `sources`, when present, is a level more specific than `grounded`: the
 * lesson can resolve (`grounded: true`) while the server still finds no
 * extracted book passages for it — most lessons today, since only six books
 * are ingested. When it *is* present, it is the page a teacher can hold the
 * printed book open to and check, not just a lesson-title match.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sourceCitationLine } from '@/services/kbContext';

type GroundedSource = {
  titleAr: string;
  page: number;
};

type Props = {
  grounded: boolean;
  /** Curriculum lesson title, when there is one. */
  lessonTitle?: string | null;
  /** Book pages the server actually attached to the prompt — see `GroundedSource` in AIService.ts. */
  sources?: readonly GroundedSource[];
  isRTL: boolean;
  colors: {
    primary: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    foreground: string;
    border: string;
  };
  labels: {
    grounded: (lesson: string) => string;
    generic: string;
    genericHint: string;
  };
};

export function GroundingNotice({ grounded, lessonTitle, sources, isRTL, colors, labels }: Props) {
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  return (
    <View
      style={[
        styles.wrap,
        {
          flexDirection: rowDir,
          backgroundColor: grounded ? colors.secondary : colors.muted,
          borderColor: grounded ? colors.primary + '40' : colors.border,
        },
      ]}
      accessibilityRole="text"
    >
      <Ionicons
        name={grounded ? 'school' : 'information-circle-outline'}
        size={15}
        color={grounded ? colors.primary : colors.mutedForeground}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            styles.title,
            {
              color: grounded ? colors.primary : colors.foreground,
              fontFamily: 'Cairo_600SemiBold',
              textAlign: align,
            },
          ]}
        >
          {grounded ? labels.grounded(lessonTitle ?? '') : labels.generic}
        </Text>
        {grounded && sources && sources.length > 0 && (
          <Text
            style={[
              styles.hint,
              {
                color: colors.primary,
                fontFamily: 'Almarai_400Regular',
                textAlign: align,
              },
            ]}
          >
            {sourceCitationLine(sources, isRTL)}
          </Text>
        )}
        {grounded ? null : (
          <Text
            style={[
              styles.hint,
              {
                color: colors.mutedForeground,
                fontFamily: 'Almarai_400Regular',
                textAlign: align,
              },
            ]}
          >
            {labels.genericHint}
          </Text>
        )}
      </View>
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
    marginBottom: 12,
  },
  title: { fontSize: 12.5, lineHeight: 19 },
  hint: { fontSize: 11.5, lineHeight: 18 },
});

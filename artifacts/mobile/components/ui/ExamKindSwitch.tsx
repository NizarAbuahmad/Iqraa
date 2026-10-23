import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { EXAM_KINDS, examKindDef, type ExamKind } from '@/services/examKind';
import { SPACE, TYPE } from '@/constants/theme';
import { textOn } from '@/services/readableColor';

/**
 * Printed paper or marked evaluation — the two halves of the Tools tab's one
 * «اختبارات وتقييمات» card. Each half is its own screen, so the other segment
 * `replace`s rather than pushes: back from either lands on the Tools tab, not
 * on the screen the teacher just left.
 *
 * The hint under the active segment is the point of the control: the old
 * «أداة تقييم» label was mistaken for «التقييمات» because nothing said what
 * each one gives you.
 *
 * `accent` is the screen's own tool colour (the quiz passes its concept colour,
 * so the tab row matches the band above it). Without it the selected segment is
 * the primary teal, as on the evaluations screen.
 */
export function ExamKindSwitch({ active, accent }: { active: ExamKind; accent?: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  return (
    <View>
      <View
        accessibilityRole="tablist"
        style={[
          styles.track,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        {EXAM_KINDS.map(k => {
          const on = k.id === active;
          return (
            <Pressable
              key={k.id}
              accessibilityRole="tab"
              aria-selected={on}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync();
                router.replace(k.route as never);
              }}
              style={[
                styles.segment,
                { borderRadius: colors.radius - 2, backgroundColor: on ? (accent ?? colors.primary) : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: on ? (accent ? textOn(accent) : colors.primaryForeground) : colors.mutedForeground,
                    fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
                  },
                ]}
              >
                {t(k.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {t(examKindDef(active).hintKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { padding: SPACE.xs, borderWidth: 1 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm },
  label: { fontSize: TYPE.label, textAlign: 'center' },
  hint: { fontSize: TYPE.caption, lineHeight: 20, marginTop: SPACE.sm },
});

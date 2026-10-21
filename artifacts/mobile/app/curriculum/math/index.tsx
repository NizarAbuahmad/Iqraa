/**
 * Math Corner — the hub: one card per tool, plus a link-out to GeoGebra.
 *
 * Reached from the library's «زاوية الرياضيات» tile. Student-reachable with no
 * gating change: `/curriculum` is already on the non-teacher allowlist and
 * matches by prefix (pinned in routeGating.test.ts). Every tool is first-party
 * and runs offline; GeoGebra is a link to their website, never an embed.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { MATH_TOOLS, MATH_TOOL_IDS, mathToolPath } from '@/services/mathTools';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { GeogebraLink } from '@/components/math/GeogebraLink';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export default function MathCornerScreen() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  return (
    <CornerFrame title={t('mathTitle')} subtitle={t('mathIntro')}>
      <CornerGrid>
        {MATH_TOOL_IDS.map(id => {
          const meta = MATH_TOOLS[id];
          return (
            <Pressable
              key={id}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(mathToolPath(id) as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t(meta.titleKey)}, ${t(meta.hintKey)}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={meta.icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {t(meta.titleKey)}
                </Text>
                <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
                  {t(meta.hintKey)}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
        <GeogebraLink />
      </CornerGrid>
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 1, alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.lg },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPE.body },
  hint: { fontSize: TYPE.caption, marginTop: SPACE.xxs },
});

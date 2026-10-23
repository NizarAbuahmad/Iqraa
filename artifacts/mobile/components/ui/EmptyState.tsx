import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useSurface } from './Surface';
import { Button } from './Button';

/**
 * What a list says when it has nothing in it yet: a lifted card with the icon
 * on a tinted circle, one line on what is missing, one on what it is for, and —
 * when there is one — the action that fills it.
 *
 * Four screens drew this with the same three hand-copied styles, and none of
 * them offered the action until the 2026-10-08 review added a button to each
 * by hand. A new list starts here instead. Since 2026-10-22 it is a card
 * (useSurface) rather than bare text on the page, and School's two hand-drawn
 * empties use it too.
 *
 * The icon is `colors.primary` on `colors.secondary`: 5.40:1 in light and
 * 7.57:1 in dark, against the 3:1 an icon needs.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  /** The outer wrapper: a screen that already pads its section passes `{ paddingTop: 0, paddingHorizontal: 0 }`. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const surface = useSurface();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.card, surface]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Ionicons name={icon} size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {body ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text> : null}
        {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: SPACE.sm }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: SPACE.section, paddingHorizontal: SPACE.lg, alignItems: 'center' },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xl },
  iconCircle: { width: 64, height: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xs },
  title: { fontSize: TYPE.bodyLg, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  body: { fontSize: TYPE.body, lineHeight: 24, maxWidth: 300, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
});

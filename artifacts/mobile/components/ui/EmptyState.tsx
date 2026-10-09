import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from './Button';

/**
 * What a list says when it has nothing in it yet: an icon, one line on what
 * is missing, one on what it is for, and — when there is one — the action
 * that fills it.
 *
 * Four screens drew this with the same three hand-copied styles, and none of
 * them offered the action until the 2026-10-08 review added a button to each
 * by hand. A new list starts here instead.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 24 },
  title: { fontSize: 17, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 24, maxWidth: 280, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
});

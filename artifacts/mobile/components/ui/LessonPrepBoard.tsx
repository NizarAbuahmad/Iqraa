/**
 * "What is still missing for this lesson?" — the five rows, one renderer.
 *
 * Two surfaces ask the question: the desktop workspace home, and the chat's
 * empty state on a phone (where the alternative was a logo, a pitch line and
 * two chips above 400px of nothing). They must answer it identically — a
 * board that ticks a worksheet on one screen and not the other is worse than
 * no board — so the rows live here and `buildPrepBoard` decides what they say.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PrepRow } from '@/services/lessonBoard';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
};

export function LessonPrepBoard({
  rows,
  colors,
  isRTL,
  isAr,
  disabled,
  openLabel,
  makeLabel,
  onOpen,
  onMake,
  compact,
}: {
  rows: PrepRow[];
  colors: Colors;
  isRTL: boolean;
  isAr: boolean;
  /** No lesson to prepare — rows still show, the actions do not fire. */
  disabled?: boolean;
  openLabel: string;
  makeLabel: string;
  onOpen: (row: PrepRow) => void;
  onMake: (row: PrepRow) => void;
  /** Phone: tighter rows, and the action is an arrow rather than a sentence. */
  compact?: boolean;
}) {
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;

  return (
    <View style={{ gap: compact ? 6 : 8, width: '100%' }}>
      {rows.map(row => (
        <View
          key={row.type}
          style={[
            styles.row,
            compact && styles.rowCompact,
            { borderColor: colors.border, backgroundColor: colors.card, flexDirection: rowDir },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              compact && styles.labelCompact,
              { color: colors.foreground, textAlign: align, flex: 1 },
            ]}
          >
            {row.emoji}  {isAr ? row.labelAr : row.labelEn}
            {row.count > 1 ? `  ·  ${row.count}` : ''}
          </Text>
          {row.done ? (
            <Pressable onPress={() => onOpen(row)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.action, { color: colors.mutedForeground }]}>{openLabel}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onMake(row)}
              disabled={disabled}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={makeLabel}
            >
              <Text style={[styles.action, { color: disabled ? colors.mutedForeground : colors.primary }]}>
                {makeLabel} {isRTL ? '←' : '→'}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowCompact: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 11, gap: 9 },
  label: { fontSize: 13.5, fontFamily: 'Cairo_500Medium' },
  labelCompact: { fontSize: 12.5 },
  action: { fontSize: 12.5, fontFamily: 'Cairo_600SemiBold' },
});

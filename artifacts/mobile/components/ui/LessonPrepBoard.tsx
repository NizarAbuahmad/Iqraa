/**
 * "What is still missing for this lesson?" — the five rows, one renderer.
 *
 * Two surfaces ask the question: the desktop workspace home, and the chat's
 * empty state on a phone (where the alternative was a logo, a pitch line and
 * two chips above 400px of nothing). They must answer it identically — a
 * board that ticks a worksheet on one screen and not the other is worse than
 * no board — so the rows live here and `buildPrepBoard` decides what they say.
 *
 * Each row is one tap target: the icon tile fills and gains a tick badge when
 * the material exists, the second line says so, and the whole row opens it or
 * starts it. The old rows put an empty radio, an emoji and the same
 * «أنشئها الآن ←» link five times side by side; the progress was a bare
 * «0/5» floating beside the title.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PrepRow } from '@/services/lessonBoard';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
};

export function LessonPrepBoard({
  rows,
  colors,
  isRTL,
  isAr,
  disabled,
  title,
  readyLabel,
  openLabel,
  makeLabel,
  createLabel,
  notYetLabel,
  doneLabel,
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
  /** «جاهزية الدرس» and «0 من 5 جاهزة» above a progress bar. */
  title: string;
  readyLabel: string;
  openLabel: string;
  /** Accessibility label for a row that starts a material. */
  makeLabel: string;
  createLabel: string;
  notYetLabel: string;
  doneLabel: string;
  onOpen: (row: PrepRow) => void;
  onMake: (row: PrepRow) => void;
  /** Phone: tighter rows. */
  compact?: boolean;
}) {
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);
  const align = isRTL ? ('right' as const) : ('left' as const);
  const done = rows.filter(r => r.done).length;
  const pct = rows.length ? done / rows.length : 0;
  /*
    Only the first missing row gets a filled button. Three identical outlined
    «أنشئ» pills read as three equal choices; one filled one says "this next",
    in the order a teacher prepares. The rest stay tappable (the whole row is
    the target) and show a quiet link.
  */
  const nextType = disabled ? null : rows.find(r => !r.done)?.type ?? null;

  return (
    <View style={{ gap: compact ? 6 : 8, width: '100%' }}>
      <View style={[styles.head, { flexDirection: rowDir }]}>
        <Text style={[styles.headTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.headCount, { color: done ? colors.primary : colors.mutedForeground }]}>{readyLabel}</Text>
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: rows.length, now: done }}
      >
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: colors.primary },
            isRTL ? { right: 0 } : { left: 0 },
          ]}
        />
      </View>

      <View style={{ gap: compact ? 6 : 8, marginTop: 6 }}>
        {rows.map(row => {
          const label = isAr ? row.labelAr : row.labelEn;
          const status = row.done ? (row.count > 1 ? `${doneLabel} · ${row.count}` : doneLabel) : notYetLabel;
          return (
            <Pressable
              key={row.type}
              onPress={() => (row.done ? onOpen(row) : onMake(row))}
              disabled={!row.done && disabled}
              accessibilityRole="button"
              accessibilityLabel={`${label} — ${row.done ? openLabel : makeLabel}`}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.row,
                compact && styles.rowCompact,
                {
                  flexDirection: rowDir,
                  borderColor: colors.border,
                  backgroundColor: pressed || hovered ? colors.secondary : colors.card,
                },
              ]}
            >
              {/*
                The tile keeps the material's own icon when done — a bare tick
                made every finished row look the same — and a corner badge
                carries the "done".
              */}
              <View
                style={[
                  styles.tile,
                  compact && styles.tileCompact,
                  { backgroundColor: row.done ? colors.primary : colors.secondary },
                ]}
              >
                <Ionicons
                  name={row.icon as keyof typeof Ionicons.glyphMap}
                  size={compact ? 16 : 18}
                  color={row.done ? colors.primaryForeground : colors.primary}
                />
                {row.done ? (
                  <View
                    style={[
                      styles.badge,
                      isRTL ? { left: -5 } : { right: -5 },
                      { backgroundColor: colors.card, borderColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="checkmark" size={10} color={colors.primary} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={[styles.label, compact && styles.labelCompact, { color: colors.foreground, textAlign: align }]}>
                  {label}
                </Text>
                <Text numberOfLines={1} style={[styles.status, { color: row.done ? colors.primary : colors.mutedForeground, textAlign: align }]}>
                  {status}
                </Text>
              </View>
              {row.done ? (
                <View style={[styles.cta, { flexDirection: rowDir }]}>
                  <Text style={[styles.ctaText, { color: colors.mutedForeground }]}>{openLabel}</Text>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.mutedForeground} />
                </View>
              ) : row.type === nextType ? (
                <View style={[styles.cta, styles.ctaMake, { flexDirection: rowDir, backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{createLabel}</Text>
                </View>
              ) : (
                <View style={[styles.cta, { flexDirection: rowDir }]}>
                  <Ionicons name="add" size={15} color={disabled ? colors.mutedForeground : colors.primary} />
                  <Text style={[styles.ctaText, { color: disabled ? colors.mutedForeground : colors.primary }]}>{createLabel}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'baseline', justifyContent: 'space-between' },
  headTitle: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  headCount: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  row: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowCompact: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, gap: 10 },
  tile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileCompact: { width: 34, height: 34, borderRadius: 9 },
  badge: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  labelCompact: { fontSize: 13.5 },
  status: { fontSize: 12.5, lineHeight: 19, fontFamily: 'Almarai_400Regular' },
  cta: { alignItems: 'center', gap: 3 },
  ctaMake: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  ctaText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
});

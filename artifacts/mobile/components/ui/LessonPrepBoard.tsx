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
import { missingPrepView, prepSummary, savedAgo, type PrepRow } from '@/services/lessonBoard';

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
  onToggleSkip,
  skipLabel,
  skipShortLabel,
  skippedLabel,
  restoreLabel,
  classLabelFor,
  onOpenAll,
  allCopiesLabel,
  compact,
  fold,
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
  /**
   * Mark a missing row «غير مطلوب» for this lesson, or bring it back. Without
   * it the board has no skip control. A skipped row leaves the count, gets no
   * «أنشئ», and tapping it restores it.
   */
  onToggleSkip?: (row: PrepRow) => void;
  /** Accessibility label of the skip control, e.g. «غير مطلوب لهذا الدرس». */
  skipLabel?: string;
  /**
   * The word printed on the skip control, e.g. «تخطّي». Without it the control
   * is a bare eye-off icon — which five rows in a column turned into five
   * identical grey glyphs that nobody read as a button, let alone as "not
   * needed for this lesson". A word is the affordance; `skipLabel` stays the
   * full sentence for screen readers.
   */
  skipShortLabel?: string;
  /** Status line of a skipped row. */
  skippedLabel?: string;
  /** The skipped row's action, e.g. «أعِده». */
  restoreLabel?: string;
  /** Name of the class a material is filed under, for the done row's status line. */
  classLabelFor?: (classGroupId: string) => string | null;
  /**
   * Every copy of this row's material for the lesson. Shown as a small count
   * button when there are two or more; «افتح» itself opens the newest.
   */
  onOpenAll?: (row: PrepRow) => void;
  /** Accessibility label of that button, e.g. «كل النسخ». */
  allCopiesLabel?: string;
  /** Phone: tighter rows. */
  compact?: boolean;
  /**
   * The chat on a phone: the board folds to its head line, and unfolded lists
   * only the rows still to make (`missingPrepView`). Made rows are reached
   * through `onShowReady`; skipped ones stay as small restore chips. Without
   * it the board shows all five rows, as the desktop home does.
   */
  fold?: {
    open: boolean;
    onToggle: () => void;
    /** Accessibility hint of the head line, e.g. «اعرض ما ينقص». */
    toggleLabel: string;
    /** Shown unfolded when nothing is missing. */
    allReadyLabel: string;
    /** «المواد الجاهزة (2)» — empty to leave the link out. */
    showReadyLabel: string;
    onShowReady: () => void;
  };
}) {
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);
  const align = isRTL ? ('right' as const) : ('left' as const);
  const { done, total } = prepSummary(rows);
  const pct = total ? done / total : 0;
  /*
    Only the first missing row gets a filled button. Three identical outlined
    «أنشئ» pills read as three equal choices; one filled one says "this next",
    in the order a teacher prepares. The rest stay tappable (the whole row is
    the target) and show a quiet link.
  */
  const nextType = disabled ? null : rows.find(r => !r.done && !r.skipped)?.type ?? null;
  const view = fold ? missingPrepView(rows) : null;
  const shownRows = view ? view.missing : rows;

  const track = (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, backgroundColor: colors.primary },
          isRTL ? { right: 0 } : { left: 0 },
        ]}
      />
    </View>
  );

  return (
    <View style={{ gap: compact ? 6 : 8, width: '100%' }}>
      {fold ? (
        /*
          Folded, this one line is the whole board: title, count, chevron and
          the bar under them, one tap target that unfolds the missing rows.
        */
        <Pressable
          onPress={fold.onToggle}
          accessibilityRole="button"
          aria-expanded={fold.open}
          accessibilityLabel={`${title} — ${readyLabel}`}
          accessibilityHint={fold.toggleLabel}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.foldHead,
            { borderColor: colors.border, backgroundColor: pressed || hovered ? colors.secondary : colors.card },
          ]}
        >
          <View style={[styles.head, styles.foldHeadRow, { flexDirection: rowDir }]}>
            <Text style={[styles.headTitle, { color: colors.foreground }]}>{title}</Text>
            <View style={[styles.foldCount, { flexDirection: rowDir }]}>
              <Text style={[styles.headCount, { color: done ? colors.primary : colors.mutedForeground }]}>{readyLabel}</Text>
              <Ionicons name={fold.open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </View>
          </View>
          {track}
        </Pressable>
      ) : (
        <>
          <View style={[styles.head, { flexDirection: rowDir }]}>
            <Text style={[styles.headTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.headCount, { color: done ? colors.primary : colors.mutedForeground }]}>{readyLabel}</Text>
          </View>
          {track}
        </>
      )}

      {fold && !fold.open ? null : (
      <View style={{ gap: compact ? 6 : 8, marginTop: 6 }}>
        {view && !view.missing.length ? (
          <View style={[styles.allReady, { flexDirection: rowDir, backgroundColor: colors.secondary }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={[styles.ctaText, { flex: 1, color: colors.primary, textAlign: align }]}>{fold?.allReadyLabel}</Text>
          </View>
        ) : null}
        {shownRows.map(row => {
          const label = isAr ? row.labelAr : row.labelEn;
          // «جاهزة · أمس · العاشر أ» — when the newest copy was saved and the
          // class it is filed under. The count moves to its own button when
          // there is one to open them all; otherwise it stays in the line.
          const classLabel = row.material?.classGroupId ? classLabelFor?.(row.material.classGroupId) ?? null : null;
          const status = row.done
            ? [
                doneLabel,
                row.count > 1 && !onOpenAll ? String(row.count) : '',
                row.material ? savedAgo(row.material.savedAt, new Date(), isAr ? 'ar' : 'en') : '',
                classLabel ?? '',
              ].filter(Boolean).join(' · ')
            : row.skipped ? (skippedLabel ?? notYetLabel) : notYetLabel;
          const showAll = !!onOpenAll && row.done && row.count > 1;
          const canSkip = !!onToggleSkip && !disabled && !row.done;
          /*
            The row and its skip control are sibling buttons inside one
            bordered frame, not one inside the other: on web a Pressable is a
            <button>, and a button inside a button is invalid HTML that screen
            readers and keyboards handle badly.
          */
          return (
            <View
              key={row.type}
              style={[styles.frame, { flexDirection: rowDir, borderColor: colors.border, backgroundColor: colors.card }]}
            >
            <Pressable
              onPress={() => (row.done ? onOpen(row) : row.skipped ? onToggleSkip?.(row) : onMake(row))}
              disabled={!row.done && disabled}
              accessibilityRole="button"
              accessibilityLabel={`${label} — ${row.done ? openLabel : row.skipped ? restoreLabel ?? '' : makeLabel}`}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.row,
                compact && styles.rowCompact,
                {
                  flexDirection: rowDir,
                  backgroundColor: pressed || hovered ? colors.secondary : 'transparent',
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
                  row.skipped && styles.dim,
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
              <View style={[{ flex: 1, gap: 1 }, row.skipped && styles.dim]}>
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
              ) : row.skipped ? (
                <View style={[styles.cta, { flexDirection: rowDir }]}>
                  <Ionicons name="refresh" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.ctaText, { color: colors.mutedForeground }]}>{restoreLabel}</Text>
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
              {canSkip && !row.skipped ? (
                <Pressable
                  onPress={() => onToggleSkip?.(row)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} — ${skipLabel ?? ''}`}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.skip,
                    skipShortLabel ? [styles.skipWide, { flexDirection: rowDir }] : null,
                    { backgroundColor: pressed || hovered ? colors.border : 'transparent' },
                  ]}
                >
                  <Ionicons name="eye-off-outline" size={skipShortLabel ? 14 : 16} color={colors.mutedForeground} />
                  {skipShortLabel ? (
                    <Text numberOfLines={1} style={[styles.skipText, { color: colors.mutedForeground }]}>{skipShortLabel}</Text>
                  ) : null}
                </Pressable>
              ) : null}
              {showAll ? (
                <Pressable
                  onPress={() => onOpenAll?.(row)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} — ${allCopiesLabel ?? ''} (${row.count})`}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.skip,
                    styles.copies,
                    { flexDirection: rowDir, backgroundColor: pressed || hovered ? colors.border : colors.secondary },
                  ]}
                >
                  <Ionicons name="layers-outline" size={14} color={colors.primary} />
                  <Text style={[styles.copiesText, { color: colors.primary }]}>{row.count}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {view && view.skipped.length && onToggleSkip ? (
          <View style={[styles.chips, { flexDirection: rowDir }]}>
            {view.skipped.map(row => {
              const label = isAr ? row.labelAr : row.labelEn;
              return (
                <Pressable
                  key={row.type}
                  onPress={() => onToggleSkip(row)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} — ${skippedLabel ?? ''} — ${restoreLabel ?? ''}`}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.chip,
                    { flexDirection: rowDir, borderColor: colors.border, backgroundColor: pressed || hovered ? colors.secondary : 'transparent' },
                  ]}
                >
                  <Ionicons name="refresh" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {view && view.readyCount && fold?.showReadyLabel ? (
          <Pressable
            onPress={fold.onShowReady}
            accessibilityRole="link"
            style={[styles.cta, styles.readyLink, { flexDirection: rowDir, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name="folder-open-outline" size={14} color={colors.primary} />
            <Text style={[styles.ctaText, { color: colors.primary }]}>{fold.showReadyLabel}</Text>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'baseline', justifyContent: 'space-between' },
  headTitle: { fontSize: 15, fontFamily: 'ReadexPro_600SemiBold' },
  headCount: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  frame: { alignItems: 'center', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowCompact: { paddingVertical: 8, paddingHorizontal: 10, gap: 10 },
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
  label: { fontSize: 14, fontFamily: 'ReadexPro_600SemiBold' },
  labelCompact: { fontSize: 14 },
  status: { fontSize: 15, lineHeight: 22, fontFamily: 'Almarai_400Regular' },
  cta: { alignItems: 'center', gap: 3 },
  ctaMake: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  skip: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  skipWide: { width: 'auto', height: 30, borderRadius: 15, paddingHorizontal: 9, gap: 4 },
  skipText: { fontSize: 12, fontFamily: 'ReadexPro_600SemiBold' },
  dim: { opacity: 0.5 },
  copies: { width: undefined, paddingHorizontal: 9, gap: 3 },
  copiesText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  ctaText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  foldHead: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 8 },
  foldHeadRow: { alignItems: 'center' },
  foldCount: { alignItems: 'center', gap: 4 },
  allReady: { alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: { alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  readyLink: { paddingVertical: 4 },
});

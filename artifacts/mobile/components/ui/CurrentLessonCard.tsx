/**
 * Persistent "Current Lesson" card for the IQRA chat.
 *
 * Previously this rendered the five resources twice — once as a "○ / ✓" text
 * row and again as a chip strip — on top of four separate metadata lines, which
 * made the tallest element on screen also the least readable. Now there is one
 * resource strip where the chip itself carries its done state, and readiness is
 * summarised by a single progress bar.
 *
 * Collapses to a one-line bar once the teacher scrolls the conversation.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HScrollRow } from './HScrollRow';
import type { CurrentLessonView, ResourceChip } from '@/services/lessonCopilot';
import type { SessionArtifact } from '@/services/ai/teachingAssistant';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  success?: string;
};

type Props = {
  lesson: CurrentLessonView;
  collapsed: boolean;
  isRTL: boolean;
  lang: 'ar' | 'en';
  colors: Colors;
  changeLabel: string;
  uploadedLabel: (n: number) => string;
  /** "3 of 5 ready" — supplied by the screen so wording stays in i18n. */
  readinessLabel: (done: number, total: number) => string;
  readyLabel: string;
  onChangeLesson: () => void;
  onToggleCollapse: () => void;
  onResourcePress: (type: SessionArtifact, done: boolean) => void;
};

export function CurrentLessonCard({
  lesson,
  collapsed,
  isRTL,
  lang,
  colors,
  changeLabel,
  uploadedLabel,
  readinessLabel,
  readyLabel,
  onChangeLesson,
  onToggleCollapse,
  onResourcePress,
}: Props) {
  const align = isRTL ? ('right' as const) : ('left' as const);
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);
  const done = lesson.resources.filter(r => r.done).length;
  const total = lesson.resources.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const doneColor = colors.success ?? '#10B981';

  if (collapsed) {
    return (
      <Pressable
        onPress={onToggleCollapse}
        style={[
          styles.collapsed,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            flexDirection: rowDir,
          },
        ]}
        accessibilityRole="button"
      >
        <View style={[styles.collapsedDot, { backgroundColor: colors.primary }]} />
        <Text
          numberOfLines={1}
          style={[styles.collapsedTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}
        >
          {lesson.topic}
        </Text>

        {/* Readiness as five pips — keeps the signal without a second row. */}
        <View style={[styles.pips, { flexDirection: rowDir }]}>
          {lesson.resources.map(r => (
            <View
              key={r.type}
              style={[
                styles.pip,
                { backgroundColor: r.done ? doneColor : colors.border },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={onChangeLesson}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={changeLabel}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.primary + '14', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
        </Pressable>
        <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {/* ── Title block ─────────────────────────────────────────────── */}
      <View style={[styles.titleRow, { flexDirection: rowDir }]}>
        <View style={[styles.accent, { backgroundColor: colors.primary }]} />
        <Pressable onPress={onToggleCollapse} style={{ flex: 1, gap: 2 }}>
          <View style={[styles.breadcrumb, { flexDirection: rowDir }]}>
            <Text
              numberOfLines={1}
              style={[styles.crumbText, { color: colors.mutedForeground, textAlign: align }]}
            >
              {lesson.curriculumLabel}
            </Text>
            <View style={[styles.crumbSep, { backgroundColor: colors.mutedForeground }]} />
            <Text
              numberOfLines={1}
              style={[styles.crumbText, { color: colors.mutedForeground, textAlign: align, flexShrink: 1 }]}
            >
              {lesson.subjectGrade}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            style={[styles.topic, { color: colors.foreground, textAlign: align }]}
          >
            {lesson.topic}
          </Text>
        </Pressable>

        <Pressable
          onPress={onChangeLesson}
          accessibilityRole="button"
          accessibilityLabel={changeLabel}
          style={({ pressed }) => [
            styles.changeBtn,
            {
              borderColor: colors.primary + '40',
              backgroundColor: colors.primary + '10',
              flexDirection: rowDir,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
          <Text style={[styles.changeBtnText, { color: colors.primary }]}>{changeLabel}</Text>
        </Pressable>

        <Pressable onPress={onToggleCollapse} hitSlop={8} style={styles.chevron}>
          <Ionicons name="chevron-up" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Readiness ───────────────────────────────────────────────── */}
      <View style={[styles.metaRow, { flexDirection: rowDir }]}>
        <Text
          style={[
            styles.readiness,
            { color: allDone ? doneColor : colors.mutedForeground, textAlign: align },
          ]}
        >
          {allDone ? `✓ ${readyLabel}` : readinessLabel(done, total)}
        </Text>
        {lesson.uploadedCount > 0 ? (
          <View style={[styles.filePill, { backgroundColor: colors.muted, flexDirection: rowDir }]}>
            <Ionicons name="document-attach-outline" size={11} color={colors.mutedForeground} />
            <Text style={[styles.filePillText, { color: colors.mutedForeground }]}>
              {uploadedLabel(lesson.uploadedCount)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: allDone ? doneColor : colors.primary,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </View>

      {/* ── One resource strip: chip carries its own done state ─────── */}
      <HScrollRow isRTL={isRTL} contentContainerStyle={styles.strip}>
        {lesson.resources.map((r: ResourceChip) => (
          <Pressable
            key={r.type}
            onPress={() => onResourcePress(r.type, r.done)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: r.done ? doneColor + '55' : colors.border,
                backgroundColor: r.done ? doneColor + '12' : colors.muted,
                flexDirection: rowDir,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {r.done ? (
              <Ionicons name="checkmark-circle" size={13} color={doneColor} />
            ) : (
              <Text style={styles.chipEmoji}>{r.emoji}</Text>
            )}
            <Text
              style={[
                styles.chipText,
                {
                  color: r.done ? doneColor : colors.foreground,
                  fontFamily: r.done ? 'Inter_600SemiBold' : 'Inter_500Medium',
                },
              ]}
            >
              {lang === 'ar' ? r.labelAr : r.labelEn}
            </Text>
          </Pressable>
        ))}
      </HScrollRow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },

  // Collapsed
  collapsed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 8,
  },
  collapsedDot: { width: 6, height: 6, borderRadius: 3 },
  collapsedTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pips: { gap: 3, alignItems: 'center' },
  pip: { width: 12, height: 3, borderRadius: 2 },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expanded
  titleRow: { alignItems: 'center', gap: 10 },
  accent: { width: 3, height: 30, borderRadius: 2 },
  breadcrumb: { alignItems: 'center', gap: 6 },
  crumbText: { fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 0.1 },
  crumbSep: { width: 2, height: 2, borderRadius: 1, opacity: 0.6 },
  topic: { fontFamily: 'Inter_700Bold', fontSize: 14.5, lineHeight: 20 },
  changeBtn: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
  },
  changeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5 },
  chevron: { padding: 2 },

  metaRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  readiness: { fontFamily: 'Inter_500Medium', fontSize: 11.5 },
  filePill: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  filePillText: { fontFamily: 'Inter_400Regular', fontSize: 10.5 },

  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },

  strip: { gap: 8, paddingTop: 2, paddingBottom: 2 },
  chip: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 12 },
  chipText: { fontSize: 12 },
});

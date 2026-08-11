/**
 * Compact persistent "Current Lesson" card for IQRA chat (Investor MVP).
 * Collapses after the teacher scrolls the conversation.
 *
 * The prep state is shown once — as a progress bar plus chips that carry their
 * own done/not-done mark. An earlier version printed the same five resources
 * twice (a "✓ / ○" text line above an identical chip strip), which read as a
 * bug rather than a summary.
 */
import { HScrollRow } from './HScrollRow';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CurrentLessonView, ResourceChip } from '@/services/lessonCopilot';
import type { SessionArtifact } from '@/services/ai/teachingAssistant';

/** Carried over from the home screen's Start Class button. */
const START_CLASS_COLOR = '#B45309';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  background: string;
  success: string;
};

type Props = {
  lesson: CurrentLessonView;
  collapsed: boolean;
  isRTL: boolean;
  lang: 'ar' | 'en';
  colors: Colors;
  changeLabel: string;
  /**
   * Start Class. Optional so the card still renders where there is no
   * projector flow to enter; both are omitted together or shown together.
   */
  startClassLabel?: string;
  onStartClass?: () => void;
  /** Disables the Start button while its deck is being built. */
  startClassBusy?: boolean;
  uploadedLabel: (n: number) => string;
  /** e.g. "2 من 5 جاهزة" — already localised by the caller. */
  progressLabel: string;
  /** Shown instead of the progress label when every resource is done. */
  allReadyLabel: string;
  onChangeLesson: () => void;
  onToggleCollapse: () => void;
  onResourcePress: (type: SessionArtifact, done: boolean) => void;
  /** Centres the card content on wide (web) viewports. */
  maxWidth?: number;
};

export function CurrentLessonCard({
  lesson,
  collapsed,
  isRTL,
  lang,
  colors,
  changeLabel,
  startClassLabel,
  onStartClass,
  startClassBusy = false,
  uploadedLabel,
  progressLabel,
  allReadyLabel,
  onChangeLesson,
  onToggleCollapse,
  onResourcePress,
  maxWidth,
}: Props) {
  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;
  const inner = maxWidth ? { width: '100%' as const, maxWidth, alignSelf: 'center' as const } : null;

  const total = lesson.resources.length;
  const done = lesson.resources.filter(r => r.done).length;
  const ratio = total > 0 ? done / total : 0;
  const allReady = total > 0 && done === total;

  if (collapsed) {
    return (
      <View
        style={[
          styles.collapsed,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.collapsedInner, inner, { flexDirection: rowDir }]}>
          <Pressable
            onPress={onChangeLesson}
            hitSlop={8}
            style={({ pressed }) => [
              styles.changeBtnCompact,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={changeLabel}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
          </Pressable>

          <Pressable
            onPress={onToggleCollapse}
            style={[styles.collapsedMain, { flexDirection: rowDir, flex: 1 }]}
          >
            <Text style={{ fontSize: 13 }}>🇯🇴</Text>
            <Text
              numberOfLines={1}
              style={[styles.collapsedTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}
            >
              {lesson.unitLesson}
            </Text>
            <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.countPillText, { color: colors.primary }]}>
                {done}/{total}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={[inner, { gap: 10 }]}>
        {/* Breadcrumb + title + change CTA */}
        <View style={[styles.headerRow, { flexDirection: rowDir }]}>
          <Pressable onPress={onToggleCollapse} style={{ flex: 1, gap: 3 }}>
            <View style={[styles.crumbRow, { flexDirection: rowDir }]}>
              <Text style={{ fontSize: 12 }}>🇯🇴</Text>
              <Text
                numberOfLines={1}
                style={[styles.curriculum, { color: colors.mutedForeground, textAlign: align, flex: 1 }]}
              >
                {lesson.curriculumLabel} · {lesson.subjectGrade}
              </Text>
              <Ionicons name="chevron-up" size={15} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.unit, { color: colors.foreground, textAlign: align }]} numberOfLines={2}>
              {lesson.unitLesson}
            </Text>
          </Pressable>

          <Pressable
            onPress={onChangeLesson}
            style={({ pressed }) => [
              styles.changeBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.primary + '40',
                opacity: pressed ? 0.85 : 1,
                flexDirection: rowDir,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={changeLabel}
          >
            <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
            <Text style={[styles.changeBtnText, { color: colors.primary }]}>{changeLabel}</Text>
          </Pressable>
        </View>

        {/* Prep progress — stated once */}
        <View style={[styles.progressRow, { flexDirection: rowDir }]}>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: allReady ? colors.success : colors.primary,
                  width: `${Math.round(ratio * 100)}%`,
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                },
              ]}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.progressText,
              { color: allReady ? colors.success : colors.mutedForeground, textAlign: align },
            ]}
          >
            {allReady ? allReadyLabel : progressLabel}
            {lesson.uploadedCount > 0 ? ` · ${uploadedLabel(lesson.uploadedCount)}` : ''}
          </Text>
        </View>

        {/* Resource chips carry their own state — tap to generate or open */}
        <HScrollRow
          isRTL={isRTL}
          contentContainerStyle={styles.resourceStrip}
        >
          {lesson.resources.map((r: ResourceChip) => (
            <Pressable
              key={r.type}
              onPress={() => onResourcePress(r.type, r.done)}
              style={({ pressed }) => [
                styles.resourceChip,
                {
                  borderColor: r.done ? colors.success + '66' : colors.border,
                  backgroundColor: r.done ? colors.success + '1A' : colors.background,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: rowDir,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.resourceEmoji}>{r.emoji}</Text>
              <Text
                style={[
                  styles.resourceText,
                  { color: r.done ? colors.success : colors.foreground },
                ]}
              >
                {lang === 'ar' ? r.labelAr : r.labelEn}
              </Text>
              <Ionicons
                name={r.done ? 'checkmark-circle' : 'add-circle-outline'}
                size={13}
                color={r.done ? colors.success : colors.mutedForeground}
              />
            </Pressable>
          ))}
        </HScrollRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  // Matches the chat column so the lesson context sits over the thread rather
  // than sprawling to the window edge on desktop.
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  collapsed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  collapsedInner: { alignItems: 'center', gap: 8 },
  collapsedMain: { alignItems: 'center', gap: 8 },
  collapsedTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9 },
  countPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },

  headerRow: { alignItems: 'flex-start', gap: 10 },
  crumbRow: { alignItems: 'center', gap: 6 },
  curriculum: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  unit: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 21 },

  changeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    flexShrink: 0,
  },
  changeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  changeBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressRow: { alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  progressText: { fontFamily: 'Inter_500Medium', fontSize: 11, flexShrink: 0 },

  resourceStrip: { gap: 8, paddingVertical: 1 },
  resourceChip: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  resourceEmoji: { fontSize: 12 },
  resourceText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});

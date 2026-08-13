/**
 * Compact persistent "Current Lesson" card for IQRA chat (Investor MVP).
 * Collapses after the teacher scrolls the conversation.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JordanFlag } from '@/components/ui/JordanFlag';
import type { CurrentLessonView } from '@/services/lessonCopilot';

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
  onChangeLesson: () => void;
  onToggleCollapse: () => void;
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
  onChangeLesson,
  onToggleCollapse,
}: Props) {
  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;

  const doneCount = lesson.resources.filter(r => r.done).length;
  const totalCount = lesson.resources.length;

  if (collapsed) {
    /*
      This is the default state, so it has to carry the whole job of the card in
      one line: which lesson is live, how much of it is prepared, and the one
      action a teacher takes standing in front of a class. Expanded, the card ran
      to roughly a third of a phone screen — breadcrumb, two full-width buttons,
      a label and a five-chip strip — all of it above the conversation the screen
      exists for. Everything still there on tap; none of it in the way.

      Start Class leads in row-reverse, so it lands on the start edge (right in
      Arabic). Change Lesson is one tap further in, inside the expanded card:
      switching lessons is a between-classes act, starting one is not.
    */
    const lead = onStartClass && startClassLabel ? (
      <Pressable
        onPress={onStartClass}
        disabled={startClassBusy}
        hitSlop={6}
        style={({ pressed }) => [
          styles.startCompact,
          {
            backgroundColor: START_CLASS_COLOR,
            opacity: startClassBusy ? 0.6 : pressed ? 0.88 : 1,
            flexDirection: rowDir,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: startClassBusy, busy: startClassBusy }}
        accessibilityLabel={startClassLabel}
      >
        {startClassBusy ? (
          <ActivityIndicator size="small" color={colors.primaryForeground || '#fff'} />
        ) : (
          <Ionicons name="tv-outline" size={13} color={colors.primaryForeground || '#fff'} />
        )}
        <Text
          numberOfLines={1}
          style={[styles.startCompactText, { color: colors.primaryForeground || '#fff' }]}
        >
          {startClassLabel}
        </Text>
      </Pressable>
    ) : (
      <Pressable
        onPress={onChangeLesson}
        hitSlop={8}
        style={({ pressed }) => [
          styles.changeBtnCompact,
          { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={changeLabel}
      >
        <Ionicons name="swap-horizontal" size={13} color={colors.primaryForeground || '#fff'} />
      </Pressable>
    );

    return (
      <View
        style={[
          styles.collapsed,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.inner, styles.collapsedInner, { flexDirection: rowDir }]}>
          {lead}
          <Pressable
            onPress={onToggleCollapse}
            style={[styles.collapsedMain, { flexDirection: rowDir, flex: 1 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            accessibilityLabel={lesson.unitLesson}
          >
            <JordanFlag width={17} />
            <Text
              numberOfLines={1}
              style={[styles.collapsedTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}
            >
              {lesson.unitLesson}
            </Text>
            {/* Says there is more under the fold, and how much of it is done. */}
            {totalCount > 0 ? (
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: doneCount > 0 ? colors.primary + '18' : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countPillText,
                    { color: doneCount > 0 ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {doneCount}/{totalCount}
                </Text>
              </View>
            ) : null}
            <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
     <View style={styles.inner}>
      <View style={[styles.headerText, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Pressable onPress={onToggleCollapse} style={[styles.headerRow, { flexDirection: rowDir, width: '100%' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.curriculum, { color: colors.mutedForeground, textAlign: align }]}>
              {lesson.curriculumLabel}
            </Text>
            <Text style={[styles.subject, { color: colors.foreground, textAlign: align }]}>
              {lesson.subjectGrade}
            </Text>
            <Text style={[styles.unit, { color: colors.primary, textAlign: align }]} numberOfLines={2}>
              {lesson.unitLesson}
            </Text>
          </View>
          <Ionicons name="chevron-up" size={16} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.actionRow, { flexDirection: rowDir }]}>
          {/*
            Start Class leads: it is the one action a teacher takes with a
            class already in front of them, so it must not be the second thing
            the eye lands on.
          */}
          {onStartClass && startClassLabel ? (
            <Pressable
              onPress={onStartClass}
              disabled={startClassBusy}
              style={({ pressed }) => [
                styles.changeBtn,
                {
                  // Same amber the home screen used, so the action a teacher
                  // already knows by colour does not change identity on the way
                  // over from that screen.
                  backgroundColor: START_CLASS_COLOR,
                  opacity: startClassBusy ? 0.6 : pressed ? 0.88 : 1,
                  flexDirection: rowDir,
                  flex: 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: startClassBusy, busy: startClassBusy }}
              accessibilityLabel={startClassLabel}
            >
              {startClassBusy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground || '#fff'} />
              ) : (
                <Ionicons name="tv-outline" size={14} color={colors.primaryForeground || '#fff'} />
              )}
              <Text
                style={[styles.changeBtnText, { color: colors.primaryForeground || '#fff' }]}
                numberOfLines={1}
              >
                {startClassLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onChangeLesson}
            style={({ pressed }) => [
              styles.changeBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.88 : 1,
                flexDirection: rowDir,
                // Sized to its label, not stretched: sharing the row equally
                // with Start Class clipped this to "تغيير الدر…" on a phone.
                flexShrink: 0,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={changeLabel}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.primaryForeground || '#fff'} />
            <Text
              style={[styles.changeBtnText, { color: colors.primaryForeground || '#fff' }]}
              numberOfLines={1}
            >
              {changeLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {/*
        Only worth a line once something is actually attached. "Files uploaded:
        0" is a label reporting the absence of a thing nobody asked about.
      */}
      {lesson.uploadedCount > 0 ? (
        <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
          {uploadedLabel(lesson.uploadedCount)}
        </Text>
      ) : null}

      {/*
        The five resource chips used to live here. Every one of them is now in
        the composer's "+" menu, next to the message box where the teacher is
        already working — a second copy in the lesson card was one more row of
        buttons above a conversation, offering nothing the menu does not. The
        prep state they carried survives as the done/total pill on the
        collapsed row.
      */}
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
  },
  // Matches the chat column so the lesson context sits over the thread rather
  // than sprawling to the window edge on desktop.
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  collapsed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  collapsedInner: {
    alignItems: 'center',
    gap: 8,
  },
  collapsedMain: {
    alignItems: 'center',
    gap: 8,
  },
  startCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexShrink: 0,
    maxWidth: 132,
  },
  startCompactText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    flexShrink: 0,
  },
  countPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  collapsedTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  headerRow: {
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: {
    gap: 2,
  },
  curriculum: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 11,
  },
  subject: {
    fontFamily: 'Cairo_500Medium',
    fontSize: 12,
  },
  unit: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 11,
  },
  actionRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  changeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexShrink: 0,
  },
  changeBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
});

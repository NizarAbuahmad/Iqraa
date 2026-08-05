/**
 * Compact persistent "Current Lesson" card for IQRA chat (Investor MVP).
 * Collapses after the teacher scrolls the conversation.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
};

type Props = {
  lesson: CurrentLessonView;
  collapsed: boolean;
  isRTL: boolean;
  lang: 'ar' | 'en';
  colors: Colors;
  changeLabel: string;
  uploadedLabel: (n: number) => string;
  generatedLabel: string;
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
  generatedLabel,
  onChangeLesson,
  onToggleCollapse,
  onResourcePress,
}: Props) {
  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;

  if (collapsed) {
    // Change CTA first in row-reverse → sits on the start edge (right in RTL)
    const changeCompact = (
      <Pressable
        onPress={onChangeLesson}
        hitSlop={8}
        style={({ pressed }) => [
          styles.changeBtnCompact,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={changeLabel}
      >
        <Ionicons name="swap-horizontal" size={13} color={colors.primaryForeground || '#fff'} />
      </Pressable>
    );
    const main = (
      <Pressable
        onPress={onToggleCollapse}
        style={[styles.collapsedMain, { flexDirection: rowDir, flex: 1 }]}
      >
        <Text style={{ fontSize: 14 }}>🇯🇴</Text>
        <Text
          numberOfLines={1}
          style={[styles.collapsedTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}
        >
          {lesson.unitLesson}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>
    );
    return (
      <View
        style={[
          styles.collapsed,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            flexDirection: rowDir,
          },
        ]}
      >
        {changeCompact}
        {main}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
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

        <Pressable
          onPress={onChangeLesson}
          style={({ pressed }) => [
            styles.changeBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.88 : 1,
              flexDirection: rowDir,
              marginTop: 8,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={changeLabel}
        >
          <Ionicons name="swap-horizontal" size={14} color={colors.primaryForeground || '#fff'} />
          <Text style={[styles.changeBtnText, { color: colors.primaryForeground || '#fff' }]}>
            {changeLabel}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
        {uploadedLabel(lesson.uploadedCount)}
      </Text>

      <Text style={[styles.generatedLabel, { color: colors.mutedForeground, textAlign: align }]}>
        {generatedLabel}
      </Text>
      <View style={[styles.checkRow, { flexDirection: rowDir }]}>
        {lesson.resources.map(r => (
          <Text
            key={r.type}
            style={[styles.checkItem, { color: r.done ? '#047857' : colors.mutedForeground }]}
          >
            {r.done ? '✓' : '○'} {lang === 'ar' ? r.labelAr : r.labelEn}
          </Text>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.resourceStrip, { flexDirection: rowDir }]}
      >
        {lesson.resources.map((r: ResourceChip) => (
          <Pressable
            key={r.type}
            onPress={() => onResourcePress(r.type, r.done)}
            style={({ pressed }) => [
              styles.resourceChip,
              {
                borderColor: r.done ? colors.primary + '66' : colors.border,
                backgroundColor: r.done ? colors.primary + '12' : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.foreground }}>
              {r.emoji} {lang === 'ar' ? r.labelAr : r.labelEn}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
  collapsed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 8,
  },
  collapsedMain: {
    alignItems: 'center',
    gap: 8,
  },
  collapsedTitle: {
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  subject: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  unit: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  changeBtn: {
    alignItems: 'center',
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  generatedLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 2,
  },
  checkRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  checkItem: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  resourceStrip: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  resourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
});

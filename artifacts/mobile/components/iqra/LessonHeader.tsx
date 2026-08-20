/**
 * One-line lesson context for the iQra chat.
 *
 * Lesson selection lives in صفوفي. This is a *display* of the lesson اقرأ
 * resolved for the conversation, not a control: there is deliberately no
 * change-lesson button and no picker behind it. The teacher switches lesson by
 * saying so, and this line is the feedback that اقرأ heard them — so it must
 * always show the lesson currently in effect.
 *
 * Replaces CurrentLessonCard's expanded/collapsed card, which spent ~130px of a
 * phone screen restating what one line says.
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
  secondary: string;
};

type Props = {
  lesson: CurrentLessonView;
  isRTL: boolean;
  lang: 'ar' | 'en';
  colors: Colors;
  uploadedLabel: (n: number) => string;
  generatedLabel: string;
  onResourcePress: (type: SessionArtifact, done: boolean) => void;
};

export function LessonHeader({
  lesson,
  isRTL,
  lang,
  colors,
  uploadedLabel,
  generatedLabel,
  onResourcePress,
}: Props) {
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.inner}>
        <Text numberOfLines={1} style={[styles.line, { textAlign: align }]}>
          <Text style={[styles.context, { color: colors.mutedForeground }]}>
            {lesson.curriculumLabel} · {lesson.subjectGrade} —{' '}
          </Text>
          <Text style={[styles.topic, { color: colors.primary }]}>{lesson.unitLesson}</Text>
        </Text>

        {lesson.uploadedCount > 0 ? (
          <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
            {uploadedLabel(lesson.uploadedCount)}
          </Text>
        ) : null}

        {/*
          Interim: the readiness strip still lives here so generation stays
          reachable while the lesson picker is removed. It is replaced by the
          composer tools sheet + a single status line in the next step.
        */}
        <Text style={[styles.generatedLabel, { color: colors.mutedForeground, textAlign: align }]}>
          {generatedLabel}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.resourceStrip, { flexDirection: rowDir }]}
        >
          {lesson.resources.map((r: ResourceChip) => (
            <Pressable
              key={r.type}
              onPress={() => onResourcePress(r.type, r.done)}
              accessibilityRole="button"
              accessibilityState={{ selected: r.done }}
              accessibilityLabel={`${lang === 'ar' ? r.labelAr : r.labelEn}${
                r.done ? (lang === 'ar' ? ' — جاهز' : ' — ready') : ''
              }`}
              style={({ pressed }) => [
                styles.resourceChip,
                {
                  flexDirection: rowDir,
                  borderColor: r.done ? colors.primary + '66' : colors.border,
                  backgroundColor: r.done ? colors.primary + '14' : colors.muted,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {r.done ? (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              ) : (
                <Text style={styles.resourceEmoji}>{r.emoji}</Text>
              )}
              <Text
                style={{
                  fontFamily: r.done ? 'Cairo_600SemiBold' : 'Cairo_500Medium',
                  fontSize: 12,
                  color: r.done ? colors.primary : colors.foreground,
                }}
              >
                {lang === 'ar' ? r.labelAr : r.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  // Matches the chat column so the lesson context sits over the thread rather
  // than sprawling to the window edge on desktop.
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  line: { lineHeight: 20 },
  context: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 12,
  },
  topic: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  meta: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  generatedLabel: {
    fontFamily: 'Cairo_500Medium',
    fontSize: 11,
    marginTop: 4,
  },
  resourceStrip: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  resourceEmoji: { fontSize: 13 },
  resourceChip: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
});

/**
 * The lesson's own book figures, shown on screen — not just in the export.
 *
 * `bookFigureRefsForLesson()` (`services/bookFigureUri.ts`) already resolves
 * these for the PDF/Word export appendix, captioned and capped, with the same
 * reasoning `exportHtml.ts`'s `figuresSectionHTML` documents: a generated
 * question can say «انظر الشكل المجاور» because that is how the book itself
 * writes such a question, but the model never saw the book's figures and
 * cannot know which one goes with which item. Showing every diagram the book
 * prints for this lesson, cited by page, and trusting the teacher to match it
 * by eye — same as a student does from the printed book — is what is safe
 * without a vision model. This is that same panel, rendered in the app
 * instead of only reaching a teacher after they export.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { BookFigureRef } from '@/services/exportHtml';
import { EXPORT_FIGURE_MAX } from '@/services/exportHtml';

type Props = {
  figures: readonly BookFigureRef[];
  isRTL: boolean;
  colors: {
    border: string;
    muted: string;
    mutedForeground: string;
    foreground: string;
  };
  labels: {
    title: string;
    note: string;
  };
};

export function BookFiguresPanel({ figures, isRTL, colors, labels }: Props) {
  if (!figures.length) return null;
  const shown = figures.slice(0, EXPORT_FIGURE_MAX);
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text
        style={[
          styles.title,
          { color: colors.foreground, textAlign: align, fontFamily: 'Cairo_600SemiBold' },
        ]}
      >
        {labels.title}
      </Text>
      <Text
        style={[
          styles.note,
          { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' },
        ]}
      >
        {labels.note}
      </Text>
      <View style={styles.grid}>
        {shown.map(f => (
          <View
            key={f.uri}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Image source={{ uri: f.uri }} style={styles.image} resizeMode="contain" />
            <Text
              style={[styles.caption, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
            >
              {f.caption}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 12 },
  title: { fontSize: 12.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  note: { fontSize: 11, fontStyle: 'italic', marginBottom: 8, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  image: { width: '100%', height: 130, marginBottom: 6 },
  caption: { fontSize: 10.5, textAlign: 'center', lineHeight: 15 },
});

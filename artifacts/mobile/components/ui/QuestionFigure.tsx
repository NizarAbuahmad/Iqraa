/**
 * The book figure a teacher attached to an exam question (`body.figure`), with
 * its page citation. Shown where the student answers (`take/[code]`) and where
 * the teacher reviews before publishing (`evaluations/[id]`), so the teacher
 * sees what the class will see.
 *
 * The server only lets a book-figure URL through (`questionFigure.ts`); this
 * renders nothing for a body without one.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

export function questionFigureOf(body: Record<string, unknown>): { uri: string; caption: string } | null {
  const f = body['figure'] as { uri?: unknown; caption?: unknown } | undefined;
  return typeof f?.uri === 'string' && f.uri ? { uri: f.uri, caption: typeof f.caption === 'string' ? f.caption : '' } : null;
}

export function QuestionFigure({ body, captionColor }: { body: Record<string, unknown>; captionColor: string }) {
  const figure = questionFigureOf(body);
  if (!figure) return null;
  return (
    <View style={styles.figure}>
      <Image source={{ uri: figure.uri }} style={styles.image} contentFit="contain" accessibilityLabel={figure.caption} />
      <Text style={[styles.caption, { color: captionColor }]}>{figure.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { marginTop: 12, alignItems: 'center', gap: 4 },
  image: { width: '100%', height: 180 },
  caption: { fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: 'center' },
});

/**
 * The lesson's own book figures, joined at render time from the figure index —
 * lab items do not list them. Shown in a wrapping grid so a projector shows
 * several at once; each carries its source page so it can be checked against
 * the book.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { TapToEnlarge } from '@/components/ui/ImageViewer';
import { figuresForLesson, type BookFigure } from '@/services/bookFigures';
import { bookFigureUri } from '@/services/bookFigureUri';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

const MAX_FIGURES = 12;

type ShownFigure = { figure: BookFigure; uri: string };

/** Figures the app can actually load (a figure without a URI is dropped, as on slides), capped. */
function shownFigures(lessonId: string): ShownFigure[] {
  const out: ShownFigure[] = [];
  for (const figure of figuresForLesson(lessonId)) {
    const uri = bookFigureUri(figure);
    if (uri === null) continue;
    out.push({ figure, uri });
    if (out.length >= MAX_FIGURES) break;
  }
  return out;
}

export function LabFigureStrip({ lessonId }: { lessonId: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const figures = useMemo(() => shownFigures(lessonId), [lessonId]);
  if (figures.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('labBookFigures')}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
        {t('labBookFiguresNote')}
      </Text>
      <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {figures.map(({ figure, uri }) => (
          <View key={`${figure.sourceId}/${figure.file}`} style={[styles.cell, { borderColor: colors.border, backgroundColor: '#fff' }]}>
            <TapToEnlarge url={uri} caption={`p. ${figure.pdfPage}`} whiteGround style={styles.tap}>
              <Image source={{ uri }} style={styles.img} contentFit="contain" accessibilityLabel={`p. ${figure.pdfPage}`} />
            </TapToEnlarge>
            <Text style={[styles.page, { color: colors.mutedForeground }]}>p. {figure.pdfPage}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 6 },
  title: { fontSize: 16 },
  note: { fontSize: 12, marginBottom: 6 },
  grid: { flexWrap: 'wrap', gap: 10 },
  cell: { width: 160, borderWidth: 1, borderRadius: 10, padding: 6, alignItems: 'center' },
  tap: { width: '100%' },
  img: { width: '100%', height: 120 },
  page: { fontSize: 11, marginTop: 4 },
});

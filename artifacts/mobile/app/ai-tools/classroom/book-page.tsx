import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  DECK_ACCENT as ACCENT, DECK_BG as BG, DECK_BORDER as BORDER, DECK_CARD_BG as CARD_BG,
  DECK_MUTED as TEXT_MUTED, DECK_TEXT as TEXT_PRIMARY,
} from '@/services/deckTheme';
import { useLanguage } from '@/context/LanguageContext';
import { bookPagesForLesson } from '@/services/bookFigures';
import { getLessonById } from '@/services/curriculumData';
import { canFullscreen, toggleFullscreen } from '@/services/presentationUtils';
import { goBack } from '@/services/navigation';
import { PEN_COLORS, PenCanvas, PenPalette, type Stroke } from '@/components/classroom/PenLayer';

/**
 * The lesson's pages of the student book, projected, with the pen on top.
 *
 * Pages are JPEGs cut per lesson by `scripts/verify_book_pages.py`, so they
 * arrive in seconds from R2 rather than minutes from NCCD, and need no PDF
 * viewer. The ink lives inside the scroll content, so it moves with the page
 * it marks; while the pen is on, the pages cannot scroll.
 */
export default function BookPageScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const pages = bookPagesForLesson(lessonId);
  const lesson = getLessonById(lessonId);
  const [penOn, setPenOn] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [ink, setInk] = useState<Stroke[]>([]);

  useEffect(() => {
    if (!pages) router.replace('/(tabs)' as never);
  }, [pages]);

  if (!pages) return null;

  const title = lesson ? (lang === 'ar' ? lesson.titleAr || lesson.title : lesson.title) : '';
  const pageLabel = t('bookPageNumber', pages.page);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => goBack()} style={styles.iconBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={22} color={TEXT_MUTED} />
        </Pressable>
        {canFullscreen && (
          <Pressable onPress={toggleFullscreen} style={styles.iconBtn} hitSlop={12} accessibilityRole="button">
            <Ionicons name="expand-outline" size={20} color={TEXT_MUTED} />
          </Pressable>
        )}
        <Text numberOfLines={1} style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          {title ? `${title} · ${pageLabel}` : pageLabel}
        </Text>
        <Pressable
          onPress={() => setPenOn(v => !v)}
          style={[styles.iconBtn, penOn && { borderColor: ACCENT + '50', backgroundColor: ACCENT + '12' }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ selected: penOn }}
          accessibilityLabel={t('penTool')}
        >
          <Ionicons name={penOn ? 'brush' : 'brush-outline'} size={20} color={penOn ? ACCENT : TEXT_MUTED} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <ScrollView contentContainerStyle={styles.pages}>
          {pages.urls.map((uri, i) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[styles.page, { aspectRatio: pages.aspect }]}
              contentFit="contain"
              accessibilityLabel={t('bookPageNumber', pages.page + i)}
            />
          ))}
          <PenCanvas strokes={ink} color={penColor} active={penOn} onChange={setInk} />
        </ScrollView>
        {penOn && (
          <PenPalette
            color={penColor}
            onColor={setPenColor}
            canUndo={ink.length > 0}
            onUndo={() => setInk(ink.slice(0, -1))}
            onClear={() => setInk([])}
            labels={{ undo: t('penUndo'), clear: t('penClear'), colors: [t('penRed'), t('penTeal'), t('penBlack')] }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  title: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontFamily: 'Cairo_700Bold', paddingHorizontal: 8 },
  stage: { flex: 1 },
  pages: { gap: 12, padding: 12, alignItems: 'center' },
  // Capped so a wide projector shows a readable page, not a 4-metre-wide one.
  page: { width: '100%', maxWidth: 1000, backgroundColor: CARD_BG, borderRadius: 4 },
});

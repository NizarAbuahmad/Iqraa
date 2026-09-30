import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  DECK_ACCENT as ACCENT, DECK_BG as BG, DECK_BORDER as BORDER, DECK_CARD_BG as CARD_BG,
  DECK_MUTED as TEXT_MUTED, DECK_TEXT as TEXT_PRIMARY,
} from '@/services/deckTheme';
import { useLanguage } from '@/context/LanguageContext';
import { bookPageForLesson } from '@/services/bookFigures';
import { getLessonById } from '@/services/curriculumData';
import { canFullscreen, toggleFullscreen } from '@/services/presentationUtils';
import { openExternal } from '@/services/externalLinks';
import { goBack } from '@/services/navigation';
import { PEN_COLORS, PenCanvas, PenPalette, type Stroke } from '@/components/classroom/PenLayer';

/**
 * The lesson's page in the student book, projected, with the pen on top.
 *
 * Web only: the browser's own PDF viewer does the rendering and honours
 * `#page=`. The phone app has no PDF view without a WebView dependency, so the
 * lesson screen opens the PDF externally there instead of coming here.
 *
 * The ink sits over the viewer, not inside the PDF, so scrolling the book
 * leaves it behind — clear it after turning the page.
 */
export default function BookPageScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const link = bookPageForLesson(lessonId);
  const lesson = getLessonById(lessonId);
  const [penOn, setPenOn] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [ink, setInk] = useState<Stroke[]>([]);

  useEffect(() => {
    if (!link || Platform.OS !== 'web') router.replace('/(tabs)' as never);
  }, [link]);

  if (!link || Platform.OS !== 'web') return null;

  const title = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.title) : '';
  const pageLabel = t('bookPageNumber', link.page);

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
          onPress={() => openExternal(`${link.pdfUrl}#page=${link.page}`)}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('bookPageOpenInTab')}
        >
          <Ionicons name="open-outline" size={20} color={TEXT_MUTED} />
        </Pressable>
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
        {React.createElement('iframe', {
          src: `${link.pdfUrl}#page=${link.page}`,
          style: { width: '100%', height: '100%', border: '0' },
          title: pageLabel,
        })}
        <PenCanvas strokes={ink} color={penColor} active={penOn} onChange={setInk} />
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
});

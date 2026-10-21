/**
 * A corner's page frame: the band in the corner's hero colour with its motif,
 * a back button, title and subtitle, then a centred, width-capped scroll area.
 * `MathFrame`'s and `LabFrame`'s layout, merged — they were the same component
 * twice, differing only in the scroll lock the grapher needs, which lives here.
 *
 * It takes no colour props. It reads `useColors()`, and the corner's
 * `_layout.tsx` provider decides the hue; outside every provider it is teal,
 * which is what a future non-corner caller should get.
 *
 * The band stays full-bleed, but what is in it is capped at CONTENT_MAX_WIDTH
 * and centred, so on desktop the title lines up with the content column
 * instead of hugging the window edge. The large glyph is phone-only: on
 * desktop it would sit under the back button.
 *
 * Without the scroll lock a drag on the grapher scrolls the page instead of
 * panning the graph. A tool calls `useScrollLock()(true)` when a touch starts
 * on its canvas and `(false)` when it ends.
 */
import React, { createContext, useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useLanguage } from '@/context/LanguageContext';
import { useCorner } from '@/context/CornerTheme';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { CornerMotif } from './CornerMotif';

const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Lock (true) or release (false) the page's scrolling. A no-op outside a `CornerFrame`. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

type Props = {
  title: string;
  subtitle?: string;
  /** Rendered inside the band under the subtitle — grade chips, a switch. */
  bandChildren?: React.ReactNode;
  children: React.ReactNode;
};

export function CornerFrame({ title, subtitle, bandChildren, children }: Props) {
  const colors = useColors();
  const corner = useCorner();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const viewportW = useViewportWidth();
  const [locked, setLocked] = useState(false);
  const align = isRTL ? 'right' : 'left';
  const isDesktop = viewportW >= DESKTOP_BREAKPOINT;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + SPACE.md }]}>
        {corner ? <CornerMotif motif={corner.motif} opacity={corner.motifOpacity} /> : null}
        {corner && !isDesktop ? (
          <View pointerEvents="none" style={[styles.glyphWrap, isRTL ? { left: -SPACE.md } : { right: -SPACE.md }]}>
            <Text style={[styles.glyph, { fontFamily: 'ReadexPro_700Bold' }]}>{corner.glyph}</Text>
          </View>
        ) : null}
        <View style={styles.heroInner}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: SPACE.sm }} />
          <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
          ) : null}
          {bandChildren}
        </View>
        {corner?.hairline ? <View style={[styles.hairline, { backgroundColor: corner.hairline }]} /> : null}
      </View>
      <ScrollView
        scrollEnabled={!locked}
        contentContainerStyle={{ paddingBottom: SPACE.hero, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollLockContext.Provider value={setLocked}>{children}</ScrollLockContext.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, overflow: 'hidden' },
  heroInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  title: { color: '#fff', fontSize: TYPE.title },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginTop: SPACE.xs },
  glyphWrap: { position: 'absolute', bottom: -SPACE.xl },
  // 3.5 × the hero step: a decoration, not a type size, so it is not a new
  // off-scale value for designScale.test.ts.
  glyph: { color: 'rgba(255,255,255,0.18)', fontSize: TYPE.hero * 3.5, lineHeight: TYPE.hero * 3.5 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.75 },
});

/**
 * A corner's page frame: the band (components/ui/Band.tsx: a gradient from the
 * corner's hero colour, its motif, a soft shadow in light mode),
 * a back button, title and subtitle, then a centred, width-capped scroll area.
 * `MathFrame`'s and `LabFrame`'s layout, merged — they were the same component
 * twice, differing only in the scroll lock the grapher needs, which lives here.
 *
 * It takes no colour props. It reads `useColors()`, and the corner's
 * `_layout.tsx` provider decides the hue; outside every provider it is brand teal with the leaf motif,
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
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useLanguage } from '@/context/LanguageContext';
import { useCorner } from '@/context/CornerTheme';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Band, BRAND_MOTIF_OPACITY } from '@/components/ui/Band';

const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Lock (true) or release (false) the page's scrolling. A no-op outside a `CornerFrame`. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

type Props = {
  title: string;
  subtitle?: string;
  /** A short line above the title — the English lesson's «grade · unit». */
  eyebrow?: string;
  /** Replaces the back button's default (`goBack()`, which falls back to `/`). Public pages need their own fallback. */
  onBack?: () => void;
  /** The games hub is an entry point with nowhere to go back to. */
  hideBack?: boolean;
  /** Pass `'handled'` on screens with text inputs, so a tap on a button does not first just close the keyboard. */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Rendered inside the band under the subtitle — a streak line, a switch. */
  bandChildren?: React.ReactNode;
  children: React.ReactNode;
};

export function CornerFrame({ title, subtitle, eyebrow, onBack, hideBack, keyboardShouldPersistTaps, bandChildren, children }: Props) {
  const colors = useColors();
  const corner = useCorner();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const viewportW = useViewportWidth();
  const [locked, setLocked] = useState(false);
  const align = isRTL ? 'right' : 'left';
  const isDesktop = viewportW >= DESKTOP_BREAKPOINT;
  // The band sits under the status bar.
  useLightStatusBar();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Band
        color={colors.hero}
        motif={corner?.motif ?? 'leaf'}
        motifOpacity={corner?.motifOpacity ?? BRAND_MOTIF_OPACITY}
        style={[styles.hero, { paddingTop: insets.top + SPACE.md }]}
      >
        {corner && !isDesktop ? (
          <View pointerEvents="none" style={[styles.glyphWrap, isRTL ? { left: -SPACE.md } : { right: -SPACE.md }]}>
            <Text style={[styles.glyph, { fontFamily: 'ReadexPro_700Bold' }]}>{corner.glyph}</Text>
          </View>
        ) : null}
        <View style={styles.heroInner}>
          {hideBack ? null : (
            <BackButton color="#fff" onPress={onBack} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: SPACE.sm }} />
          )}
          {eyebrow ? (
            <Text style={[styles.eyebrow, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
          ) : null}
          {bandChildren}
        </View>
        {corner?.hairline ? <View style={[styles.hairline, { backgroundColor: corner.hairline }]} /> : null}
      </Band>
      <ScrollView
        scrollEnabled={!locked}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
  // The hero already pads SPACE.lg a side, and the grid sits its cards SPACE.lg
  // inside the CONTENT_MAX_WIDTH column, so cap the title block by the same
  // amount and it lines up with the first card at every width.
  heroInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH - 2 * SPACE.lg, alignSelf: 'center' },
  title: { color: '#fff', fontSize: TYPE.title },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginBottom: SPACE.xs },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginTop: SPACE.xs },
  glyphWrap: { position: 'absolute', bottom: -SPACE.xl },
  // 3.5 × the hero step: a decoration, not a type size, so it is not a new
  // off-scale value for designScale.test.ts.
  glyph: { color: 'rgba(255,255,255,0.18)', fontSize: TYPE.hero * 3.5, lineHeight: TYPE.hero * 3.5 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.75 },
});

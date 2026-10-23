/**
 * Where a generator screen's pieces go. On a phone: the form, one column (the
 * generate button is docked by `DockedAction`, outside this layout). On desktop:
 * the form keeps a readable width (a full-width dropdown 1,000 px wide is not
 * readable) with the side panel (paper preview, then the button) beside it,
 * sticky on the web so it stays in view while the form scrolls.
 *
 * `useIsDesktopGenerator` is the same test `app/(tabs)/_layout.tsx` uses for
 * `isDesktop`: the real viewport width against `DESKTOP_BREAKPOINT`.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { SPACE } from '@/constants/theme';

export function useIsDesktopGenerator(): boolean {
  return useViewportWidth() >= DESKTOP_BREAKPOINT;
}

export interface GeneratorLayoutProps {
  form: React.ReactNode;
  side: React.ReactNode;
  isDesktop: boolean;
}

/** The form column's cap on desktop. */
export const FORM_MAX_WIDTH = 640;

export function GeneratorLayout({ form, side, isDesktop }: GeneratorLayoutProps) {
  const { isRTL } = useLanguage();
  if (!isDesktop) return <View style={styles.phone}>{form}</View>;
  return (
    <View style={[styles.desktop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={styles.form}>{form}</View>
      <View style={[styles.side, Platform.OS === 'web' ? ({ position: 'sticky', top: SPACE.lg } as object) : null]}>{side}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { gap: SPACE.md },
  desktop: { alignItems: 'flex-start', gap: SPACE.xxl },
  form: { flex: 1.25, minWidth: 0, maxWidth: FORM_MAX_WIDTH, gap: SPACE.lg },
  side: { flex: 1, minWidth: 0, maxWidth: 440, gap: SPACE.md },
});

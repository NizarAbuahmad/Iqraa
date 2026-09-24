import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';

const NAVY = '#081B3A';
const TEAL = '#00A99D';
const AQUA = '#34D6C6';

/**
 * Shared by every screen in `app/(auth)` so the brand identity (and the
 * row/column split it drives) doesn't fork per-screen — it did once, and
 * Create account / Reset password ended up as plain white pages with no
 * relation to Sign In one tap away.
 */
export function useAuthLayout() {
  const viewportW = useViewportWidth();
  return { isWide: viewportW >= DESKTOP_BREAKPOINT, viewportW };
}

export function AuthBrandPanel({ isWide }: { isWide: boolean }) {
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL, toggleLang } = useLanguage();

  return (
    <LinearGradient
      colors={[NAVY, '#0B274F', '#0A3A4A']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        styles.brandPanel,
        isWide ? styles.brandPanelWide : styles.brandPanelNarrow,
        { paddingTop: isWide ? 48 : insets.top + 16 },
      ]}
    >
      {/* Soft atmospheric accents — not busy */}
      <View style={[styles.glow, styles.glowTeal]} />
      <View style={[styles.glow, styles.glowAqua]} />

      <Pressable
        onPress={() => { Haptics.selectionAsync(); toggleLang(); }}
        style={[
          styles.langBtn,
          {
            alignSelf: isRTL ? 'flex-start' : 'flex-end',
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderColor: 'rgba(255,255,255,0.16)',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={lang === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
      >
        <Ionicons name="language-outline" size={15} color="rgba(255,255,255,0.9)" />
        <Text style={[styles.langBtnText, { fontFamily: 'Cairo_500Medium' }]}>
          {lang === 'ar' ? 'English' : 'عربي'}
        </Text>
      </Pressable>

      <View style={[styles.brandContent, isWide ? styles.brandContentWide : styles.brandContentNarrow]}>
        <Text style={[styles.eyebrow, { fontFamily: 'Cairo_500Medium', textAlign: 'center' }]}>
          {t('loginBrandEyebrow')}
        </Text>

        <BrandLogo
          variant="mark"
          onDark
          style={[styles.logo, isWide ? styles.logoWide : styles.logoNarrow]}
          accessibilityLabel="IQRA"
        />

        <Text
          style={[
            styles.valueProp,
            {
              fontFamily: lang === 'ar' ? 'Cairo_500Medium' : 'Almarai_400Regular',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {t('loginValueProp')}
        </Text>

        <View style={styles.brandRule} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  brandPanel: {
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  // Capped rather than content-sized: on a phone-height viewport this used to
  // grow to fill whatever space the flex-column layout gave it, which was
  // most of the screen — pushing every field below the fold on a screen a
  // returning user opens purely to log back in.
  brandPanelNarrow: {
    maxHeight: 220,
  },
  brandPanelWide: {
    flex: 1.05,
    minWidth: 380,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingBottom: 48,
  },
  brandContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  brandContentNarrow: {
    flex: 1,
  },
  brandContentWide: {
    flex: 1,
    maxWidth: 420,
    alignSelf: 'center',
    gap: 18,
    paddingVertical: 12,
  },

  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.22,
  },
  glowTeal: {
    width: 220,
    height: 220,
    backgroundColor: TEAL,
    top: -60,
    right: -40,
  },
  glowAqua: {
    width: 180,
    height: 180,
    backgroundColor: AQUA,
    bottom: -50,
    left: -30,
    opacity: 0.14,
  },

  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 2,
  },
  langBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.92)' },

  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: AQUA,
    marginBottom: 2,
  },
  logo: { alignSelf: 'center' },
  logoNarrow: { width: 96, height: 96 },
  logoWide: { width: 260, height: 260 },
  valueProp: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.95)',
    maxWidth: 320,
    marginTop: 2,
  },
  brandRule: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL,
    marginTop: 6,
  },
});

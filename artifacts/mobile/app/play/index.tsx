/**
 * Public games hub — no login. The link is the identity, same idea as
 * app/take/[code].tsx: this is meant to be shared and opened cold, which is
 * why `/play` is in routeGating.ts's PUBLIC_ROUTES.
 *
 * Every game funnels back here, and every game-over screen offers the
 * teacher-signup CTA (see GameShell) — this hub is the top of that funnel.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { Button } from '@/components/ui/Button';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

const GAMES: Array<{
  id: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { id: 'flags', route: '/play/flags', icon: 'flag-outline', color: '#1D4ED8', titleKey: 'playFlagsTitle', descKey: 'playFlagsDesc' },
  { id: 'capitals', route: '/play/capitals', icon: 'location-outline', color: '#0E8F86', titleKey: 'playCapitalsTitle', descKey: 'playCapitalsDesc' },
  { id: 'memory', route: '/play/memory', icon: 'apps-outline', color: '#0369A1', titleKey: 'playMemoryTitle', descKey: 'playMemoryDesc' },
  { id: 'colors', route: '/play/colors', icon: 'color-palette-outline', color: '#DB2777', titleKey: 'playColorsTitle', descKey: 'playColorsDesc' },
  { id: 'multiply', route: '/play/multiply', icon: 'calculator-outline', color: '#B45309', titleKey: 'playMultiplyTitle', descKey: 'playMultiplyDesc' },
  { id: 'divide', route: '/play/divide', icon: 'pie-chart-outline', color: '#7C3AED', titleKey: 'playDivideTitle', descKey: 'playDivideDesc' },
  { id: 'add', route: '/play/add', icon: 'add-circle-outline', color: '#4338CA', titleKey: 'playAddTitle', descKey: 'playAddDesc' },
  { id: 'subtract', route: '/play/subtract', icon: 'remove-circle-outline', color: '#BE123C', titleKey: 'playSubtractTitle', descKey: 'playSubtractDesc' },
];

export default function PlayHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const topPad = insets.top + (insets.top === 0 ? 20 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: ACCENT_FILL }]}>
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 24, textAlign: 'center' }}>
            {t('playHubTitle')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 6 }}>
            {t('playHubSubtitle')}
          </Text>
        </View>

        <View style={styles.grid}>
          {GAMES.map(g => (
            <Pressable
              key={g.id}
              onPress={() => router.push(g.route as any)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${g.color}1a` }]}>
                <Ionicons name={g.icon} size={26} color={g.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: 'center' }}>
                {t(g.titleKey)}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, textAlign: 'center' }}>
                {t(g.descKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!user && (
          <View style={[styles.ctaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: 'center' }}>
              {t('playCtaHeading')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              {t('playCtaBody')}
            </Text>
            <Button
              label={t('playCtaButton')}
              onPress={() => router.push('/(auth)/register')}
              fullWidth
              size="lg"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 20 },
  card: {
    flexBasis: '46%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 18, gap: 8, alignItems: 'center',
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaCard: { marginHorizontal: 20, borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
});

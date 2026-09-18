/**
 * Chrome shared by all four public games: header (back to the games menu,
 * title, optional score badge) and — once a game reports it's over — the
 * "play again" / "create a free teacher account" panel.
 *
 * That CTA panel is not decoration: it's the entire reason these games exist
 * (a top-of-funnel acquisition hook), so it lives here once rather than
 * risking one game shipping without it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { Button } from '@/components/ui/Button';
import type { TranslationKey } from '@/services/i18n';

export function GameShell({
  titleKey, accent, scoreLabel, gameOver, onReplay, children,
}: {
  titleKey: TranslationKey;
  accent: string;
  /** Already-formatted, e.g. t('playScoreLabel', score, total) — the shell
   *  has no opinion on what a game's score means. */
  scoreLabel?: string;
  gameOver?: { message: string } | null;
  onReplay?: () => void;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: accent, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {/* Cast: '/play' isn't in the generated typed-routes union until the
              dev server regenerates it — same reason other new routes in this
              app are cast (see app/_layout.tsx). */}
          <Pressable onPress={() => router.replace('/play' as any)} style={styles.backBtn} hitSlop={10}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
            {t(titleKey)}
          </Text>
          {scoreLabel ? (
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{scoreLabel}</Text>
            </View>
          ) : null}
        </View>

        {gameOver ? (
          <View style={styles.overlay}>
            <Ionicons name="trophy" size={48} color={accent} />
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 22, textAlign: 'center' }}>
              {t('playGameOverTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 16, textAlign: 'center' }}>
              {gameOver.message}
            </Text>

            <Button label={t('playPlayAgain')} onPress={() => onReplay?.()} style={{ backgroundColor: accent, marginTop: 12 }} fullWidth size="lg" />

            <View style={[styles.ctaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: 'center' }}>
                {t('playCtaHeading')}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                {t('playCtaBody')}
              </Text>
              <Button label={t('playCtaButton')} onPress={() => router.push('/(auth)/register')} variant="secondary" fullWidth />
            </View>
          </View>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 17 },
  scoreBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  scoreText: { color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  ctaCard: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 18, gap: 10, marginTop: 24 },
});

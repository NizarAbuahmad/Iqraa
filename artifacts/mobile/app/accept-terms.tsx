/**
 * Mandatory stop for an account that has not accepted the current terms of use
 * and privacy policy — reached only through the routing gate in
 * `app/_layout.tsx` (`needsTermsAcceptance`), never by user navigation.
 *
 * Two kinds of account land here: one that accepted an earlier wording, and
 * one with no record at all (every account from before 2026-10-03, when
 * sign-up started storing it). The text does not distinguish them — the ask is
 * the same: read the documents and accept, or sign out.
 *
 * Like `claim-required.tsx` it has no back button and no skip, and it carries
 * the one way out (signing out), so someone on a shared device is never held
 * here. The two documents open on `/legal/*`, which stays reachable while this
 * gate holds (public routes are checked first in the layout).
 *
 * «أوافق» is recorded on the server before the gate lifts: a failed call leaves
 * the account on this screen with the reason shown, never past it.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { LEGAL_LAST_UPDATED } from '@/constants/legal';

export default function AcceptTermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { acceptTerms, logout } = useAuth();
  const align = isRTL ? 'right' : 'left';

  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onAccept = async () => {
    if (!ticked || busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptTerms();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The gate has lifted; the layout would find its own way, but a user who
      // reached here from the tabs should land back in them.
      router.replace('/(tabs)');
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(apiErrorMessage(err, 'acceptTermsFailed', t));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="document-text-outline" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('acceptTermsTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('acceptTermsDesc', LEGAL_LAST_UPDATED[lang === 'ar' ? 'ar' : 'en'])}
        </Text>

        <View style={{ gap: 10, marginBottom: 20 }}>
          {([
            ['/legal/terms', 'termsOfService'],
            ['/legal/privacy', 'privacyPolicy'],
          ] as const).map(([href, key]) => (
            <Pressable
              key={href}
              onPress={() => router.push(href as never)}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.docRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="document-outline" size={18} color={colors.primary} />
              <Text style={[styles.docText, { color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                {t(key)}
              </Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        {/* The box and its sentence toggle together; only the two rows above
            open the documents, so a tap meant to tick never opens a page. */}
        <Pressable
          onPress={() => setTicked(v => !v)}
          accessibilityRole="checkbox"
          aria-checked={ticked}
          style={[styles.tickRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: ticked ? colors.primary : colors.border,
                backgroundColor: ticked ? colors.primary : 'transparent',
              },
            ]}
          >
            {ticked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text style={[styles.tickText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('acceptTermsTick')}
          </Text>
        </Pressable>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.destructive + '18',
                borderColor: colors.destructive + '44',
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <Button label={t('acceptTermsButton')} onPress={onAccept} loading={busy} disabled={!ticked || busy} />

        {/* The only other exit: this screen is mandatory and the back gesture
            is off, so someone who does not agree — or is on a shared device —
            is never trapped on it. */}
        <Pressable onPress={() => void logout()} hitSlop={8} style={{ alignSelf: 'center', marginTop: 20 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: 'center' }}>
            {t('signOut')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  docRow: { alignItems: 'center', gap: 10, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14 },
  docText: { flex: 1, fontSize: 15 },
  tickRow: { alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  tickText: { flex: 1, fontSize: 15, lineHeight: 24 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginBottom: 16 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
});

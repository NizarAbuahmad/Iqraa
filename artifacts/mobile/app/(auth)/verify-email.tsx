import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

/** Cooldown between resend taps — enough for the email to plausibly arrive before offering another one. */
const RESEND_COOLDOWN_S = 30;

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verifyEmail, resendVerification } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleVerify = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await verifyEmail(email ?? '', code);
      router.replace('/(tabs)');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? t('invalidVerificationCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setResending(true);
    try {
      await resendVerification(email ?? '');
      setNotice(t('codeResent'));
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e: any) {
      setError(e.message ?? (lang === 'ar' ? 'تعذّر إرسال الرمز' : 'Failed to resend code'));
    } finally {
      setResending(false);
    }
  };

  const canSubmit = /^\d{6}$/.test(code);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('verifyEmailTitle')}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('verifyEmailSubtitle', email ?? '')}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, borderColor: colors.border }]}>
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
            </View>
          ) : null}

          {notice ? (
            <View style={[styles.banner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.bannerText, { color: colors.primary, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{notice}</Text>
            </View>
          ) : null}

          <Input
            label={t('verificationCode')}
            placeholder={t('verificationCodePlaceholder')}
            value={code}
            onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
            leftIcon="key-outline"
            keyboardType="number-pad"
            maxLength={6}
            isRTL={isRTL}
            autoFocus
          />

          <Button
            label={t('verifyEmailButton')}
            onPress={handleVerify}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
          />

          <Pressable onPress={handleResend} disabled={resending || cooldown > 0} style={styles.resendRow}>
            <Text style={[styles.resendText, { color: cooldown > 0 ? colors.mutedForeground : colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
              {cooldown > 0 ? `${t('resendCode')} (${cooldown}s)` : t('resendCode')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 20, width: 40 },
  heading: { fontSize: 26, marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 24 },
  card: { padding: 24, borderWidth: 1, marginBottom: 24, gap: 16 },
  banner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: 13 },
  resendRow: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14 },
});

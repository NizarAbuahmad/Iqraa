import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

/**
 * One screen, two steps, rather than two routed screens like register →
 * verify-email. The address is already in hand after the first step, so a
 * second route would exist only to carry it, and stepping back from the code
 * to the address you just typed should not be a navigation event.
 */
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { forgotPassword, resetPassword } = useAuth();
  const { t, isRTL } = useLanguage();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('code');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? t('invalidVerificationCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Straight to login rather than signing them in. The code proves they
      // control the mailbox, not that they will remember the password they
      // just chose — typing it once more is the cheapest confirmation there is.
      router.replace('/(auth)/login');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? t('invalidVerificationCode'));
    } finally {
      setLoading(false);
    }
  };

  const canSend = email.includes('@');
  const canReset = /^\d{6}$/.test(code) && password.length >= 8;

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
          onPress={() => (step === 'code' ? setStep('email') : router.replace('/(auth)/login'))}
          style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {step === 'email' ? t('forgotPasswordTitle') : t('resetPasswordTitle')}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {step === 'email' ? t('forgotPasswordSubtitle') : t('resetPasswordSubtitle', email.trim())}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, borderColor: colors.border }]}>
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
            </View>
          ) : null}

          {step === 'email' ? (
            <>
              <Input
                label={t('email')}
                placeholder={t('emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                isRTL={isRTL}
                autoFocus
              />
              <Button
                label={t('forgotPasswordSendButton')}
                onPress={handleSend}
                loading={loading}
                disabled={!canSend}
                fullWidth
              />
            </>
          ) : (
            <>
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
              <Input
                label={t('newPassword')}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry={!showPassword}
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPassword(v => !v)}
                autoCapitalize="none"
                isRTL={isRTL}
              />
              <Button
                label={t('resetPasswordButton')}
                onPress={handleReset}
                loading={loading}
                disabled={!canReset}
                fullWidth
              />
              <Pressable onPress={handleSend} disabled={loading} style={styles.resendRow}>
                <Text style={[styles.resendText, { color: colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
                  {t('resendCode')}
                </Text>
              </Pressable>
            </>
          )}
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

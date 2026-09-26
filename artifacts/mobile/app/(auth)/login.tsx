import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthBrandPanel, useAuthLayout } from '@/components/ui/AuthBrandPanel';
import { AuthModeSwitch } from '@/components/ui/AuthModeSwitch';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton, isGoogleSignInAvailable } from '@/components/ui/GoogleSignInButton';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, loginWithGoogle } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { isWide } = useAuthLayout();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      if (e.code === 'email_not_verified') {
        // Their only way back in if the original code email never arrived —
        // this is the recovery path for it, not just a nicer error message.
        router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
        return;
      }
      setError(e.message ?? (lang === 'ar' ? 'تعذّر تسجيل الدخول' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
    } catch (e: any) {
      setError(e.message ?? (lang === 'ar' ? 'تعذّر تسجيل الدخول عبر Google' : 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const formPanel = (
    <KeyboardAvoidingView
      style={[styles.formPanel, isWide && styles.formPanelWide]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.formScroll,
          {
            paddingTop: isWide ? 56 : 28,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
            maxWidth: isWide ? 440 : 480,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AuthModeSwitch
          mode="login"
          loginLabel={t('signIn')}
          registerLabel={t('createAccount')}
          onSwitch={m => router.replace(m === 'login' ? '/(auth)/login' : '/(auth)/register')}
          colors={colors}
          isRTL={isRTL}
        />

        <View style={styles.formHeader}>
          <Text
            style={[
              styles.cardTitle,
              {
                color: colors.foreground,
                fontFamily: 'Cairo_700Bold',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {t('welcomeBack')}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              {
                color: colors.mutedForeground,
                fontFamily: 'Almarai_400Regular',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {t('signInSubtitle')}
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.destructive + '14',
                borderColor: colors.destructive + '33',
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text
              style={[
                styles.errorText,
                {
                  color: colors.destructive,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {isGoogleSignInAvailable() && (
          <>
            <GoogleSignInButton onCredential={handleGoogleCredential} locale={lang} />
            {googleLoading ? (
              <Text style={[styles.googleLoadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                {lang === 'ar' ? 'جارٍ تسجيل الدخول…' : 'Signing in…'}
              </Text>
            ) : null}

            <View style={[styles.dividerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                {t('orDivider')}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          </>
        )}

        <Input
          label={t('emailAddress')}
          placeholder={t('emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="mail-outline"
          isRTL={isRTL}
        />

        <Input
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="password"
          leftIcon="lock-closed-outline"
          rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          onRightIconPress={() => setShowPassword(v => !v)}
          isRTL={isRTL}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password' as any)}
          // Pulled up against the password field it belongs to: the form's
          // 14px gap plus Input's own 16px bottom margin left it floating
          // nearer the sign-in button than its field. The button's marginTop
          // opens the gap on the other side.
          style={{ alignSelf: isRTL ? 'flex-start' : 'flex-end', paddingVertical: 4, marginTop: -24 }}
          accessibilityRole="link"
        >
          <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
            {t('forgotPasswordLink')}
          </Text>
        </Pressable>

        <Button
          label={t('signIn')}
          onPress={handleLogin}
          loading={loading}
          disabled={!email || !password}
          size="lg"
          fullWidth
          style={styles.signInBtn}
        />

      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, isWide && { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <AuthBrandPanel isWide={isWide} />
      {formPanel}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  formPanel: { flex: 1, backgroundColor: '#F5F7FA' },
  formPanelWide: { flex: 1, justifyContent: 'center' },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 14,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  formHeader: { gap: 6, marginBottom: 6 },
  cardTitle: { fontSize: 28 },
  cardSubtitle: { fontSize: 15, lineHeight: 22 },
  errorBanner: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 21 },
  dividerRow: { alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, lineHeight: 19 },
  googleLoadingText: { fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: -6 },
  signInBtn: { marginTop: 12 },
});

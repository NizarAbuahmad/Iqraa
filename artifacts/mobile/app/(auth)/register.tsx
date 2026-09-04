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
import { GoogleSignInButton, isGoogleSignInAvailable } from '@/components/ui/GoogleSignInButton';
import { Input } from '@/components/ui/Input';
import { PillSelector } from '@/components/ui/PillSelector';
import { Ionicons } from '@expo/vector-icons';

type SignupRole = 'teacher' | 'parent' | 'student';

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuth();
  const { t, lang, isRTL } = useLanguage();

  const [role, setRole] = useState<SignupRole>('teacher');
  const [claimCode, setClaimCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? (lang === 'ar' ? 'تعذّر تسجيل الدخول عبر Google' : 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role,
        claimCode: role === 'teacher' ? undefined : claimCode.trim(),
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes('@') &&
    password.length >= 8 &&
    (confirmPassword === '' || confirmPassword === password) &&
    (role === 'teacher' || claimCode.trim().length > 0);

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
          onPress={() => router.back()}
          style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('createYourAccount')}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('registerSubtitle')}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, borderColor: colors.border }]}>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
            </View>
          ) : null}

          <PillSelector
            label={t('iAmA')}
            options={[
              { value: 'teacher', label: t('roleTeacher') },
              { value: 'parent', label: t('roleParent') },
              { value: 'student', label: t('roleStudent') },
            ]}
            value={role}
            onChange={setRole}
            colors={colors}
            isRTL={isRTL}
            accent={colors.primary}
            haptics
          />

          {role !== 'teacher' ? (
            <Input
              label={t('classCode')}
              placeholder={t('classCodePlaceholder')}
              hint={t('classCodeHint')}
              value={claimCode}
              onChangeText={text => setClaimCode(text.toUpperCase())}
              leftIcon="key-outline"
              autoCapitalize="characters"
              isRTL={isRTL}
            />
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

          <View style={[styles.nameRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={styles.nameField}>
              <Input
                label={t('firstName')}
                placeholder={t('firstNamePlaceholder')}
                value={firstName}
                onChangeText={setFirstName}
                leftIcon="person-outline"
                autoCapitalize="words"
                isRTL={isRTL}
              />
            </View>
            <View style={styles.nameField}>
              <Input
                label={t('lastName')}
                placeholder={t('lastNamePlaceholder')}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                isRTL={isRTL}
              />
            </View>
          </View>

          <Input
            label={t('emailAddress')}
            placeholder={t('emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            isRTL={isRTL}
          />

          <Input
            label={t('password')}
            placeholder={t('passwordMinHint')}
            value={password}
            onChangeText={setPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(v => !v)}
            secureTextEntry={!showPassword}
            hint={password.length > 0 && password.length < 8 ? t('passwordMinHint') : undefined}
            isRTL={isRTL}
          />

          <Input
            label={t('confirmPassword')}
            placeholder={t('confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowConfirm(v => !v)}
            secureTextEntry={!showConfirm}
            hint={
              confirmPassword.length > 0 && confirmPassword !== password
                ? t('passwordsDoNotMatch')
                : undefined
            }
            isRTL={isRTL}
          />

          <Button
            label={t('createAccount')}
            onPress={handleRegister}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
          />

          <Text style={[styles.terms, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('registerTerms')}
          </Text>
        </View>

        <View style={[styles.loginRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.loginText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('alreadyHaveAccount')}{'  '}
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.loginLink, { color: colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('signIn')}
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
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13 },
  dividerRow: { alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  googleLoadingText: { fontSize: 12, textAlign: 'center', marginTop: -6 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 17 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14 },
});

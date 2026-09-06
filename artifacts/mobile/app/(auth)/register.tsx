import React, { useEffect, useState } from 'react';
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
import { useStudentAccountsEnabled } from '@/services/features';
import { lookupJoinCode, type JoinRosterEntry } from '@/services/roster';
import { Ionicons } from '@expo/vector-icons';

type SignupRole = 'teacher' | 'parent' | 'student';

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuth();
  const { t, lang, isRTL } = useLanguage();

  // v1 is teacher-only; the server refuses a student or parent registration
  // outright (see lib/features.ts there). Asked of the server rather than
  // mirrored into a build-time constant so the two cannot disagree.
  const studentAccounts = useStudentAccountsEnabled();

  const [role, setRole] = useState<SignupRole>('teacher');
  const [claimCode, setClaimCode] = useState('');
  /** The class behind a join code, or null when the code names its own student (or is simply wrong). */
  const [roster, setRoster] = useState<JoinRosterEntry[] | null>(null);
  const [studentId, setStudentId] = useState('');
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

  /*
    Codes are a fixed six characters, so "long enough to be a code" is the whole
    trigger — no debounce timer to get wrong. A 404 is the ordinary answer for a
    per-student claim code, which needs no picker, so it clears the roster
    rather than surfacing an error; the server is still the thing that decides
    whether the code is real.
  */
  useEffect(() => {
    const code = claimCode.trim();
    if (!studentAccounts || role === 'teacher' || code.length < 6) {
      setRoster(null);
      setStudentId('');
      return;
    }
    let live = true;
    void lookupJoinCode(code)
      .then(res => {
        if (!live) return;
        setRoster(res.students);
        setStudentId('');
      })
      .catch(() => {
        if (!live) return;
        setRoster(null);
        setStudentId('');
      });
    return () => {
      live = false;
    };
  }, [claimCode, role, studentAccounts]);

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
        // Never trust the local selection: the flag can flip while this
        // screen is open, and the server would refuse it anyway.
        role: studentAccounts ? role : 'teacher',
        claimCode: !studentAccounts || role === 'teacher' ? undefined : claimCode.trim(),
        // Only ever sent for a class code. The server checks the name is on
        // that code's class and is not already claimed — this is a choice, not
        // a credential.
        studentId: roster ? studentId : undefined,
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
    (!studentAccounts || role === 'teacher' || claimCode.trim().length > 0) &&
    // A class code without a name picked would be refused by the server; say so
    // by keeping the button off rather than by failing the submit.
    (!roster || studentId !== '');

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

          {/* One option is not a choice — with student accounts off the whole
              selector is noise, and a disabled pill invites the question
              "when?" that this screen cannot answer. */}
          {studentAccounts ? (
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
          ) : null}

          {studentAccounts && role !== 'teacher' ? (
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

          {/*
            Only a whole-class join code needs this: it names no student of its
            own, so the joiner says which name on the roster is theirs. A
            per-student claim code 404s the lookup and this never appears, which
            is what keeps the original flow untouched.

            `taken` means a student account already holds that name. Disabled
            for a student — one account per child — but left open for a parent,
            because both parents linking to the same child is the normal case.
          */}
          {roster && roster.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.pickLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('joinPickYourName')}
              </Text>
              <View style={[styles.nameChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {roster.map(entry => {
                  const blocked = entry.taken && role === 'student';
                  const picked = entry.id === studentId;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => { if (!blocked) setStudentId(entry.id); }}
                      disabled={blocked}
                      style={[
                        styles.nameChip,
                        {
                          borderColor: picked ? colors.primary : colors.border,
                          backgroundColor: picked ? colors.primary + '18' : 'transparent',
                          opacity: blocked ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: picked ? colors.primary : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                        {entry.displayName}
                      </Text>
                      {entry.taken ? (
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10 }}>
                          {t('joinNameTaken')}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
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
  pickLabel: { fontSize: 13 },
  nameChips: { flexWrap: 'wrap', gap: 8 },
  nameChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 17 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14 },
});

import React, { useState } from 'react';
import {
  Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthBrandPanel, useAuthLayout } from '@/components/ui/AuthBrandPanel';
import { AuthModeSwitch } from '@/components/ui/AuthModeSwitch';
import { Button } from '@/components/ui/Button';
import { SuggestFeatureAuthLink } from '@/components/ui/SuggestFeatureAuthLink';
import { GoogleSignInButton, isGoogleSignInAvailable } from '@/components/ui/GoogleSignInButton';
import { Input } from '@/components/ui/Input';
import { PillSelector } from '@/components/ui/PillSelector';
import { CodeSignupForm } from '@/components/CodeSignupForm';
import { useStudentAccountsStatus } from '@/services/features';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { emailNotSent } from '@/services/emailDelivery';
import {
  needsAgeConfirmation, signupForm,
  type SignupRole, type StudentSignupMethod,
} from '@/services/signupMethod';
import { Ionicons } from '@expo/vector-icons';
import { ICON } from '@/constants/icons';
import { BackButton } from '@/components/ui/BackButton';

/**
 * One tick-box row: the terms, and a student's age confirmation. They were two
 * copies of the same markup, and when the terms row was restyled (a framed
 * panel and a dark outline, because `colors.border` is near-white on the card)
 * the copy kept the old look and its leftover `borderWidth` drew a black frame.
 * One component keeps them the same.
 */
function CheckRow({ checked, onPress, isRTL, colors, children }: {
  checked: boolean;
  onPress: () => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      // The row is a framed panel and the unticked box has a dark outline:
      // `colors.border` is near-white on the card, so the box read as empty
      // space and the line beside it as a caption, not something to tick.
      style={[
        styles.termsRow,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          backgroundColor: checked ? colors.primary + '14' : colors.input,
          borderColor: checked ? colors.primary : colors.mutedForeground,
          borderRadius: colors.radius,
        },
      ]}
      accessibilityRole="checkbox"
      // react-native-web 0.21 drops `accessibilityState`; only `aria-*`
      // reaches the DOM, so a screen reader heard an unticked box.
      aria-checked={checked}
    >
      <View style={[
        styles.checkbox,
        {
          borderColor: checked ? colors.primary : colors.mutedForeground,
          backgroundColor: checked ? colors.primary : colors.card,
        },
      ]}>
        {checked && <Ionicons name="checkmark" size={ICON.lg} color={colors.primaryForeground} />}
      </View>
      <Text style={[styles.terms, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', flex: 1 }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { isWide } = useAuthLayout();

  // v1 is teacher-only; the server refuses a student or parent registration
  // outright (see lib/features.ts there). Asked of the server rather than
  // mirrored into a build-time constant so the two cannot disagree.
  const { enabled: studentAccounts, loading: featuresLoading, failed: featuresFailed, retry: retryFeatures } = useStudentAccountsStatus();

  // No default. A pre-selected "teacher" meant a parent or student who scrolled
  // past the picker became a teacher without ever being asked.
  const [role, setRole] = useState<SignupRole | null>(null);
  // With student accounts off there is only one answer, so nothing to ask.
  // If the check itself failed we do NOT know it is teacher-only: defaulting
  // would silently turn an intended student/parent into a teacher.
  const chosenRole: SignupRole | null = featuresFailed ? null : studentAccounts ? role : 'teacher';
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  // A parent signs up from the teacher's code alone (no email, no password, no
  // Google): the code already says who they are, and email can be added later
  // from the profile. A teacher signs up with an email. A student chooses —
  // no default, see services/signupMethod.ts.
  const [studentMethod, setStudentMethod] = useState<StudentSignupMethod | null>(null);
  const form = signupForm(chosenRole, studentMethod);
  const codeSignup = form === 'code';
  // A student with an email has no teacher's code vouching for them, so they
  // confirm they are an adult or have a guardian's agreement.
  const askAge = needsAgeConfirmation(chosenRole, studentMethod);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const readyToSignUp = termsAccepted && (!askAge || ageConfirmed);

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    // The button is blocked until the box is ticked; this is the backstop for
    // a credential that arrives anyway. The server refuses it too.
    if (!termsAccepted) {
      setError(t('errTermsRequired'));
      return;
    }
    if (askAge && !ageConfirmed) {
      setError(t('errAgeConfirmRequired'));
      return;
    }
    setGoogleLoading(true);
    try {
      // Same role the manual form below would send when a pill was picked.
      // With none picked the server defaults to teacher and the mandatory
      // /setup-subjects screen asks the role again — the same path Google
      // from the login screen already takes. No roster code here either: a
      // parent/student claims one afterwards, on the mandatory screen the
      // routing gate sends them to.
      await loginWithGoogle(credential, {
        role: chosenRole ?? undefined,
        acceptedTerms: true,
        ageConfirmed: askAge && ageConfirmed,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      // The server only refuses the pill's role when the existing account can
      // no longer change it (lib/roleSwitch.ts); otherwise it applies it.
      // The role-locked refusals (lib/roleSwitch.ts) are among the codes
      // apiErrorKey translates, alongside every other sign-up refusal.
      setError(apiErrorMessage(e, 'errGoogleFailed', t));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!chosenRole) return;
    setError('');
    setLoading(true);
    try {
      const registered = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        // Never trust the local selection: the flag can flip while this
        // screen is open, and the server would refuse it anyway. No roster
        // code is collected here: a student joins a class later from
        // /join-class, and a parent never gets this form.
        role: chosenRole,
        acceptedTerms: termsAccepted,
        ageConfirmed: askAge && ageConfirmed,
      });
      // No session yet — a password account is unverified until it proves
      // the address it just typed. Google's "Continue with" button above
      // still signs straight in via handleGoogleCredential, unaffected.
      // The account exists either way; if the code email could not be sent the
      // verify screen says so rather than waiting on a message that won't come.
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: registered.email, ...(emailNotSent(registered) ? { sendFailed: '1' } : {}) },
      });
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(apiErrorMessage(e, 'errRegisterFailed', t));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !featuresLoading &&
    chosenRole !== null &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes('@') &&
    password.length >= 8 &&
    // Required, not optional: the server treats any sent value as meaningful,
    // so an empty confirm field was accepted here and refused there with an
    // English "Passwords do not match".
    confirmPassword === password &&
    readyToSignUp;

  const formPanel = (
    <View
      style={[styles.formPanel, isWide && styles.formPanelWide]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: isWide ? 40 : insets.top + 16,
            paddingBottom: insets.bottom + 32,
            maxWidth: isWide ? 560 : 640,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <BackButton color={colors.foreground} style={styles.back} />
        </View>

        <AuthModeSwitch
          mode="register"
          loginLabel={t('signIn')}
          registerLabel={t('createAccount')}
          onSwitch={m => router.replace(m === 'login' ? '/(auth)/login' : '/(auth)/register')}
          colors={colors}
          isRTL={isRTL}
        />

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('createYourAccount')}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('registerSubtitle')}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, borderColor: colors.border }]}>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
            </View>
          ) : null}

          {featuresFailed ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{t('signupUnavailable')}</Text>
              <Pressable onPress={retryFeatures} accessibilityRole="button">
                <Text style={{ color: colors.primary, fontFamily: 'Almarai_700Bold' }}>{t('tryAgain')}</Text>
              </Pressable>
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
              hint={role ? undefined : t('pickRoleFirst')}
              colors={colors}
              isRTL={isRTL}
              accent={colors.primary}
              haptics
            />
          ) : null}

          {/* A student chooses how to sign up. Not a default: with a teacher's
              code they need no email; with an email they need no class. */}
          {chosenRole === 'student' ? (
            <>
              <PillSelector
                label={t('signupMethodLabel')}
                options={[
                  { value: 'code', label: t('signupMethodCode') },
                  { value: 'email', label: t('signupMethodEmail') },
                ]}
                value={studentMethod}
                onChange={setStudentMethod}
                hint={studentMethod ? undefined : t('signupMethodHint')}
                colors={colors}
                isRTL={isRTL}
                accent={colors.primary}
                haptics
              />
              {studentMethod === 'email' ? (
                <Text style={[styles.terms, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('studentEmailNote')}
                </Text>
              ) : null}
            </>
          ) : null}

          {/* Shown whether or not a role pill is picked — hiding it until then
              read as "no Google signup here". /setup-subjects re-asks the role
              for any Google-created account anyway. */}
          {/* Above both ways to sign up, because it governs both. It used to sit
              under «إنشاء حساب» and gate the password form only, so «متابعة
              عبر Google» created accounts nobody had asked to accept anything. */}
          <CheckRow checked={termsAccepted} onPress={() => setTermsAccepted(v => !v)} isRTL={isRTL} colors={colors}>
            {lang === 'ar' ? 'أوافق على ' : 'I agree to the '}
            {/* Underlined: the two links fill most of the sentence, and
                tapping one opened the policy when the tap was meant to tick
                the box. Only «أوافق على» and the box itself toggle. */}
            <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => router.push('/legal/terms')}>
              {t('termsOfService')}
            </Text>
            {lang === 'ar' ? ' و' : ' and '}
            <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => router.push('/legal/privacy')}>
              {t('privacyPolicy')}
            </Text>
          </CheckRow>

          {askAge ? (
            <CheckRow checked={ageConfirmed} onPress={() => setAgeConfirmed(v => !v)} isRTL={isRTL} colors={colors}>
              {t('ageConfirmLabel')}
            </CheckRow>
          ) : null}

          {form === 'choose' ? null : codeSignup ? (
            <CodeSignupForm
              // Remounted per role: the name picker and the typed code belong to
              // the role that was chosen when they were entered.
              key={chosenRole}
              // `signupForm` returns 'code' for a parent or a student only.
              role={chosenRole as 'parent' | 'student'}
              termsAccepted={termsAccepted}
              lang={lang}
              colors={colors}
              isRTL={isRTL}
              t={t}
            />
          ) : (
            <>
          {isGoogleSignInAvailable() && !featuresLoading && (
            <>
              {/* Google draws its own button on web, which has no disabled
                  state; a non-interactive wrapper is the closest thing. */}
              <View
                pointerEvents={readyToSignUp ? 'auto' : 'none'}
                style={{ opacity: readyToSignUp ? 1 : 0.45 }}
                aria-disabled={!readyToSignUp}
              >
                <GoogleSignInButton onCredential={handleGoogleCredential} locale={lang} />
              </View>
              {!readyToSignUp ? (
                <Text style={[styles.googleLoadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                  {t(termsAccepted ? 'ageConfirmFirst' : 'registerAcceptTermsFirst')}
                </Text>
              ) : null}
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
            autoComplete="email"
            textContentType="emailAddress"
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
            rightIconLabel={t(showPassword ? 'hidePasswordA11y' : 'showPasswordA11y')}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
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
            rightIconLabel={t(showConfirm ? 'hidePasswordA11y' : 'showPasswordA11y')}
            secureTextEntry={!showConfirm}
            autoComplete="new-password"
            textContentType="newPassword"
            error={
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
          {!readyToSignUp ? (
            <Text style={[styles.googleLoadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t(termsAccepted ? 'ageConfirmFirst' : 'registerAcceptTermsFirst')}
            </Text>
          ) : null}
            </>
          )}

        </View>

        <SuggestFeatureAuthLink />

      </ScrollView>
    </View>
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, width: '100%', alignSelf: 'center' },
  topRow: { alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20 },
  back: { width: 40 },
  heading: { fontSize: 26, marginBottom: 6 },
  sub: { fontSize: 15, lineHeight: 24, marginBottom: 24 },
  card: { padding: 24, borderWidth: 1, marginBottom: 24, gap: 16 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
  dividerRow: { alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, lineHeight: 21 },
  googleLoadingText: { fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: -6 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },
  termsRow: { alignItems: 'center', gap: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  terms: { fontSize: 13, lineHeight: 20 },
});

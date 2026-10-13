/**
 * Adds an email to an account that signed up from a teacher's code and so has
 * none. Optional, and never in the way: the login code keeps working before,
 * during and after. What an email buys is the ordinary things — signing in with
 * an address and password, and resetting that password by mail.
 *
 * Two steps on one screen, not a trip to `/verify-email`: that route is an
 * "entry" route (services/routeGating.ts) that sends a signed-in person to the
 * tabs, which would throw them out mid-verification.
 *
 * It asks for a password with the address because the existing reset flow needs
 * an account that has one; without it «نسيت كلمة المرور» would find a verified
 * email and nothing to reset (api-server routes/auth.ts, POST /add-email).
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { emailNotSent } from '@/services/emailDelivery';
import { goBack } from '@/services/navigation';
import { SPACE, TYPE } from '@/constants/theme';

type Step = 'details' | 'code' | 'done';

export default function AddEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEmail, verifyEmail } = useAuth();
  const { t, isRTL } = useLanguage();

  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [notSent, setNotSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const align = isRTL ? 'right' : 'left';

  const submitDetails = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await addEmail(email, password);
      setSentTo(res.email);
      setNotSent(emailNotSent(res));
      setStep('code');
    } catch (e: any) {
      setError(apiErrorMessage(e, 'errRegisterFailed', t));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setError('');
    setBusy(true);
    try {
      // Signs in again with a fresh session on success, same as signup does; the
      // person stays on this screen, now with an address on the account.
      await verifyEmail(sentTo, code);
      setStep('done');
    } catch (e: any) {
      setError(apiErrorMessage(e, 'invalidVerificationCode', t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + SPACE.md, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('addEmailTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.xxl, paddingBottom: insets.bottom + SPACE.page, gap: SPACE.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'done' ? (
          <View style={{ alignItems: 'center', gap: SPACE.lg, paddingTop: SPACE.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            <Text style={[styles.body, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' }]}>
              {t('addEmailDone')}
            </Text>
            <Button label={t('joinAnotherClassDone')} onPress={() => goBack()} fullWidth />
          </View>
        ) : (
          <>
            <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {step === 'details' ? t('addEmailSub') : t('addEmailCodeSentTo', sentTo)}
            </Text>

            {step === 'code' && notSent ? (
              <Text style={[styles.body, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('addEmailCodeNotSent')}
              </Text>
            ) : null}

            {error ? (
              <View style={[styles.banner, { backgroundColor: colors.destructive + '14', borderColor: colors.destructive + '33', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
              </View>
            ) : null}

            {step === 'details' ? (
              <>
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
                <Button
                  label={t('addEmailSubmit')}
                  onPress={submitDetails}
                  loading={busy}
                  disabled={!email.includes('@') || password.length < 8}
                  fullWidth
                />
              </>
            ) : (
              <>
                <Input
                  label={t('addEmailCodeLabel')}
                  placeholder={t('verificationCodePlaceholder')}
                  value={code}
                  onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
                  leftIcon="key-outline"
                  keyboardType="number-pad"
                  maxLength={6}
                  isRTL={isRTL}
                />
                <Button
                  label={t('addEmailVerify')}
                  onPress={submitCode}
                  loading={busy}
                  disabled={code.length !== 6}
                  fullWidth
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: SPACE.xs, marginBottom: SPACE.sm },
  title: { fontSize: TYPE.title },
  body: { fontSize: TYPE.body, lineHeight: 24 },
  banner: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1, borderRadius: 12 },
  bannerText: { flex: 1, fontSize: TYPE.body, lineHeight: 24 },
});

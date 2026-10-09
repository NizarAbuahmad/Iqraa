/**
 * Permanent account deletion — Apple 5.1.1(v) and Google Play both require
 * this to exist inside the app, not only as a support address.
 *
 * Its own screen rather than a modal in Settings, for two reasons: it has to
 * say plainly what the deletion reaches before anyone types anything (for a
 * teacher that is their whole roster), and it needs a text field, which
 * `Alert.prompt` only provides on iOS.
 *
 * The proof of identity depends on the account: a password account types its
 * password, a Google-only account signs in with Google again — its email
 * would prove nothing, since every access token carries it in plain text. Which one is asked for comes from `/auth/me`, fetched here
 * rather than read off the auth context — the context is populated by six
 * different responses and only this one endpoint reports `hasPassword`.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { GoogleSignInButton, isGoogleSignInAvailable } from '@/components/ui/GoogleSignInButton';

export default function DeleteAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user, deleteAccount } = useAuth();

  // `undefined` while unknown. Until it resolves the form stays disabled
  // rather than guessing — a Google account shown a password field would burn
  // attempts against a 5-per-hour limit on a password it does not have.
  const [hasPassword, setHasPassword] = useState<boolean | undefined>(undefined);
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ hasPassword?: boolean }>('/auth/me')
      .then(me => {
        // Absent (an older server) is read as "has a password": that is the
        // overwhelmingly common account, and a wrong guess costs one clear
        // 401 rather than an unusable screen.
        if (!cancelled) setHasPassword(me.hasPassword !== false);
      })
      .catch(() => {
        if (!cancelled) setHasPassword(true);
      });
    return () => { cancelled = true; };
  }, []);

  const align = isRTL ? 'right' : 'left';
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);
  const teacher = isTeacherRole(user?.role);
  const ready = hasPassword !== undefined;
  const canSubmit = ready && proof.trim().length > 0 && !busy;

  /** `googleCredential` is the fresh ID token a Google-only account confirms with. */
  const handleDelete = async (googleCredential?: string) => {
    if (hasPassword ? !canSubmit : !googleCredential || busy) {
      setError(t('deleteAccountNeedProof'));
      return;
    }
    const ok = await confirm({
      title: t('deleteAccountConfirmTitle'),
      message: t('deleteAccountConfirmBody'),
      confirmLabel: t('deleteAccountConfirmCta'),
      cancelLabel: t('deleteAccountCancel'),
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await deleteAccount(hasPassword ? { password: proof } : { googleCredential });
      // No navigation here on purpose: clearing the user in AuthContext is an
      // auth transition, and the root layout's effect sends a signed-out app
      // to login. Pushing a route as well would race it.
    } catch (err) {
      setBusy(false);
      // The API's sentence is English; this screen is not.
      setError(t('deleteAccountFailed'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => goBack()} hitSlop={10}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('deleteAccountTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.lead, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('deleteAccountLead')}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {teacher ? t('deleteAccountWhatGoesTeacher') : t('deleteAccountWhatGoesOther')}
        </Text>

        {ready && !hasPassword ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('deleteAccountEmailHint')}
          </Text>
        ) : null}

        {hasPassword === false ? (
          <>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
              {t('deleteAccountEmailLabel')}
            </Text>
            {busy ? (
              <ActivityIndicator color={colors.destructive} />
            ) : isGoogleSignInAvailable() ? (
              // The confirm dialog still follows the sign-in, so picking an
              // account never deletes anything on its own.
              <GoogleSignInButton onCredential={credential => { void handleDelete(credential); }} locale={lang} />
            ) : null}
            {error ? (
              <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {error}
              </Text>
            ) : null}
          </>
        ) : (
        <>
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
          {t('deleteAccountPasswordLabel')}
        </Text>
        <TextInput
          value={proof}
          onChangeText={text => { setProof(text); setError(null); }}
          editable={ready && !busy}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              borderColor: error ? colors.destructive : colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
              textAlign: align,
              fontFamily: 'Almarai_400Regular',
            },
          ]}
        />

        {error ? (
          <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => handleDelete()}
          disabled={!canSubmit}
          accessibilityRole="button"
          style={[
            styles.deleteBtn,
            {
              backgroundColor: colors.destructive,
              borderRadius: colors.radius,
              opacity: canSubmit ? 1 : 0.5,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.destructiveForeground} />
          ) : (
            <Text
              style={[
                styles.deleteBtnText,
                { color: colors.destructiveForeground, fontFamily: 'ReadexPro_700Bold' },
              ]}
            >
              {t('deleteAccountSubmit')}
            </Text>
          )}
        </Pressable>
        </>
        )}

        <Pressable accessibilityRole="button" onPress={() => goBack()} hitSlop={10} disabled={busy} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>
            {t('deleteAccountCancel')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  lead: { fontSize: 15, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 27, marginTop: 12 },
  hint: { fontSize: 15, lineHeight: 25, marginTop: 12 },
  label: { fontSize: 14, marginTop: 28, marginBottom: 8 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  error: { fontSize: 15, lineHeight: 24, marginTop: 8 },
  deleteBtn: { marginTop: 24, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 15 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 14 },
});

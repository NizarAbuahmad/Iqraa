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
 * password, a Google-only account retypes its own email, because there is no
 * hash to check. Which one is asked for comes from `/auth/me`, fetched here
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';

export default function DeleteAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
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
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);
  const teacher = isTeacherRole(user?.role);
  const ready = hasPassword !== undefined;
  const canSubmit = ready && proof.trim().length > 0 && !busy;

  const handleDelete = async () => {
    if (!canSubmit) {
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
      await deleteAccount(
        hasPassword ? { password: proof } : { confirmEmail: proof.trim() },
      );
      // No navigation here on purpose: clearing the user in AuthContext is an
      // auth transition, and the root layout's effect sends a signed-out app
      // to login. Pushing a route as well would race it.
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error && err.message ? err.message : t('deleteAccountFailed'));
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
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
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

        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
          {hasPassword === false ? t('deleteAccountEmailLabel') : t('deleteAccountPasswordLabel')}
        </Text>
        <TextInput
          value={proof}
          onChangeText={text => { setProof(text); setError(null); }}
          editable={ready && !busy}
          secureTextEntry={hasPassword !== false}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={hasPassword === false ? 'email-address' : 'default'}
          textContentType={hasPassword === false ? 'emailAddress' : 'password'}
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
          onPress={handleDelete}
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
                { color: colors.destructiveForeground, fontFamily: 'Cairo_700Bold' },
              ]}
            >
              {t('deleteAccountSubmit')}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={busy} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
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
  body: { fontSize: 14, lineHeight: 25, marginTop: 12 },
  hint: { fontSize: 13, lineHeight: 22, marginTop: 12 },
  label: { fontSize: 14, marginTop: 28, marginBottom: 8 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  error: { fontSize: 13, marginTop: 8 },
  deleteBtn: { marginTop: 24, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 15 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 14 },
});

/**
 * What a student sees while the server holds the account for a parent's approval. Three states from
 * `user.guardianStatus`: needed (no request yet: ask for a parent's email), waiting (a link is out: the only
 * action is to use a different email) and declined (say so, and ask again with another address). The screen
 * re-reads /auth/me every 20 seconds and when the app comes back to the foreground; the root layout moves the
 * student off it the moment the status stops being a held one, so nothing here navigates after an approval.
 *
 * There is no plain "send the same link again": the app holds only the masked address, and
 * POST /auth/guardian-request needs a real one. Typing the same address again does the job, and the server
 * supersedes the old link.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Surface } from '@/components/ui/Surface';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { ICON } from '@/constants/icons';
import { SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { guardianApi } from '@/services/guardianApi';
import { looksLikeEmail } from '@/services/guardianApproval';

export default function GuardianWaitingScreen() {
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const { user, logout, refreshUser, switchRole } = useAuth();

  const status = user?.guardianStatus;
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [note, setNote] = useState('');
  const insets = useSafeAreaInsets();

  const poll = useCallback(async () => { await refreshUser(); }, [refreshUser]);
  usePollingRefresh(poll);

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const masked = user?.guardianParentEmailMasked ?? '';
  const waitingView = status === 'waiting' && !editing;
  const askForEmail = status === 'needed' || status === 'declined' || editing;
  const canSend = looksLikeEmail(email) && !busy;

  async function send(address: string) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const out = await guardianApi.request(address.trim());
      // The request is saved either way; a failed email must not read as if nothing was recorded.
      setNote(out.emailSent ? t('guardianSentTo', out.parentEmailMasked) : t('guardianSavedNotSent'));
      setEditing(false);
      setEmail('');
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, 'guardianSendFailed', t));
      // A 409 (already approved, not required) means the state changed under us; let the gate move us promptly.
      void refreshUser();
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setChecking(true);
    setError('');
    await refreshUser();
    setChecking(false);
  }

  async function leaveAs(role: 'parent' | 'teacher') {
    setSwitching(true);
    setSwitchError('');
    try {
      await switchRole(role);
      // The role is no longer student, so the root layout moves this screen on.
    } catch (e) {
      setSwitchError(apiErrorMessage(e, 'guardianSwitchFailed', t));
    } finally {
      setSwitching(false);
    }
  }

  const title = status === 'declined' ? t('guardianDeclinedTitle') : waitingView ? t('guardianWaitingTitle') : t('guardianNeededTitle');
  const desc =
    status === 'declined' ? t('guardianDeclinedDesc')
    : waitingView ? t('guardianWaitingDesc', masked)
    : t('guardianNeededDesc');

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACE.section, paddingBottom: insets.bottom + SPACE.section }]}
      keyboardShouldPersistTaps="handled"
    >
      <Surface style={styles.card}>
        <View style={[styles.head, { flexDirection: rowDir }]}>
          <Ionicons name="time-outline" size={ICON.xl} color={readableOn(colors.primary, colors.card, 3)} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
            {title}
          </Text>
        </View>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{desc}</Text>

        {askForEmail ? (
          <View style={styles.form}>
            <Input
              label={t('guardianParentEmailLabel')}
              hint={t('guardianParentEmailHint')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              isRTL={isRTL}
            />
            <Button label={t('guardianSend')} onPress={() => send(email)} disabled={!canSend} loading={busy} fullWidth style={{ marginTop: SPACE.md }} />
            {editing ? (
              <Button label={t('cancel')} variant="ghost" onPress={() => { setEditing(false); setEmail(''); }} fullWidth style={{ marginTop: SPACE.sm }} />
            ) : null}
          </View>
        ) : (
          <Button label={t('guardianChangeEmail')} variant="secondary" onPress={() => setEditing(true)} fullWidth style={{ marginTop: SPACE.lg }} />
        )}

        {note ? <Text accessibilityLiveRegion="polite" style={[styles.desc, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{note}</Text> : null}
        {error ? <Text accessibilityLiveRegion="polite" style={[styles.desc, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text> : null}

        <Button label={t('guardianCheckNow')} variant="ghost" onPress={checkNow} loading={checking} fullWidth style={{ marginTop: SPACE.sm }} />
      </Surface>

      <Surface style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/join-class')} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: readableOn(colors.primary, colors.card, 4.5), fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
            {t('guardianJoinWithCode')}
          </Text>
        </Pressable>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{t('guardianWrongTypeTitle')}</Text>
        <View style={[styles.switchRow, { flexDirection: rowDir }]}>
          <Button label={t('guardianSwitchToParent')} variant="secondary" size="sm" onPress={() => leaveAs('parent')} disabled={switching} style={{ flex: 1 }} />
          <Button label={t('guardianSwitchToTeacher')} variant="secondary" size="sm" onPress={() => leaveAs('teacher')} disabled={switching} style={{ flex: 1 }} />
        </View>
        {switchError ? <Text accessibilityLiveRegion="polite" style={[styles.desc, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{switchError}</Text> : null}
      </Surface>

      <View style={[styles.exits, { flexDirection: rowDir }]}>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('signOut')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.destructive, fontFamily: 'Almarai_400Regular' }]}>{t('deleteAccount')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE.lg, gap: SPACE.lg },
  card: { padding: SPACE.lg },
  head: { alignItems: 'center', gap: SPACE.md },
  title: { fontSize: TYPE.bodyLg, flex: 1 },
  desc: { fontSize: TYPE.body, lineHeight: 24, marginTop: SPACE.md },
  form: { marginTop: SPACE.lg },
  linkRow: { minHeight: 44, justifyContent: 'center', paddingVertical: SPACE.sm },
  linkText: { fontSize: TYPE.body },
  switchRow: { gap: SPACE.sm, marginTop: SPACE.md },
  exits: { justifyContent: 'space-between', paddingHorizontal: SPACE.sm },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { versionLabel } from '@/services/versionLabel';
import { goBack } from '@/services/navigation';
import { ApiError, apiJson } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useStudentAccountsEnabled } from '@/services/features';
import { PillSelector } from '@/components/ui/PillSelector';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { AccountRow } from '@/components/ui/AccountRow';
import { confirm } from '@/services/confirm';
import { dateLocale } from '@/services/dateLabels';

type AiUsage = { spentUsd: number | null; limitUsd: number; resetsAt: string };

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang, toggleLang } = useLanguage();
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const { user, switchRole, savedAccounts, switchAccount, addAccount, forgetAccount } = useAuth();
  const studentAccounts = useStudentAccountsEnabled();
  // A teacher account made by mistake (the old pre-selected signup pill, or
  // Google on the login screen) can still become a parent/student while it
  // owns no class or student — the server decides (lib/roleSwitch.ts).
  const canChangeType = studentAccounts && user?.role === 'teacher';
  const [typeOpen, setTypeOpen] = useState(false);
  const [nextRole, setNextRole] = useState<'parent' | 'student' | null>(null);
  const [switching, setSwitching] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState('');

  // Verifies real Expo push delivery without a second account to message you
  // — see POST /messaging/device-tokens/test. Native only: web never
  // registers a token (services/pushTokens.ts), so there's nothing to send to.
  const handleTestNotification = async () => {
    if (sendingTest) return;
    setSendingTest(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiJson('/messaging/device-tokens/test', { method: 'POST' });
      setToast(t('testNotificationSent'));
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setToast(e instanceof ApiError ? e.message : t('testNotificationFailed'));
    } finally {
      setSendingTest(false);
    }
  };

  // Several accounts on one device. `accountBusy` is the user id being switched
  // to, or 'add' — one at a time, and every other row is inert meanwhile.
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [accountError, setAccountError] = useState('');
  const roleLabelFor = (role: string) =>
    t(role === 'parent' ? 'roleParent'
      : role === 'student' ? 'roleStudent'
      : role === 'school_admin' ? 'roleAdmin'
      : role === 'system_admin' ? 'roleSysAdmin'
      : 'roleTeacher');

  const handleSwitchAccount = async (userId: string) => {
    if (accountBusy) return;
    setAccountBusy(userId);
    setAccountError('');
    try {
      await switchAccount(userId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The tab bar and the routing gates follow the new role; this only has to
      // leave a screen that may not exist for it.
      router.replace('/(tabs)');
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAccountError(t(e instanceof ApiError && e.code === 'session_expired' ? 'accountsSessionExpired' : 'accountsSwitchFailed'));
      setAccountBusy(null);
    }
  };

  const handleAddAccount = async () => {
    if (accountBusy) return;
    setAccountBusy('add');
    setAccountError('');
    try {
      // On success the open account becomes null and the routing gate opens the
      // login screen, where this one is listed and one tap from coming back.
      await addAccount();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAccountError(t(e instanceof Error && e.message === 'too_many_accounts' ? 'accountsLimit' : 'accountsAddFailed'));
      setAccountBusy(null);
    }
  };

  const handleForgetAccount = async (userId: string, name: string) => {
    if (accountBusy) return;
    const ok = await confirm({
      title: t('accountsRemoveConfirm', name),
      message: t('accountsRemoveNote'),
      confirmLabel: t('accountsRemove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setAccountError('');
    await forgetAccount(userId);
  };

  const handleSwitchRole = async () => {
    if (!nextRole || switching) return;
    setSwitching(true);
    setTypeError('');
    try {
      // On success the routing gate moves the account to /claim-required.
      await switchRole(nextRole);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTypeError(t(e instanceof ApiError && e.code === 'role_locked_teaching' ? 'accountTypeLockedTeaching' : 'claimRequiredSwitchFailed'));
      setSwitching(false);
    }
  };

  // Hidden unless there is a cap and a known spend: an older server, a failed
  // request or an unreadable ledger all leave the row out rather than show 0%.
  useEffect(() => {
    let cancelled = false;
    apiJson<AiUsage>('/auth/me/ai-usage')
      .then(u => { if (!cancelled && u.limitUsd > 0 && u.spentUsd !== null) setUsage(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const usedPct = usage ? Math.min(100, Math.round(((usage.spentUsd ?? 0) / usage.limitUsd) * 100)) : 0;

  const handleToggleLanguage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleLang();
  };

  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  // Read inline rather than in a hook or service: `pnpm test` is bare
  // `node --test` with no RN transform, so a module importing expo-updates at
  // module scope cannot be loaded by the runner. Only the formatting is
  // extracted (services/versionLabel.ts), and that part is tested.
  const buildLabel = versionLabel({
    appVersion: Constants.expoConfig?.version,
    updateId: Updates.updateId,
    channel: Updates.channel,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => goBack()} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('settingsTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Accounts on this device. First, because switching is the thing a
            person with two accounts opens Settings to do. The open account is
            listed too, ticked, so the card reads as "who am I right now". */}
        {user && (
          <>
            <SectionLabel label={t('accountsSection')} isRTL={isRTL} colors={colors} />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <AccountRow
                name={`${user.firstName} ${user.lastName}`.trim()}
                email={user.email}
                roleLabel={roleLabelFor(user.role)}
                current
                colors={colors}
                isRTL={isRTL}
              />
              {savedAccounts.map((a, i) => (
                <React.Fragment key={a.userId}>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <AccountRow
                    name={a.name}
                    email={a.email}
                    roleLabel={roleLabelFor(a.role)}
                    badge={i === 0 ? t('accountsLastUsed') : undefined}
                    busy={accountBusy === a.userId}
                    disabled={!!accountBusy}
                    onPress={() => void handleSwitchAccount(a.userId)}
                    onRemove={() => void handleForgetAccount(a.userId, a.name)}
                    removeLabel={t('accountsRemove')}
                    colors={colors}
                    isRTL={isRTL}
                  />
                </React.Fragment>
              ))}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingRow
                icon="person-add-outline"
                label={t('accountsAdd')}
                isRTL={isRTL}
                colors={colors}
                onPress={() => void handleAddAccount()}
                right={accountBusy === 'add' ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
              />
            </View>
            {accountError ? (
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
                {accountError}
              </Text>
            ) : null}
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {t('accountsAddNote')}{Platform.OS !== 'web' ? ` ${t('accountsPushNote')}` : ''}
            </Text>
          </>
        )}

        {/* Language */}
        <SectionLabel label={t('languageSection')} isRTL={isRTL} colors={colors} top={!!user} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="language-outline"
            label={t('arabicEnglish')}
            isRTL={isRTL}
            colors={colors}
            right={
              <Pressable
                onPress={handleToggleLanguage}
                style={[styles.langToggle, { backgroundColor: lang === 'ar' ? colors.primary : colors.muted, borderRadius: 20 }]}
              >
                <Text style={[{ color: lang === 'ar' ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }]}>
                  {lang === 'ar' ? 'عربي' : 'English'}
                </Text>
              </Pressable>
            }
          />
        </View>

        {/* Notifications. Two switches used to sit above the test row —
            «تنبيهات داخل التطبيق» and «تحديثات البريد» — and were local
            component state wired to nothing: no server preference, no email
            digest to opt out of, and the unread badge ignored them. They reset
            on every visit. A control that lies is worse than none, so the
            section now holds only the row that does something, and that row is
            native-only (web never registers a push token), so web has no
            section at all. */}
        {Platform.OS !== 'web' && (
          <>
            <SectionLabel label={t('notificationsSection')} isRTL={isRTL} colors={colors} top />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <SettingRow
                icon="paper-plane-outline"
                label={t('sendTestNotification')}
                isRTL={isRTL}
                colors={colors}
                onPress={handleTestNotification}
                right={sendingTest ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
              />
            </View>
          </>
        )}

        {/* About */}
        <SectionLabel label={t('aboutSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="information-circle-outline"
            label={t('version')}
            isRTL={isRTL}
            colors={colors}
            right={<Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 }]}>{buildLabel}</Text>}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="shield-checkmark-outline"
            label={t('privacyPolicy')}
            isRTL={isRTL}
            colors={colors}
            onPress={() => router.push('/legal/privacy' as any)}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="document-text-outline"
            label={t('termsOfService')}
            isRTL={isRTL}
            colors={colors}
            onPress={() => router.push('/legal/terms' as any)}
          />
        </View>

        {/* Account. Deleting is the only row here, and it is deliberately last
            and on its own card — both stores require the path to exist, and
            nothing else in Settings is irreversible. */}
        <SectionLabel label={t('accountSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {usage && (
            <>
              <SettingRow
                icon="sparkles-outline"
                label={t('aiUsage')}
                isRTL={isRTL}
                colors={colors}
                right={<Text style={{ color: usedPct >= 100 ? colors.destructive : colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{usedPct}%</Text>}
              />
              <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 6 }}>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: usedPct }}
                  style={[styles.meterTrack, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <View style={{ width: `${usedPct}%`, backgroundColor: usedPct >= 100 ? colors.destructive : colors.primary, borderRadius: 3 }} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                  {t('aiUsageResets')} {new Date(usage.resetsAt).toLocaleDateString(dateLocale(lang === 'ar' ? 'ar' : 'en'), { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}
          {canChangeType && (
            <>
              <SettingRow
                icon="person-circle-outline"
                label={t('accountType')}
                isRTL={isRTL}
                colors={colors}
                right={<Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t('roleTeacher')}</Text>}
                onPress={() => { setTypeOpen(o => !o); setNextRole(null); setTypeError(''); }}
              />
              {typeOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                  <PillSelector
                    label={t('claimRequiredPickRole')}
                    hint={t('accountTypeSwitchNote')}
                    options={[
                      { value: 'parent', label: t('roleParent') },
                      { value: 'student', label: t('roleStudent') },
                    ]}
                    value={nextRole}
                    onChange={setNextRole}
                    colors={colors}
                    isRTL={isRTL}
                    accent={colors.primary}
                    haptics
                    containerStyle={{ marginBottom: 12 }}
                  />
                  {typeError ? (
                    <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>
                      {typeError}
                    </Text>
                  ) : null}
                  <Button
                    label={t('claimRequiredSwitchSubmit')}
                    onPress={handleSwitchRole}
                    loading={switching}
                    disabled={!nextRole || switching}
                    size="sm"
                  />
                </View>
              )}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}
          <SettingRow
            icon="trash-outline"
            label={t('deleteAccount')}
            isRTL={isRTL}
            colors={colors}
            destructive
            onPress={() => router.push('/delete-account' as any)}
          />
        </View>
      </ScrollView>
      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

function SectionLabel({ label, isRTL, colors, top }: { label: string; isRTL: boolean; colors: ReturnType<typeof useColors>; top?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', marginTop: top ? 20 : 0, textAlign: isRTL ? 'right' : 'left' }]}>
      {label}
    </Text>
  );
}

function SettingRow({ icon, label, colors, isRTL, right, onPress, destructive }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  colors: ReturnType<typeof useColors>; isRTL: boolean;
  right?: React.ReactNode; onPress?: () => void;
  /** Tints the row red. Only the irreversible one should set it. */
  destructive?: boolean;
}) {
  const tint = destructive ? colors.destructive : colors.primary;
  const inner = (
    <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: 'ReadexPro_500Medium', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View style={{ marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
        {right ?? <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />}
      </View>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>{inner}</Pressable>;
  return inner;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 8, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28 },
  sectionLabel: { fontSize: 11, marginBottom: 8 },
  card: { borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  settingRow: { alignItems: 'center', padding: 16, gap: 12 },
  settingLabel: { fontSize: 15 },
  divider: { height: 1, marginHorizontal: 16 },
  langToggle: { paddingHorizontal: 14, paddingVertical: 7 },
  meterTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
});

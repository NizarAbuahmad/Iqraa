import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { versionLabel } from '@/services/versionLabel';
import { ApiError, apiJson } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useStudentAccountsEnabled } from '@/services/features';
import { PillSelector } from '@/components/ui/PillSelector';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { AccountRow } from '@/components/ui/AccountRow';
import { confirm } from '@/services/confirm';
import { getPickerGrades } from '@/services/curriculumData';
import { dateLocale } from '@/services/dateLabels';
import { askForPushPermission, getPushPermissionState, pushAskCopy, type PushPermissionState } from '@/services/pushTokens';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { BackButton } from '@/components/ui/BackButton';
import { IconTile } from '@/components/ui/IconTile';
import { CheckRow } from '@/components/ui/CheckRow';
import { guardianConfigStale, switchNeedsAgeConfirmation } from '@/services/signupMethod';
import { resetGuardianConfigCache, useGuardianConfig } from '@/services/guardianConfig';
import type { GlyphId } from '@/constants/glyphs';
import { SPACE, TYPE } from '@/constants/theme';
import { PUSH_PREF_ROWS, showsFamilyPushPrefs, withPref, type PushPrefCategory, type PushPrefs } from '@/services/pushPrefs';
import { fetchPushPrefs, savePushPref } from '@/services/pushPrefsApi';

const PREF_ICON: Record<PushPrefCategory, keyof typeof Ionicons.glyphMap> = {
  homework: 'book-outline',
  exams: 'calendar-outline',
  results: 'ribbon-outline',
};
/** A category with an Iqraa drawing (`constants/glyphs.ts`) draws it in place of its stock icon. */
const PREF_GLYPH: Partial<Record<PushPrefCategory, GlyphId>> = { homework: 'homework' };

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
  // A student with no class can too (since 2026-10-23): the claim screen used
  // to be their way out, and an email student is no longer sent there.
  const canChangeType = studentAccounts && (
    user?.role === 'teacher' || (user?.role === 'student' && user.hasRosterLink === false)
  );
  const [typeOpen, setTypeOpen] = useState(false);
  const [nextRole, setNextRole] = useState<'teacher' | 'parent' | 'student' | null>(null);
  // Becoming a student asks what signing up as one asks: an adult, or a
  // guardian's agreement. The server refuses the switch without it.
  // When the server has a parent approve email students (guardian.enabled) the
  // tick goes and a one-line note says the account will wait for a parent.
  const guardian = useGuardianConfig();
  const [ageOk, setAgeOk] = useState(false);
  const askAge = nextRole !== null && switchNeedsAgeConfirmation(user?.role, nextRole, guardian.enabled);
  const noteParent = guardian.enabled && nextRole === 'student' && user?.role !== 'student';
  const [switching, setSwitching] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState('');

  // Whether this device will get pushes at all. Re-read when the app comes
  // back to the foreground (usePollingRefresh), which is how a user returns
  // from system settings after changing it there.
  const [pushState, setPushState] = useState<PushPermissionState | null>(null);
  const loadPushState = useCallback(async () => setPushState(await getPushPermissionState()), []);
  useEffect(() => { void loadPushState(); }, [loadPushState]);
  usePollingRefresh(loadPushState);

  // School notifications (homework, exam dates, results): an ACCOUNT setting
  // on the server (GET/PUT /auth/me/push-preferences), so it is shown on web
  // too — it decides what reaches this account's phones. Only parents and
  // students are sent these pushes. Re-read when the open account changes.
  const showsSchoolPrefs = showsFamilyPushPrefs(user?.role);
  const [schoolPrefs, setSchoolPrefs] = useState<PushPrefs | null>(null);
  const [schoolPrefsFailed, setSchoolPrefsFailed] = useState(false);
  const [savingPref, setSavingPref] = useState<PushPrefCategory | null>(null);
  useEffect(() => {
    setSchoolPrefs(null);
    setSchoolPrefsFailed(false);
    if (!showsSchoolPrefs) return;
    let cancelled = false;
    fetchPushPrefs()
      .then(p => { if (!cancelled) setSchoolPrefs(p); })
      .catch(() => { if (!cancelled) setSchoolPrefsFailed(true); });
    return () => { cancelled = true; };
  }, [showsSchoolPrefs, user?.id]);

  // The account a save belongs to: if the open account changes while a save is
  // in flight, its answer must not be written into the new account's card.
  const prefsOwner = useRef(user?.id);
  prefsOwner.current = user?.id;

  // Optimistic: the switch moves at once; a failed save puts it back and says so.
  const handleSchoolPref = async (category: PushPrefCategory, on: boolean) => {
    if (!schoolPrefs || savingPref) return;
    const owner = user?.id;
    const before = schoolPrefs;
    setSchoolPrefs(withPref(schoolPrefs, category, on));
    setSavingPref(category);
    try {
      const saved = await savePushPref(category, on);
      if (prefsOwner.current === owner) setSchoolPrefs(saved);
    } catch {
      if (prefsOwner.current !== owner) return;
      setSchoolPrefs(before);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setToast(t('pushPrefsSaveFailed'));
    } finally {
      setSavingPref(null);
    }
  };

  // Off: our explanation, then the OS prompt — or system settings once
  // Android no longer prompts. On: system settings, where the per-kind
  // channels (messages, homework, exam dates, results, reminders) can be muted one by one.
  const handlePushRow = async () => {
    if (pushState === 'granted') {
      void Linking.openSettings();
      return;
    }
    setPushState(await askForPushPermission({ explicit: true, copy: pushAskCopy(t) }));
  };

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
  // The class(es) a parent or student picked, as the row's right-hand text.
  const classSummary = getPickerGrades()
    .filter(g => user?.gradeIds?.includes(g.id))
    .map(g => (lang === 'ar' ? g.nameAr : g.name))
    .join(lang === 'ar' ? '، ' : ', ');
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
    if (askAge && !ageOk) { setTypeError(t('errAgeConfirmRequired')); return; }
    setSwitching(true);
    setTypeError('');
    try {
      // On success the routing gate moves the account on: a parent to
      // /claim-required, a teacher to /setup-subjects, a student into the app.
      await switchRole(nextRole, { ageConfirmed: askAge && ageOk });
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // The server's switch differs from the copy this screen read: ask again.
      if (e instanceof ApiError && guardianConfigStale(e.code)) { resetGuardianConfigCache(); guardian.refresh(); }
      setTypeError(t(
        e instanceof ApiError && e.code === 'role_locked_teaching' ? 'accountTypeLockedTeaching'
          : e instanceof ApiError && e.code === 'age_confirmation_required' ? 'errAgeConfirmRequired'
          : 'claimRequiredSwitchFailed',
      ));
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
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
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
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
                {accountError}
              </Text>
            ) : null}
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {t('accountsAddNote')}{Platform.OS !== 'web' ? ` ${t('accountsPushNote')}` : ''}
            </Text>
          </>
        )}

        {/* Language */}
        {/* A parent or student picks which class(es) the curriculum shows. */}
        {user && (user.role === 'parent' || user.role === 'student') && (
          <>
            <SectionLabel label={t(user.role === 'parent' ? 'classSettingRowParent' : 'classSettingRow')} isRTL={isRTL} colors={colors} top />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <SettingRow
                icon="school-outline"
                label={t(user.role === 'parent' ? 'classSettingRowParent' : 'classSettingRow')}
                isRTL={isRTL}
                colors={colors}
                right={<Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{classSummary || t('classSettingNotSet')}</Text>}
                onPress={() => router.push({ pathname: '/setup-grade', params: { mode: 'edit' } } as any)}
              />
            </View>
          </>
        )}

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
            section holds only rows backed by something real: the OS
            permission (pushState) and the test send. Both are native-only
            (web never registers a push token), so web has no such section. */}
        {Platform.OS !== 'web' && (
          <>
            <SectionLabel label={t('notificationsSection')} isRTL={isRTL} colors={colors} top />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <SettingRow
                icon={pushState === 'granted' ? 'notifications-outline' : 'notifications-off-outline'}
                label={t('pushStatusLabel')}
                isRTL={isRTL}
                colors={colors}
                onPress={handlePushRow}
                right={
                  pushState ? (
                    <Text style={{ color: pushState === 'granted' ? colors.primary : colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                      {pushState === 'granted' ? t('pushStatusOn') : t('pushStatusOff')}
                    </Text>
                  ) : <View />
                }
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
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

        {/* School notifications: three server-backed switches (not the OS
            permission above, and not native-only — they are an account
            setting). Unlike the notifications section's old switches, every
            control here reads and writes the server. */}
        {showsSchoolPrefs && (
          <>
            <SectionLabel label={t('pushPrefsSection')} isRTL={isRTL} colors={colors} top />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {schoolPrefs === null ? (
                <View style={{ padding: SPACE.lg }}>
                  {schoolPrefsFailed ? (
                    <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: isRTL ? 'right' : 'left' }}>
                      {t('pushPrefsLoadFailed')}
                    </Text>
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>
              ) : (
                PUSH_PREF_ROWS.map((row, i) => (
                  <React.Fragment key={row.category}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <IconTile icon={PREF_ICON[row.category]} glyph={PREF_GLYPH[row.category]} color={colors.primary} size={36} />
                      <View style={{ flex: 1, gap: SPACE.xxs }}>
                        <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                          {t(row.labelKey)}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                          {t(row.hintKey)}
                        </Text>
                      </View>
                      <Switch
                        value={schoolPrefs[row.category]}
                        onValueChange={on => void handleSchoolPref(row.category, on)}
                        disabled={savingPref !== null}
                        accessibilityLabel={t(row.labelKey)}
                        aria-checked={schoolPrefs[row.category]}
                        trackColor={{ true: colors.primary, false: colors.border }}
                      />
                    </View>
                  </React.Fragment>
                ))
              )}
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, marginTop: SPACE.sm, textAlign: isRTL ? 'right' : 'left' }}>
              {t('pushPrefsNote')}
            </Text>
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
            right={<Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 }]}>{buildLabel}</Text>}
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
        {(usage || canChangeType) && (
        <>
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
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                  {t('aiUsageResets')} {new Date(usage.resetsAt).toLocaleDateString(dateLocale(lang === 'ar' ? 'ar' : 'en'), { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </Text>
              </View>
              {canChangeType && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </>
          )}
          {canChangeType && (
            <>
              <SettingRow
                icon="person-circle-outline"
                label={t('accountType')}
                isRTL={isRTL}
                colors={colors}
                right={<Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t(user?.role === 'student' ? 'roleStudent' : 'roleTeacher')}</Text>}
                onPress={() => { setTypeOpen(o => !o); setNextRole(null); setAgeOk(false); setTypeError(''); }}
              />
              {typeOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                  <PillSelector
                    label={t('claimRequiredPickRole')}
                    hint={t('accountTypeSwitchNote')}
                    options={
                      user?.role === 'student'
                        ? [
                            { value: 'teacher', label: t('roleTeacher') },
                            { value: 'parent', label: t('roleParent') },
                          ]
                        : [
                            { value: 'parent', label: t('roleParent') },
                            { value: 'student', label: t('roleStudent') },
                          ]
                    }
                    value={nextRole}
                    onChange={setNextRole}
                    colors={colors}
                    isRTL={isRTL}
                    accent={colors.primary}
                    haptics
                    containerStyle={{ marginBottom: 12 }}
                  />
                  {askAge ? (
                    <View style={{ marginBottom: 12 }}>
                      <CheckRow checked={ageOk} onPress={() => setAgeOk(v => !v)} isRTL={isRTL} colors={colors}>
                        {t('ageConfirmLabel')}
                      </CheckRow>
                    </View>
                  ) : null}
                  {noteParent ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 22, marginBottom: SPACE.md, textAlign: isRTL ? 'right' : 'left' }}>
                      {t('guardianSwitchNote')}
                    </Text>
                  ) : null}
                  {typeError ? (
                    <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>
                      {typeError}
                    </Text>
                  ) : null}
                  <Button
                    label={t('claimRequiredSwitchSubmit')}
                    onPress={handleSwitchRole}
                    loading={switching}
                    disabled={!nextRole || switching || (askAge && !ageOk)}
                    size="sm"
                  />
                </View>
              )}
            </>
          )}
        </View>
        </>
        )}

        {/* Its own card, last: it used to sit one row under the account-type
            switch, two very different kinds of «change my account» touching. */}
        <SectionLabel label={t('dangerZoneSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
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
      <IconTile icon={icon} color={tint} size={36} />
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
  settingRow: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  settingLabel: { fontSize: 15 },
  divider: { height: 1, marginHorizontal: 16 },
  langToggle: { paddingHorizontal: 14, paddingVertical: 7 },
  meterTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
});

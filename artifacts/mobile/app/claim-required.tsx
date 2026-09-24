/**
 * Mandatory stop for a parent/student account with zero roster links —
 * reached only via the routing gate in `app/_layout.tsx`
 * (`needsRosterClaim`), never by user navigation. Unlike `join-class.tsx`
 * (an optional "add another class" screen for an already-onboarded user)
 * this has no back button and no skip: every data-serving endpoint scopes by
 * rosterLinks.userId, so there is nothing for this account to do until it
 * claims one. Shares the code-lookup-and-picker flow with `join-class.tsx`
 * via `useJoinCodeLookup` and `RosterCodeClaimForm`.
 *
 * It does carry the one way back out, because the role that put the account
 * here was picked once on the register screen and never shown again: this
 * screen names the account type and offers the picker to correct it
 * (POST /auth/role, open only while nothing is linked). Without it, choosing
 * parent when you meant teacher was a dead end — no back button here,
 * registering again on the same email is refused, and Google hands back the
 * role already stored. The title and hint are role-specific for the same
 * reason: a student was being told to link their child's class.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { PillSelector } from '@/components/ui/PillSelector';
import { useAuth } from '@/context/AuthContext';
import { useJoinCodeLookup } from '@/hooks/useJoinCodeLookup';
import { RosterCodeClaimForm } from '@/components/RosterCodeClaimForm';
import { RosterError, claimRosterCode } from '@/services/roster';
import { claimErrorKey } from '@/services/claimCodeGate';

/** The three the register screen offers — and the only three POST /auth/role takes. */
type SwitchableRole = 'teacher' | 'parent' | 'student';

export default function ClaimRequiredScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user, markRosterClaimed, switchRole } = useAuth();

  const { code, setCode, roster, className, studentId, setStudentId, state, canSubmit: canSubmitCode } = useJoinCodeLookup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const role: SwitchableRole = user?.role === 'student' || user?.role === 'teacher' ? user.role : 'parent';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nextRole, setNextRole] = useState<SwitchableRole>(role);
  const [switching, setSwitching] = useState(false);

  const align = isRTL ? 'right' : 'left';
  const canSubmit = canSubmitCode && !submitting;
  const roleLabel = (r: SwitchableRole) =>
    t(r === 'teacher' ? 'roleTeacher' : r === 'student' ? 'roleStudent' : 'roleParent');

  const handleSwitchRole = async () => {
    if (switching) return;
    if (nextRole === role) { setPickerOpen(false); return; }
    setSwitching(true);
    setError('');
    try {
      await switchRole(nextRole);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPickerOpen(false);
      // A teacher is not held by this gate at all, and nothing pushes them off
      // a screen they are merely allowed to sit on — so hand them over here.
      // A parent/student stays put: still unlinked, now reading its own wording.
      if (nextRole === 'teacher') router.replace('/(tabs)');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('claimRequiredSwitchFailed'));
    } finally {
      setSwitching(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      markRosterClaimed();
      router.replace('/(tabs)');
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t(err instanceof RosterError ? claimErrorKey(err.code) : 'joinAnotherClassFailed'));
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="key-outline" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t(role === 'student' ? 'claimRequiredTitleStudent' : 'claimRequiredTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(role === 'student' ? 'claimRequiredDescStudent' : 'claimRequiredDesc')}
        </Text>

        <View style={[styles.roleCard, { borderColor: colors.border, backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <View style={[styles.roleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="person-circle-outline" size={18} color={colors.mutedForeground} />
            <Text style={[styles.roleText, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
              {t('claimRequiredSignedInAs', roleLabel(role))}
            </Text>
          </View>
          {user?.email ? (
            <Text style={[styles.roleEmail, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {user.email}
            </Text>
          ) : null}

          {pickerOpen ? (
            <View style={{ marginTop: 12 }}>
              <PillSelector
                label={t('claimRequiredPickRole')}
                hint={t('claimRequiredSwitchNote')}
                options={[
                  { value: 'teacher', label: t('roleTeacher') },
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
              <View style={[styles.roleActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Button
                  label={t('claimRequiredSwitchSubmit')}
                  onPress={handleSwitchRole}
                  loading={switching}
                  disabled={nextRole === role || switching}
                  size="sm"
                />
                <Button
                  label={t('cancel')}
                  variant="ghost"
                  size="sm"
                  disabled={switching}
                  onPress={() => { setNextRole(role); setPickerOpen(false); }}
                />
              </View>
            </View>
          ) : (
            <Pressable
              /* Seeded on open, not on mount: `role` reads from a user that
                 may arrive a render later, and a picker left holding the
                 mount-time default would offer to change an account to the
                 role it already has. */
              onPress={() => { setNextRole(role); setPickerOpen(true); }}
              hitSlop={8}
            >
              <Text style={[styles.roleLink, { color: colors.primary, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                {t('claimRequiredWrongRole')}
              </Text>
            </Pressable>
          )}
        </View>

        <RosterCodeClaimForm
          code={code}
          onChangeCode={setCode}
          roster={roster}
          className={className}
          studentId={studentId}
          onSelectStudent={setStudentId}
          state={state}
          userRole={user?.role}
          colors={colors}
          isRTL={isRTL}
          t={t}
        />

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          label={t('claimRequiredSubmit')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  roleCard: { borderWidth: 1, padding: 14, marginBottom: 24 },
  roleRow: { alignItems: 'center', gap: 8 },
  roleText: { flex: 1, fontSize: 14 },
  roleEmail: { fontSize: 12, lineHeight: 19, marginTop: 4 },
  roleLink: { fontSize: 13, marginTop: 10 },
  roleActions: { gap: 8, alignItems: 'center' },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 21 },
});

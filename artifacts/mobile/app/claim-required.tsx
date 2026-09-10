/**
 * Mandatory stop for a parent/student account with zero roster links —
 * reached only via the routing gate in `app/_layout.tsx`
 * (`needsRosterClaim`), never by user navigation. Unlike `join-class.tsx`
 * (an optional "add another class" screen for an already-onboarded user)
 * this has no back button and no skip: every data-serving endpoint scopes by
 * rosterLinks.userId, so there is nothing for this account to do until it
 * claims one. Shares the code-lookup-and-picker flow with `join-class.tsx`
 * via `useJoinCodeLookup` and `RosterCodeClaimForm`.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { useAuth } from '@/context/AuthContext';
import { useJoinCodeLookup } from '@/hooks/useJoinCodeLookup';
import { RosterCodeClaimForm } from '@/components/RosterCodeClaimForm';
import { RosterError, claimRosterCode } from '@/services/roster';

export default function ClaimRequiredScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user, markRosterClaimed } = useAuth();

  const { code, setCode, roster, className, studentId, setStudentId, canSubmit: canSubmitCode } = useJoinCodeLookup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const align = isRTL ? 'right' : 'left';
  const canSubmit = canSubmitCode && !submitting;

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
      setError(err instanceof RosterError ? err.message : t('joinAnotherClassFailed'));
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
          {t('claimRequiredTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('claimRequiredDesc')}
        </Text>

        <RosterCodeClaimForm
          code={code}
          onChangeCode={setCode}
          roster={roster}
          className={className}
          studentId={studentId}
          onSelectStudent={setStudentId}
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
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 24 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13 },
});

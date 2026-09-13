/**
 * Lets a signed-in student/parent account link to one more roster row — a
 * second child, a second parent for the same child, or a second teacher's
 * class — via `POST /auth/claim`. The mandatory first claim right after
 * signup is a separate, non-skippable screen: `app/claim-required.tsx`. Both
 * share the code-lookup-and-picker flow via `useJoinCodeLookup` and
 * `RosterCodeClaimForm`.
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
import { useAuth } from '@/context/AuthContext';
import { useJoinCodeLookup } from '@/hooks/useJoinCodeLookup';
import { RosterCodeClaimForm } from '@/components/RosterCodeClaimForm';
import { RosterError, claimRosterCode } from '@/services/roster';
import { claimErrorKey } from '@/services/claimCodeGate';

export default function JoinClassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();

  const { code, setCode, roster, className, studentId, setStudentId, state, canSubmit: canSubmitCode } = useJoinCodeLookup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  const align = isRTL ? 'right' : 'left';

  const canSubmit = canSubmitCode && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(true);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t(err instanceof RosterError ? claimErrorKey(err.code) : 'joinAnotherClassFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return (
      <View style={[styles.successWrap, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: 'center' }]}>
          {t('joinAnotherClassSuccess')}
        </Text>
        <Button label={t('joinAnotherClassDone')} onPress={() => router.back()} fullWidth style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('joinAnotherClass')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('joinAnotherClassDesc')}
        </Text>

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
          label={t('joinAnotherClassSubmit')}
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
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13 },
  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 19, lineHeight: 27 },
});

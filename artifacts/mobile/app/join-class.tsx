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
import { joinClassCopyKeys } from '@/services/joinClassCopy';
import { goBack } from '@/services/navigation';
import { askForPushPermission, pushAskCopy } from '@/services/pushTokens';
import { BackButton } from '@/components/ui/BackButton';
import { ClaimWaitingCard } from '@/components/ClaimWaitingCard';
import { useClaimWaiting } from '@/hooks/useClaimWaiting';

export default function JoinClassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user, markRosterClaimed } = useAuth();
  // A student's first class reads differently from "another class"; the success
  // screen below has its own words either way.
  const copy = joinClassCopyKeys(user);

  const { code, setCode, roster, className, studentId, setStudentId, state, canSubmit: canSubmitCode, needsConfirm, confirmed, setConfirmed, pickedName } = useJoinCodeLookup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [heldForTeacher, setHeldForTeacher] = useState(false);
  // A claim the teacher has not answered yet: a student who picked a name
  // earlier sees the waiting card instead of the form (hooks/useClaimWaiting.ts).
  const waiting = useClaimWaiting({
    adoptLinksOnMount: false,
    onLinked: () => { markRosterClaimed(true); router.replace('/(tabs)'); },
  });

  const align = isRTL ? 'right' : 'left';

  const canSubmit = canSubmitCode && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // A class code is shared: ask once whether the picked name is really theirs.
    if (needsConfirm) { setConfirmed(true); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(true);
      if (result.status === 'pending') {
        // Held for the teacher: the class is not this account's yet, so the app
        // is not told it has a link (that would hide the school tab's "join a
        // class" prompt for an account that has none) and push is not asked.
        setHeldForTeacher(true);
      } else {
        // A student who signed up with an email arrives here with no link, so the
        // flag the app holds (and the school tab's "join a class" prompt) is
        // still false until told; see AuthContext.markRosterClaimed.
        markRosterClaimed(true);
        // A class is where the teacher's messages and released results come
        // from — a natural moment to offer push (services/pushPolicy.ts).
        void askForPushPermission({ explicit: false, copy: pushAskCopy(t) });
      }
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
          <Ionicons name={heldForTeacher ? 'time-outline' : 'checkmark-circle'} size={48} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: 'center' }]}>
          {t(heldForTeacher ? 'joinAnotherClassPending' : 'joinAnotherClassSuccess')}
        </Text>
        <Button label={t('joinAnotherClassDone')} onPress={() => goBack()} fullWidth style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t(copy.title)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {waiting.screen.mode === 'waiting' ? (
          <ClaimWaitingCard
            studentName={waiting.screen.studentName}
            checking={waiting.checking}
            error={waiting.error}
            onCheck={() => void waiting.check()}
            onChange={() => void waiting.change()}
            colors={colors}
            isRTL={isRTL}
            t={t}
          />
        ) : (
          <>
            <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t(copy.desc)}
            </Text>

            {waiting.screen.declined ? (
              <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('claimDeclined')}
              </Text>
            ) : null}

            <RosterCodeClaimForm
              code={code}
              onChangeCode={setCode}
              roster={roster}
              className={className}
              studentId={studentId}
              onSelectStudent={setStudentId}
              state={state}
              userRole={user?.role}
              confirming={confirmed}
              pickedName={pickedName}
              onChangeMind={() => setConfirmed(false)}
              colors={colors}
              isRTL={isRTL}
              t={t}
            />

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              label={confirmed ? t('joinConfirmYes') : t('joinAnotherClassSubmit')}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              fullWidth
              style={{ marginTop: 24 }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  desc: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 19, lineHeight: 27 },
});

/**
 * Sign-up for a parent or student: the teacher's code and, for a class code, a
 * name off the list. No email, no password — the code is the proof, and email
 * can be added later from the profile.
 *
 * Two states in one component because they are one task. First the code; then,
 * once the server has made the account, the personal login code it returns
 * exactly once. That second screen holds the session back (`finish`) until the
 * person says they saved it — opening it sooner would send them straight past
 * the only place that tells them what the code is for. The code is also parked
 * in device storage meanwhile (services/pendingLoginCode.ts), so closing the app
 * here does not strand a brand-new account.
 *
 * Reuses the lookup and name picker of the claim screens
 * (`useJoinCodeLookup`, `RosterCodeClaimForm`); only the rule for when Continue
 * is allowed differs — see `canSubmitSignup`.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { RosterCodeClaimForm } from '@/components/RosterCodeClaimForm';
import { useAuth } from '@/context/AuthContext';
import { useJoinCodeLookup } from '@/hooks/useJoinCodeLookup';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { canSubmitSignup, claimErrorKey, parentNeedsOwnCode } from '@/services/claimCodeGate';
import { formatLoginCode } from '@/services/loginCode';
import type { TranslationKey } from '@/services/i18n';
import { SPACE, TYPE } from '@/constants/theme';

interface Props {
  role: 'parent' | 'student';
  termsAccepted: boolean;
  lang: 'ar' | 'en';
  colors: any;
  isRTL: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
}

export function CodeSignupForm({ role, termsAccepted, lang, colors, isRTL, t }: Props) {
  const { redeemCode } = useAuth();
  const lookup = useJoinCodeLookup();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ loginCode: string; finish: () => Promise<void> } | null>(null);
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const align = isRTL ? 'right' : 'left';
  const classCodeForParent = parentNeedsOwnCode(role, lookup.state);
  const canSubmit =
    canSubmitSignup(role, lookup.state, lookup.studentId) && termsAccepted && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // A class code is shared: ask once whether the picked name is really theirs.
    if (lookup.needsConfirm) { lookup.setConfirmed(true); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await redeemCode({
        role,
        claimCode: lookup.code,
        studentId: lookup.roster ? lookup.studentId : undefined,
        preferredLanguage: lang,
        acceptedTerms: termsAccepted,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIssued(res);
    } catch (e: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // The claim refusals have their own wording (shared with the claim screens);
      // everything else — rate limit, offline, terms — goes through the common table.
      setError(
        typeof e?.code === 'string' && e.code.startsWith('claim_')
          ? t(claimErrorKey(e.code))
          : apiErrorMessage(e, 'errCodeSignupFailed', t),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (issued) {
    const shown = formatLoginCode(issued.loginCode);
    return (
      <View style={{ gap: SPACE.lg }}>
        <View style={[styles.codeBox, { borderColor: colors.primary, backgroundColor: colors.primary + '10', borderRadius: colors.radius }]}>
          <Text style={[styles.codeTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: 'center' }]}>
            {t('loginCodeTitle')}
          </Text>
          <Text
            selectable
            // One line however narrow the phone: a code split across two reads as two codes.
            numberOfLines={1}
            adjustsFontSizeToFit
            // Latin digits and letters read left to right even on an Arabic screen.
            style={[styles.code, { color: colors.primary, fontFamily: 'ReadexPro_700Bold' }]}
            accessibilityLabel={shown.split('').join(' ')}
          >
            {shown}
          </Text>
          <Button
            label={copied ? t('loginCodeCopied') : t('loginCodeCopy')}
            variant="secondary"
            onPress={() => {
              void Clipboard.setStringAsync(shown).then(() => setCopied(true)).catch(() => {});
            }}
            fullWidth
          />
        </View>

        <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('loginCodeSaveNote')}
        </Text>

        {error ? <ErrorBanner text={error} colors={colors} isRTL={isRTL} /> : null}

        <Button
          label={t('loginCodeSavedContinue')}
          loading={finishing}
          fullWidth
          onPress={async () => {
            setFinishing(true);
            setError('');
            try {
              // Opens the session; the routing gate takes it from here.
              await issued.finish();
            } catch (e: any) {
              setError(apiErrorMessage(e, 'errCodeSignupFailed', t));
              setFinishing(false);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: SPACE.lg }}>
      <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {t('codeSignupSubtitle')}
      </Text>

      <RosterCodeClaimForm
        code={lookup.code}
        onChangeCode={lookup.setCode}
        // A parent cannot pick a name from a class code, so the list would only
        // invite a tap that cannot work; the notice below says what to do instead.
        roster={classCodeForParent ? null : lookup.roster}
        className={lookup.className}
        studentId={lookup.studentId}
        onSelectStudent={lookup.setStudentId}
        state={lookup.state}
        userRole={role}
        confirming={lookup.confirmed}
        pickedName={lookup.pickedName}
        onChangeMind={() => lookup.setConfirmed(false)}
        colors={colors}
        isRTL={isRTL}
        t={t}
      />

      {/* Not an error, an explanation: the parent did nothing wrong, they hold
          the wrong kind of code, and a dead button would not say so. */}
      {classCodeForParent ? <ErrorBanner text={t('claimParentNeedsOwnCode')} colors={colors} isRTL={isRTL} /> : null}
      {error ? <ErrorBanner text={error} colors={colors} isRTL={isRTL} /> : null}

      <Button
        label={lookup.confirmed ? t('joinConfirmYes') : t('createAccount')}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
        fullWidth
      />
      {!termsAccepted ? (
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('registerAcceptTermsFirst')}
        </Text>
      ) : null}
    </View>
  );
}

function ErrorBanner({ text, colors, isRTL }: { text: string; colors: any; isRTL: boolean }) {
  return (
    <View style={[styles.banner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
      <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderWidth: 1.5, padding: SPACE.xl, gap: SPACE.md },
  codeTitle: { fontSize: TYPE.bodyLg },
  code: { fontSize: TYPE.headline, letterSpacing: 1, textAlign: 'center', writingDirection: 'ltr' },
  note: { fontSize: TYPE.body, lineHeight: 24 },
  hint: { fontSize: TYPE.caption, lineHeight: 21, textAlign: 'center', marginTop: -6 },
  banner: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: TYPE.body, lineHeight: 24 },
});

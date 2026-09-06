/**
 * Teacher-side: mint a class code for one student, and message any parent
 * already linked to them.
 *
 * Reuses GET /messaging/contacts (services/messaging.ts's getTeacherContacts)
 * rather than a new one-student endpoint — a teacher's own roster is small
 * enough that filtering client-side isn't worth a new backend route.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { generateClaimCode, getClaimCode, RosterError } from '@/services/roster';
import { MessagingError, getTeacherContacts, startThread, type ChatRole } from '@/services/messaging';
import { copyToClipboard, shareAsText } from '@/services/share.ts';
import { composeClaimCodeMessage } from '@/services/claimCodeMessage.ts';
import { confirm } from '@/services/confirm.ts';
import { useStudentAccountsEnabled } from '@/services/features';
import { Avatar } from '@/components/ui/Avatar';
import { Toast } from '@/components/ui/Toast';

interface Guardian {
  userId: string;
  firstName: string;
  lastName: string;
  role: ChatRole;
}

export default function ClaimCodeScreen() {
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const studentAccounts = useStudentAccountsEnabled();

  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<{ value: string; expiresAt: string } | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    // Nothing to fetch when no account can redeem a code — and asking would
    // just 403. The screen renders its own explanation instead.
    if (!studentAccounts) {
      setLoading(false);
      return;
    }
    try {
      // The code first: without it, re-opening this screen showed an empty
      // card whose only button silently replaced the code already shared.
      const [existing, byStudent] = await Promise.all([
        getClaimCode(studentId),
        getTeacherContacts(),
      ]);
      setCode(
        existing.claimCode && existing.claimCodeExpiresAt
          ? { value: existing.claimCode, expiresAt: existing.claimCodeExpiresAt }
          : null,
      );
      const mine = byStudent.find(s => s.studentId === studentId);
      setGuardians(mine?.contacts ?? []);
      setError('');
    } catch (e) {
      setError(
        e instanceof RosterError || e instanceof MessagingError ? e.message : t('messagingLoadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [studentId, studentAccounts, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleGenerate = async () => {
    if (!studentId) return;
    // Replacing a live code breaks it for whoever already has it, so say so
    // first. `confirm` rather than Alert.alert: Alert's handlers never fire on
    // react-native web, which is the build teachers are demoed on.
    if (code) {
      const ok = await confirm({
        title: t('messagingRegenerateWarnTitle'),
        message: t('messagingRegenerateWarnBody'),
        confirmLabel: t('messagingRegenerateConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setGenerating(true);
    try {
      const result = await generateClaimCode(studentId);
      setCode({ value: result.claimCode, expiresAt: result.claimCodeExpiresAt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof RosterError ? e.message : t('messagingLoadError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await copyToClipboard(code.value);
    setToast(t('messagingCodeCopied'));
  };

  const handleShare = async () => {
    if (!code) return;
    const message = composeClaimCodeMessage(
      {
        studentName: studentName ?? '',
        code: code.value,
        expiresOn: expiresLabel,
        // Web only — there is no window on native, and the composer drops the
        // "open this link" line rather than emitting a hostless URL.
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        fieldLabel: t('classCode'),
      },
      lang === 'ar',
    );
    const outcome = await shareAsText(message, t('messagingClaimCodeTitle'));
    setToast(outcome === 'shared' ? t('messagingCodeShared') : t('copiedToClipboard'));
  };

  const openGuardian = async (userId: string) => {
    setStartingUserId(userId);
    try {
      const thread = await startThread(userId);
      router.push(`/messaging/${thread.id}`);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingSendError'));
    } finally {
      setStartingUserId(null);
    }
  };

  const topPad = insets.top + (insets.top === 0 ? 12 : 0);
  const align = isRTL ? 'right' : 'left';
  const expiresLabel = code ? new Date(code.expiresAt).toLocaleDateString() : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]} numberOfLines={1}>
          {studentName ?? ''}
        </Text>
      </View>

      <View style={{ padding: 20, gap: 20 }}>
        {!studentAccounts ? (
          /* The entry points to this screen are hidden when the flag is off,
             but the route stays reachable — a bookmark, a typed URL, a stale
             back-stack. Explain rather than offer a button that would 403.
             The server refusal is the boundary; this is only courtesy. */
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
              {t('messagingStudentAccountsOffTitle')}
            </Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('messagingStudentAccountsOffBody')}
            </Text>
          </View>
        ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('messagingClaimCodeTitle')}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('messagingClaimCodeDesc')}
          </Text>

          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}

          {!loading && code ? (
            <>
              <View style={[styles.codeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.codeText, { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>{code.value}</Text>
                <Pressable onPress={handleCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('messagingCopyCode')}>
                  <Ionicons name="copy-outline" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[styles.expiresText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('messagingCodeExpires')}: {expiresLabel}
              </Text>
            </>
          ) : null}

          {!loading && !code ? (
            <Text style={[styles.expiresText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('messagingNoCodeYet')}
            </Text>
          ) : null}

          {/* Sharing is the primary action once a code exists; minting is the
              rare, destructive one and reads as such. Before this screen knew
              about existing codes, the destructive action was the only one. */}
          {!loading && code ? (
            <Pressable
              onPress={handleShare}
              style={[styles.generateBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
                {t('messagingShareCode')}
              </Text>
            </Pressable>
          ) : null}

          {!loading ? (
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={
                code
                  ? styles.regenerateBtn
                  : [styles.generateBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]
              }
            >
              {generating ? (
                <ActivityIndicator color={code ? colors.mutedForeground : colors.primaryForeground} />
              ) : (
                <Text
                  style={
                    code
                      ? { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center' }
                      : { color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }
                  }
                >
                  {code ? t('messagingRegenerateCode') : t('messagingCreateCode')}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
        )}

        {/* Suppressed with the rest: "linked accounts — none yet" implies an
            account could turn up, when nothing in this build can create one. */}
        <View style={studentAccounts ? undefined : { display: 'none' }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('messagingGuardiansTitle')}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : guardians.length === 0 ? (
            <Text style={[styles.emptyGuardians, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('messagingNoGuardiansYet')}
            </Text>
          ) : (
            <View style={{ gap: 8, marginTop: 10 }}>
              {guardians.map(g => (
                <View
                  key={g.userId}
                  style={[styles.guardianRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Avatar firstName={g.firstName} lastName={g.lastName} size={36} colors={colors} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guardianName, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]} numberOfLines={1}>
                      {g.firstName} {g.lastName}
                    </Text>
                    <Text style={[styles.guardianRole, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                      {g.role === 'student' ? t('roleStudent') : t('roleParent')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => openGuardian(g.userId)}
                    disabled={startingUserId === g.userId}
                    style={[styles.messageBtn, { backgroundColor: colors.secondary, borderRadius: 14 }]}
                  >
                    {startingUserId === g.userId ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={{ color: colors.primary, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>
                        {t('messagingMessageAction')}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
        ) : null}
      </View>

      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center', gap: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, flex: 1 },
  card: { padding: 18, borderWidth: 1, gap: 6 },
  cardTitle: { fontSize: 15 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  codeRow: { alignItems: 'center', gap: 10, marginTop: 8 },
  codeText: { fontSize: 24, letterSpacing: 3 },
  expiresText: { fontSize: 12 },
  regenerateBtn: { marginTop: 4, paddingVertical: 8 },
  generateBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15 },
  emptyGuardians: { fontSize: 13, marginTop: 8 },
  guardianRow: { padding: 12, gap: 10, borderWidth: 1, alignItems: 'center' },
  guardianName: { fontSize: 14 },
  guardianRole: { fontSize: 11, marginTop: 1 },
  messageBtn: { paddingHorizontal: 12, paddingVertical: 7, minWidth: 64, alignItems: 'center' },
  errorText: { fontSize: 12 },
});

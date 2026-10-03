/**
 * The code `Input` + roster name-chip picker, shared by every screen that
 * claims a roster code (`join-class.tsx`, `claim-required.tsx`). Presentational
 * only — pairs with `hooks/useJoinCodeLookup.ts` for the actual lookup state.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import type { JoinRosterEntry } from '@/services/roster';
import { normalizeClaimCode, type JoinCodeState } from '@/services/claimCodeGate';
import type { TranslationKey } from '@/services/i18n';

export interface RosterCodeClaimFormProps {
  code: string;
  onChangeCode: (text: string) => void;
  roster: JoinRosterEntry[] | null;
  className: string;
  studentId: string;
  onSelectStudent: (id: string) => void;
  /** What the lookup made of the code — see hooks/useJoinCodeLookup.ts. */
  state: JoinCodeState;
  /** Also picks the hint under the code field: a student has no child's teacher to ask.
   *  A name already claimed by a student account blocks another student — one account per child — but not a second parent. */
  userRole: string | undefined;
  /** The joiner is being asked to confirm `pickedName`; the chips give way to the question. */
  confirming?: boolean;
  pickedName?: string;
  onChangeMind?: () => void;
  colors: any;
  isRTL: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
}

export function RosterCodeClaimForm({
  code,
  onChangeCode,
  roster,
  className,
  studentId,
  onSelectStudent,
  state,
  userRole,
  confirming,
  pickedName,
  onChangeMind,
  colors,
  isRTL,
  t,
}: RosterCodeClaimFormProps) {
  return (
    <>
      <Input
        label={t('classCode')}
        placeholder={t('classCodePlaceholder')}
        hint={t(userRole === 'student' ? 'classCodeHintStudent' : 'classCodeHint')}
        value={code}
        // Normalised as typed, not just uppercased: a dash or space off the
        // whiteboard counted as a character, so the lookup fired on five real
        // ones — see normalizeClaimCode.
        onChangeText={text => onChangeCode(normalizeClaimCode(text))}
        leftIcon="key-outline"
        autoCapitalize="characters"
        isRTL={isRTL}
      />

      {/*
        Only a whole-class join code needs this: it names no student of its
        own, so the joiner says which name on the roster is theirs. A
        per-student claim code 404s the lookup and this never appears.

        `taken` means a student account already holds that name. Disabled for
        a student — one account per child — but left open for a parent,
        because both parents linking to the same child is the normal case.
      */}
      {confirming && pickedName ? (
        <View style={[styles.notice, { borderColor: colors.primary, backgroundColor: colors.primary + '10', gap: 8 }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 16, textAlign: isRTL ? 'right' : 'left' }}>
            {pickedName}
          </Text>
          <Text style={[styles.noticeText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t(userRole === 'student' ? 'joinConfirmStudent' : 'joinConfirmParent', pickedName)}
          </Text>
          <Pressable onPress={onChangeMind} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
              {t('joinConfirmChange')}
            </Text>
          </Pressable>
        </View>
      ) : roster && roster.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.pickLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {className ? t('joinPickYourNameFor', className) : t('joinPickYourName')}
          </Text>
          <View style={[styles.nameChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {roster.map(entry => {
              const blocked = entry.taken && userRole === 'student';
              const picked = entry.id === studentId;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => { if (!blocked) onSelectStudent(entry.id); }}
                  disabled={blocked}
                  style={[
                    styles.nameChip,
                    {
                      borderColor: picked ? colors.primary : colors.border,
                      backgroundColor: picked ? colors.primary + '18' : 'transparent',
                      opacity: blocked ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: picked ? colors.primary : colors.foreground, fontFamily: picked ? 'ReadexPro_700Bold' : 'ReadexPro_500Medium', fontSize: 14 }}>
                    {picked ? '✓ ' : ''}{entry.displayName}
                  </Text>
                  {entry.taken ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10, lineHeight: 16 }}>
                      {t('joinNameTaken')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/*
        Why there is no picker, when there is no picker. Both of these used to
        render as nothing at all next to an enabled Continue button, so the
        only feedback the joiner got was the server's refusal after pressing
        it — and in the empty-class case that refusal asked them to pick from
        a list that does not exist yet.
      */}
      {state === 'empty-class' ? (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Text style={[styles.noticeText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {className ? t('claimEmptyClassFor', className) : t('claimEmptyClass')}
          </Text>
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Text style={[styles.noticeText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('claimLookupFailed')}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  noticeText: { fontSize: 15, lineHeight: 24 },
  pickLabel: { fontSize: 13 },
  nameChips: { flexWrap: 'wrap', gap: 8 },
  nameChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});

/**
 * The code `Input` + roster name-chip picker, shared by every screen that
 * claims a roster code (`join-class.tsx`, `claim-required.tsx`). Presentational
 * only — pairs with `hooks/useJoinCodeLookup.ts` for the actual lookup state.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import type { JoinRosterEntry } from '@/services/roster';
import type { TranslationKey } from '@/services/i18n';

export interface RosterCodeClaimFormProps {
  code: string;
  onChangeCode: (text: string) => void;
  roster: JoinRosterEntry[] | null;
  className: string;
  studentId: string;
  onSelectStudent: (id: string) => void;
  /** A name already claimed by a student account blocks another student — one account per child — but not a second parent. */
  userRole: string | undefined;
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
  userRole,
  colors,
  isRTL,
  t,
}: RosterCodeClaimFormProps) {
  return (
    <>
      <Input
        label={t('classCode')}
        placeholder={t('classCodePlaceholder')}
        hint={t('classCodeHint')}
        value={code}
        onChangeText={text => onChangeCode(text.toUpperCase())}
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
      {roster && roster.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.pickLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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
                  <Text style={{ color: picked ? colors.primary : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                    {entry.displayName}
                  </Text>
                  {entry.taken ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10 }}>
                      {t('joinNameTaken')}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pickLabel: { fontSize: 13 },
  nameChips: { flexWrap: 'wrap', gap: 8 },
  nameChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});

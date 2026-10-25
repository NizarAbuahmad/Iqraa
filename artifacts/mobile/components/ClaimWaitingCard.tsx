/**
 * What an account sees while its teacher has not yet answered a class-code
 * claim: which name it asked for, a way to look again, and a way to pick a
 * different name. It sits in place of the code form on `app/claim-required.tsx`
 * and `app/join-class.tsx`, driven by `hooks/useClaimWaiting.ts`; the account
 * has no roster link yet, so nothing it asks the server for opens until the
 * teacher approves.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import type { TranslationKey } from '@/services/i18n';
import { ICON } from '@/constants/icons';
import { readableOn } from '@/services/readableColor';
import { SPACE, TYPE } from '@/constants/theme';

interface Props {
  studentName: string;
  checking: boolean;
  error: string;
  onCheck: () => void;
  onChange: () => void;
  colors: any;
  isRTL: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
}

export function ClaimWaitingCard({ studentName, checking, error, onCheck, onChange, colors, isRTL, t }: Props) {
  const align = isRTL ? 'right' : 'left';
  return (
    <Surface style={styles.card}>
      <View style={[styles.head, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="time-outline" size={ICON.xl} color={readableOn(colors.primary, colors.card, 3)} />
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}
        >
          {t('claimWaitingTitle')}
        </Text>
      </View>
      <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {t('claimWaitingDesc', studentName)}
      </Text>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.desc, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}
        >
          {error}
        </Text>
      ) : null}
      <Button label={t('claimWaitingCheck')} onPress={onCheck} loading={checking} fullWidth style={{ marginTop: SPACE.lg }} />
      <Button label={t('claimWaitingChange')} variant="ghost" onPress={onChange} disabled={checking} fullWidth style={{ marginTop: SPACE.sm }} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg },
  head: { alignItems: 'center', gap: SPACE.md },
  title: { fontSize: TYPE.bodyLg, flex: 1 },
  desc: { fontSize: TYPE.body, lineHeight: 24, marginTop: SPACE.md },
});

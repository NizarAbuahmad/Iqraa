/**
 * The row under a generated quiz or worksheet saying what checked its answer
 * keys — and, since the bank stopped being the default, what nothing did.
 *
 * Which lines appear is decided by `verificationLines`, which `node --test`
 * covers; this only draws them. The quiz and worksheet screens each carried
 * their own copy of this block, and two copies of a claim about verification
 * is how one of them ends up saying more than the other.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { verificationLines, type VerificationSummary } from '@/services/quizVerification';
import { palette } from '@/constants/colors';

const PROVED = palette.success;

export function VerificationSummaryRow({ summary }: { summary: VerificationSummary }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  return (
    <>
      {verificationLines(summary).map(line => {
        const [icon, color, text] =
          line.kind === 'proved'
            ? (['shield-checkmark', PROVED, t('quizVerifiedCount', line.symbolic, line.total)] as const)
            : line.kind === 'unreviewed'
              ? ([
                  'alert-circle-outline',
                  colors.warning,
                  line.unreviewed === line.total
                    ? t('answersUnreviewedAll')
                    : t('answersUnreviewedSome', line.unreviewed, line.total),
                ] as const)
              : (['library-outline', colors.mutedForeground, t('quizVerifiedNone')] as const);
        return (
          <View key={line.kind} style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name={icon} size={14} color={color} />
            <Text style={[styles.text, { color, textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 6, marginTop: 8 },
  text: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 12, flex: 1 },
});

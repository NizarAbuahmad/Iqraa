/**
 * The trust moment under a revealed answer — and it states only what actually
 * happened. 'symbolic' means SymPy re-derived the answer and agreed; 'bank'
 * means a hand-authored, reviewed item, which is NOT machine verification.
 *
 * Extracted from presentation.tsx, where the question-slide reveal and the
 * answer-box reveal each carried their own near-identical copy of this block.
 * Two copies of a claim about verification is how one of them ends up
 * saying more than the other.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DECK_BORDER, DECK_CARD_BG, DECK_MUTED, TIMER_GREEN } from '@/services/deckTheme';
import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';

type Props = {
  verifiedBy?: 'symbolic' | 'bank';
  computedAnswer?: string;
  isRTL: boolean;
  t: (k: any, arg?: any) => string;
  /** Tighter spacing for the badge inside an answer box, under the answer text. */
  inline?: boolean;
};

export function VerifiedBadge({ verifiedBy, computedAnswer, isRTL, t, inline }: Props) {
  const symbolic = verifiedBy === 'symbolic';
  const color = symbolic ? TIMER_GREEN : DECK_MUTED;
  return (
    <View style={inline ? styles.wrapInline : styles.wrap}>
      <View style={[styles.badge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={symbolic ? 'shield-checkmark' : 'library-outline'} size={inline ? 15 : 16} color={color} />
        <Text style={[styles.text, { fontFamily: 'ReadexPro_600SemiBold', color }]}>
          {symbolic ? t('verifiedBySymbolic') : t('verifiedByBank')}
        </Text>
      </View>
      {symbolic && !!computedAnswer && (
        <Text style={[styles.text, { fontFamily: 'Almarai_400Regular', color: DECK_MUTED, textAlign: 'center' }]}>
          {isolateForeignRuns(t('verifiedComputed', prettifySymPy(computedAnswer)))}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapInline: { gap: 4, marginTop: 10 },
  badge: {
    alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  text: { fontSize: 14, color: TIMER_GREEN },
});

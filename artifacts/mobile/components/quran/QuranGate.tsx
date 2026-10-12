/**
 * Wraps each Quran Corner screen: until the corner is released (see
 * `services/quranRelease.ts`) a production build shows this message instead of
 * the screen, so a pasted or bookmarked URL does not reach unverified text even
 * though the Library card is hidden. The wrapped screen is not rendered at all,
 * so none of its hooks or the Quran font run.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { QURAN_CORNER_RELEASED, quranCornerVisible } from '@/services/quranRelease';
import { LabFrame } from '@/components/lab/LabFrame';

export function QuranGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { t } = useLanguage();
  if (quranCornerVisible(QURAN_CORNER_RELEASED, __DEV__)) return <>{children}</>;
  return (
    <LabFrame title={t('quranTitle')}>
      <Text style={[styles.text, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranNotReleased')}
      </Text>
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center', padding: 32 },
});

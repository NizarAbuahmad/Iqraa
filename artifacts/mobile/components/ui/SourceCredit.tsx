/**
 * «المصدر: المركز الوطني لتطوير المناهج» — one quiet line under textbook
 * figures and curriculum content.
 *
 * Plain text on purpose, not a link: it sits inside a student's exam
 * (`app/take/[code].tsx`) and the generator screens, where a tap that navigated
 * away would cost a sitting or an unsaved paper. The full sources, with links,
 * are on `/legal/sources`, reached from login, register and Settings.
 *
 * Text in `constants/sources.ts`.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { sourcesCopy } from '@/constants/sources';
import { SPACE, TYPE } from '@/constants/theme';

export function SourceCredit({ style }: { style?: object }) {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  return (
    <Text
      style={[
        styles.text,
        { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
        style,
      ]}
    >
      {sourcesCopy(lang).credit}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: TYPE.micro, lineHeight: 18, marginTop: SPACE.sm },
});

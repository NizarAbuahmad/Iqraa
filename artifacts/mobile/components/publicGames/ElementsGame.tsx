/**
 * Element symbols trivia — the trivia board with a symbol/name tile as the
 * prompt. Data and question building: services/publicGames/elements.ts.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TriviaBoard, QUESTION_COUNT } from './TriviaGame';
import { buildElementRound, type ElementQuestion } from '@/services/publicGames/elements';

export const ELEMENTS_ACCENT = '#0F766E';

const buildRound = (lang: 'ar' | 'en') => buildElementRound(lang, QUESTION_COUNT);

export function ElementsGame() {
  const colors = useColors();
  const { t, lang } = useLanguage();

  const renderPrompt = (q: ElementQuestion) => (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={[styles.tile, { borderColor: ELEMENTS_ACCENT, backgroundColor: `${ELEMENTS_ACCENT}14` }]}>
        <Text
          style={{
            color: ELEMENTS_ACCENT,
            fontFamily: 'ReadexPro_700Bold',
            fontSize: q.shows === 'symbol' ? 52 : 26,
            textAlign: 'center',
          }}
        >
          {q.shows === 'symbol' ? q.element.symbol : lang === 'ar' ? q.element.nameAr : q.element.nameEn}
        </Text>
      </View>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 18, textAlign: 'center' }}>
        {t(q.shows === 'symbol' ? 'playElementsNamePrompt' : 'playElementsSymbolPrompt')}
      </Text>
    </View>
  );

  return <TriviaBoard titleKey="playElementsTitle" accent={ELEMENTS_ACCENT} buildRound={buildRound} renderPrompt={renderPrompt} />;
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 140, minHeight: 120, paddingHorizontal: 18, borderWidth: 2, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
});

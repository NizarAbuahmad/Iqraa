/**
 * The renderer for the text-prompt /play games: a TriviaBoard whose prompt is
 * an optional subject tile (a word, a place) over a one-line question. Each
 * game is a route file that hands this a `build` function from
 * services/publicGames/. Logic lives there; this file has none.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { readableOn } from '@/services/readableColor';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { TriviaBoard, QUESTION_COUNT } from './TriviaGame';
import type { TextQuestion } from '@/services/publicGames/textQuiz';
import type { TranslationKey } from '@/services/i18n';

export function TextQuizGame({
  titleKey, accent, build,
}: {
  titleKey: TranslationKey;
  accent: string;
  /** Module-level (stable identity): a new function reshuffles the round. */
  build: (lang: 'ar' | 'en', count: number, rng?: () => number) => TextQuestion[];
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const buildRound = React.useCallback((lang: 'ar' | 'en') => build(lang, QUESTION_COUNT), [build]);
  const ink = readableOn(accent, colors.card);

  const renderPrompt = (q: TextQuestion) => (
    <View style={{ alignItems: 'center', gap: SPACE.md }}>
      {q.subject ? (
        <View style={[styles.tile, { borderColor: accent, backgroundColor: `${accent}14` }]}>
          <Text style={{ color: ink, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.display, textAlign: 'center' }}>
            {q.subject}
          </Text>
        </View>
      ) : null}
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: 'center' }}>
        {t(q.promptKey)}
      </Text>
    </View>
  );

  return <TriviaBoard titleKey={titleKey} accent={accent} buildRound={buildRound} renderPrompt={renderPrompt} />;
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 140, minHeight: 90, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderWidth: 2, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
  },
});

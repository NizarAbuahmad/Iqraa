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
  titleKey, accent, build, reveal,
}: {
  titleKey: TranslationKey;
  accent: string;
  /** Extra content under the explanation once an answer is picked, e.g. a map. */
  reveal?: (q: TextQuestion, pickedId: string, accent: string) => React.ReactNode;
  /** Module-level (stable identity): a new function reshuffles the round. */
  build: (lang: 'ar' | 'en', count: number, rng?: () => number) => TextQuestion[];
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
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

  const renderReveal = (q: TextQuestion) =>
    q.explanation || q.explanationLtr ? (
      <View style={[styles.reveal, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {q.explanation ? (
          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: isRTL ? 'right' : 'left' }}>
            {q.explanation}
          </Text>
        ) : null}
        {q.explanationLtr ? (
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: 'center' }}>
            {q.explanationLtr}
          </Text>
        ) : null}
      </View>
    ) : null;

  return (
    <TriviaBoard
      titleKey={titleKey}
      accent={accent}
      buildRound={buildRound}
      renderPrompt={renderPrompt}
      renderReveal={(q, pickedId) => (
        <>
          {renderReveal(q)}
          {reveal ? reveal(q, pickedId, accent) : null}
        </>
      )}
    />
  );
}

const styles = StyleSheet.create({
  reveal: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm },
  tile: {
    minWidth: 140, minHeight: 90, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderWidth: 2, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
  },
});

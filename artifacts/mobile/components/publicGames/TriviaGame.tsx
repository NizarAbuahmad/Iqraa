/**
 * Four-option trivia. `TriviaBoard` is the mechanic (one answer per question,
 * reveal, next, score); `TriviaGame` is flags + capitals on top of it — same
 * mechanic, different question field and (for flags) an image, data in
 * services/publicGames/countries.ts. The element-symbols game reuses the
 * board with its own prompt (ElementsGame.tsx).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { GameShell } from './GameShell';
import { AnswerOption } from './AnswerOption';
import { answerFeedback } from '@/services/playFeedback';
import { nextStreak, showStreak } from '@/services/publicGames/answerMotion';
import { recordBest, type BestResult } from '@/services/publicGames/bestScore';
import { playStore } from '@/services/playStore';
import { readableOn } from '@/services/readableColor';
import { buildTriviaRound, flagUrl, type TriviaField, type TriviaOption, type TriviaQuestion } from '@/services/publicGames/countries';
import type { TranslationKey } from '@/services/i18n';

export const QUESTION_COUNT = 8;

export function TriviaGame({
  field, titleKey, accent,
}: {
  field: TriviaField;
  titleKey: TranslationKey;
  accent: string;
}) {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const buildRound = useCallback(
    (l: 'ar' | 'en') => buildTriviaRound(field, l, QUESTION_COUNT),
    [field],
  );
  const renderPrompt = (question: TriviaQuestion) =>
    field === 'name' ? (
      <View style={styles.flagWrap}>
        <Image source={{ uri: flagUrl(question.country.code) }} style={styles.flag} resizeMode="cover" />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 18, textAlign: 'center', marginTop: 14 }}>
          {t('playFlagsPrompt')}
        </Text>
      </View>
    ) : (
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: 'center', marginVertical: 20 }}>
        {t('playCapitalsPrompt', lang === 'ar' ? question.country.nameAr : question.country.nameEn)}
      </Text>
    );
  return <TriviaBoard titleKey={titleKey} accent={accent} buildRound={buildRound} renderPrompt={renderPrompt} />;
}

export function TriviaBoard<Q extends { options: TriviaOption[]; correctId: string }>({
  titleKey, accent, buildRound, renderPrompt, renderReveal, onBack, analytics, onFinished, footer,
}: {
  titleKey: TranslationKey;
  accent: string;
  onBack?: () => void;
  analytics?: Record<string, string>;
  onFinished?: (score: number, total: number) => void;
  footer?: React.ReactNode;
  /** Must be stable (module-level or useCallback): a new identity reshuffles the round. */
  buildRound: (lang: 'ar' | 'en') => Q[];
  renderPrompt: (question: Q) => React.ReactNode;
  /** Shown under the options once an answer is picked (the picked option's id is passed). */
  renderReveal?: (question: Q, pickedId: string) => React.ReactNode;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [round, setRound] = useState(0); // bumped to reshuffle a fresh game
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState<Q[]>([]);
  const [retryQuestions, setRetryQuestions] = useState<Q[] | null>(null);
  const [bestInfo, setBestInfo] = useState<BestResult | null>(null);

  const built: Q[] = useMemo(
    () => buildRound(lang),
    // A fresh set on mount and every "play again" — never mid-game, or the
    // options under a selected answer would shuffle out from under the tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildRound, lang, round],
  );
  const questions: Q[] = retryQuestions ?? built;
  const question = questions[index];

  const pick = (optionId: string) => {
    if (selected) return; // one answer per question
    setSelected(optionId);
    answerFeedback(optionId === question.correctId);
    setStreak(s => nextStreak(s, optionId === question.correctId));
    if (optionId === question.correctId) setScore(s => s + 1);
    if (optionId !== question.correctId) setMissed(m => [...m, question]);
  };

  // A lesson game keeps one best per lesson (the lesson screen passes its id in `analytics`).
  const bestGameKey = analytics?.lessonId ? `${titleKey}:${analytics.lessonId}` : titleKey;

  // A finished full round records the personal best; a retry round never does.
  useEffect(() => {
    if (!gameOver || retryQuestions) return;
    let alive = true;
    void recordBest(playStore, bestGameKey, { score, total: questions.length }).then(r => { if (alive) setBestInfo(r); });
    return () => { alive = false; };
    // Once per finished full round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const next = () => {
    if (index + 1 >= questions.length) {
      setGameOver(true);
      return;
    }
    setIndex(i => i + 1);
    setSelected(null);
  };

  const replay = () => {
    setRound(r => r + 1);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setSelected(null);
    setGameOver(false);
    setRetryQuestions(null);
    setMissed([]);
    setBestInfo(null);
  };

  const retryMissed = () => {
    setRetryQuestions(missed);
    setMissed([]);
    setBestInfo(null);
    setIndex(0);
    setScore(0);
    setSelected(null);
    setStreak(0);
    setGameOver(false);
  };

  return (
    <GameShell
      titleKey={titleKey}
      accent={accent}
      scoreLabel={t('playScoreLabel', score, questions.length)}
      gameOver={gameOver ? { message: t('playScoreLabel', score, questions.length), perfect: !retryQuestions && score === questions.length, score, total: questions.length } : null}
      onReplay={replay}
      onBack={onBack}
      analytics={retryQuestions ? { ...analytics, retry: '1' } : analytics}
      // A retry round is practice: it is never reported (the server keeps the higher
      // ratio, so 2/2 on the missed ones would read as perfect) and never shows a send status.
      onFinished={retryQuestions ? undefined : onFinished}
      secondaryAction={missed.length > 0 ? { label: t('playRetryMissed', missed.length), onPress: retryMissed } : undefined}
      footer={
        <>
          {bestInfo ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: 'center' }}>
              {t('playBestScore', bestInfo.best.score, bestInfo.best.total)}{bestInfo.isNewBest ? `  ·  ${t('playNewBest')}` : ''}
            </Text>
          ) : null}
          {retryQuestions ? null : footer}
        </>
      }
      showSoundToggle
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 20 }}>
        {/* minHeight: room for the streak chip (25 px measured) so the question does not drop when it appears. */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ICON.md + SPACE.md }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: isRTL ? 'right' : 'left' }}>
            {t('playQuestionProgress', index + 1, questions.length)}
          </Text>
          {showStreak(streak) ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill, backgroundColor: `${accent}1a` }}>
              <Ionicons name="flame" size={ICON.md} color={readableOn(accent, colors.card, 3)} />
              <Text style={{ color: readableOn(accent, colors.card), fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('playStreak', streak)}</Text>
            </View>
          ) : null}
        </View>

        {renderPrompt(question)}

        <View style={styles.optionsGrid}>
          {question.options.map(o => (
            <AnswerOption
              key={o.id}
              label={o.label}
              revealed={selected !== null}
              isCorrect={o.id === question.correctId}
              isPicked={o.id === selected}
              onPress={() => pick(o.id)}
            />
          ))}
        </View>

        {selected && renderReveal ? renderReveal(question, selected) : null}

        {selected ? (
          <Pressable onPress={next} style={[styles.nextBtn, { backgroundColor: accent }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t('playNext')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  flagWrap: { alignItems: 'center' },
  flag: { width: 200, height: 120, borderRadius: 10, backgroundColor: '#eee' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nextBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 15, marginTop: 'auto' },
});

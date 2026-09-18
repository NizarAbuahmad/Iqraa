/**
 * Flags + capitals trivia — same mechanic, different question field and
 * (for flags) an image. One component covers both games; only the data
 * differs (services/publicGames/countries.ts).
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { GameShell } from './GameShell';
import { buildTriviaRound, flagUrl, type TriviaField, type TriviaQuestion } from '@/services/publicGames/countries';
import type { TranslationKey } from '@/services/i18n';

const QUESTION_COUNT = 8;

export function TriviaGame({
  field, titleKey, accent,
}: {
  field: TriviaField;
  titleKey: TranslationKey;
  accent: string;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [round, setRound] = useState(0); // bumped to reshuffle a fresh game
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const questions: TriviaQuestion[] = useMemo(
    () => buildTriviaRound(field, lang, QUESTION_COUNT),
    // A fresh set on mount and every "play again" — never mid-game, or the
    // options under a selected answer would shuffle out from under the tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field, lang, round],
  );
  const question = questions[index];

  const pick = (optionId: string) => {
    if (selected) return; // one answer per question
    setSelected(optionId);
    if (optionId === question.correctId) setScore(s => s + 1);
  };

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
    setSelected(null);
    setGameOver(false);
  };

  return (
    <GameShell
      titleKey={titleKey}
      accent={accent}
      scoreLabel={t('playScoreLabel', score, questions.length)}
      gameOver={gameOver ? { message: t('playScoreLabel', score, questions.length) } : null}
      onReplay={replay}
    >
      <View style={{ flex: 1, padding: 20, gap: 20 }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
          {t('playQuestionProgress', index + 1, questions.length)}
        </Text>

        {field === 'name' ? (
          <View style={styles.flagWrap}>
            <Image source={{ uri: flagUrl(question.country.code) }} style={styles.flag} resizeMode="cover" />
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 18, textAlign: 'center', marginTop: 14 }}>
              {t('playFlagsPrompt')}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: 'center', marginVertical: 20 }}>
            {t('playCapitalsPrompt', lang === 'ar' ? question.country.nameAr : question.country.nameEn)}
          </Text>
        )}

        <View style={styles.optionsGrid}>
          {question.options.map(o => {
            const isCorrect = o.id === question.correctId;
            const isPicked = o.id === selected;
            const revealed = selected !== null;
            const bg = !revealed
              ? colors.card
              : isCorrect
                ? '#16A34A22'
                : isPicked
                  ? '#DC262622'
                  : colors.card;
            const border = !revealed ? colors.border : isCorrect ? '#16A34A' : isPicked ? '#DC2626' : colors.border;
            return (
              <Pressable
                key={o.id}
                onPress={() => pick(o.id)}
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: 'center' }}>
                  {o.label}
                </Text>
                {revealed && isCorrect && <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={styles.optionIcon} />}
                {revealed && isPicked && !isCorrect && <Ionicons name="close-circle" size={18} color="#DC2626" style={styles.optionIcon} />}
              </Pressable>
            );
          })}
        </View>

        {selected ? (
          <Pressable onPress={next} style={[styles.nextBtn, { backgroundColor: accent }]}>
            <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>{t('playNext')}</Text>
          </Pressable>
        ) : null}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  flagWrap: { alignItems: 'center' },
  flag: { width: 200, height: 120, borderRadius: 10, backgroundColor: '#eee' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  optionIcon: { marginTop: -2 },
  nextBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 15, marginTop: 'auto' },
});

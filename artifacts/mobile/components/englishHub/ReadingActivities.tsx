/**
 * The English corner's three Grade 1 reading activities: Read and find, First
 * letter, Starts with. Every decision with a right answer comes from
 * `services/englishHub/games.ts`; these only render and count.
 *
 * Letters and words are laid out left to right whatever the UI language. Audio
 * starts from a tap, as in `Activities.tsx`; a letter is never played.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HubWord } from '@workspace/curriculum/englishHub';
import { TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { playWord } from '@/services/englishAudio';
import { buildFirstLetterRound, buildReadFindRound, buildStartsWithRound, wordPicture } from '@/services/englishHub/games';
import { HearButton, Progress, RIGHT, WRONG } from './Activities';
import { Feedback } from './GrammarActivities';

type Finish = (correct: number, total: number) => void;

function buzz(ok: boolean) {
  void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** One question's pick → right/wrong → next bookkeeping, shared by all three. */
function useRound<Q extends { answerIndex: number }>(round: Q[], onFinish: Finish) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const pick = (k: number, then?: () => void) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === round[i].answerIndex;
    if (ok) setCorrect(c => c + 1);
    buzz(ok);
    then?.();
  };
  const next = (then?: (q: Q) => void) => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
    then?.(round[i + 1]);
  };
  return { q: round[i], i, picked, pick, next };
}

function useTint() {
  const colors = useColors();
  return (picked: number | null, k: number, answer: number) => {
    const shown = picked !== null && (k === answer || k === picked);
    const tint = !shown ? colors.border : k === answer ? RIGHT : WRONG;
    return { borderColor: tint, backgroundColor: shown ? tint + '18' : colors.card };
  };
}

/** Three picture cards in one row, always left to right. */
function PictureChoices({ options, picked, answer, onPick }: { options: string[]; picked: number | null; answer: number; onPick: (k: number) => void }) {
  const tint = useTint();
  return (
    <View style={styles.choiceRow}>
      {options.map((o, k) => (
        <Pressable
          key={o}
          onPress={() => onPick(k)}
          accessibilityRole="button"
          // The word would read the answer out to a screen reader: number them instead.
          accessibilityLabel={String(k + 1)}
          style={[styles.pictureCard, tint(picked, k, answer)]}
        >
          <Text style={styles.picture}>{wordPicture(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Read and find ──────────────────────────────────────────────────────────

export function ReadFind({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const round = useMemo(() => buildReadFindRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
      {/* Heard only once answered: before, the sound would do the reading. */}
      <PictureChoices options={q.options} picked={picked} answer={q.answerIndex} onPick={k => pick(k, () => void playWord(q.word.en))} />
      {picked !== null ? <Feedback ok={picked === q.answerIndex} answer={q.word.en} onNext={() => next()} sentence={q.word.en} /> : null}
    </View>
  );
}

// ─── First letter ───────────────────────────────────────────────────────────

export function FirstLetter({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const tint = useTint();
  const round = useMemo(() => buildFirstLetterRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  const pic = wordPicture(q.word.en);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      {pic ? <Text style={styles.picture} accessible={false}>{pic}</Text> : null}
      {/* The first word plays from this button, later ones from Next. The word is not printed before the answer. */}
      <HearButton word={q.word.en} big />
      <View style={styles.choiceRow}>
        {q.options.map((o, k) => (
          <Pressable key={o} onPress={() => pick(k)} accessibilityRole="button" style={[styles.letterCard, tint(picked, k, q.answerIndex)]}>
            <Text style={[styles.letter, { color: colors.foreground }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {picked !== null ? (
        <>
          <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
          <Feedback
            ok={picked === q.answerIndex}
            answer={q.options[q.answerIndex]}
            onNext={() => next(n => void playWord(n.word.en))}
            sentence={q.word.en}
          />
        </>
      ) : null}
    </View>
  );
}

// ─── Starts with ────────────────────────────────────────────────────────────

export function StartsWith({ words, onFinish }: { words: readonly HubWord[]; onFinish: Finish }) {
  const colors = useColors();
  const { t } = useLanguage();
  const round = useMemo(() => buildStartsWithRound(words), [words]);
  const { q, i, picked, pick, next } = useRound(round, onFinish);
  return (
    <View style={styles.page}>
      <Progress i={i} n={round.length} />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, textAlign: 'center' }}>{t('hubRStartsDesc')}</Text>
      <Text style={[styles.bigLetter, { color: colors.primary }]}>{q.letter}</Text>
      <PictureChoices options={q.options} picked={picked} answer={q.answerIndex} onPick={k => pick(k, () => void playWord(q.word.en))} />
      {picked !== null ? (
        <>
          <Text style={[styles.bigWord, { color: colors.foreground }]}>{q.word.en}</Text>
          <Feedback ok={picked === q.answerIndex} answer={q.word.en} onNext={() => next()} sentence={q.word.en} />
        </>
      ) : null}
    </View>
  );
}

/** Pictures are artwork, sized as in `Activities.tsx`, not taken from the TYPE scale. */
const PICTURE_SIZE = 64;
/** Starts with's letter is the thing asked about, as the picture is elsewhere: sized as one, larger than any text. */
const LETTER_SIZE = 72;

const styles = StyleSheet.create({
  page: { gap: 16, alignItems: 'center' },
  // A physical row, never flipped for Arabic: the options are English.
  choiceRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  pictureCard: { width: 96, height: 96, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  picture: { fontSize: PICTURE_SIZE, lineHeight: PICTURE_SIZE + 12, textAlign: 'center' },
  letterCard: { width: 80, height: 80, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.hero, writingDirection: 'ltr' },
  bigLetter: { fontFamily: 'ReadexPro_700Bold', fontSize: LETTER_SIZE, lineHeight: LETTER_SIZE + 16, writingDirection: 'ltr' },
  bigWord: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.hero, textAlign: 'center', writingDirection: 'ltr' },
});

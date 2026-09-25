/**
 * The English hub's four activities. Every decision with a right answer lives
 * in `services/englishHub/games.ts`; these only render and count.
 *
 * Audio is always started from a tap. Browsers refuse `play()` that no gesture
 * started, so "Next" plays the next word rather than a mount effect doing it.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { HubWord } from '@workspace/curriculum/englishHub';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { playWord } from '@/services/englishAudio';
import {
  buildListenRound,
  buildMatchDeck,
  buildSpellRound,
  isMatchPair,
  isSpeltCorrectly,
  type MatchCard,
} from '@/services/englishHub/games';

const RIGHT = '#16A34A';
const WRONG = '#DC2626';

type Finish = (correct: number, total: number) => void;

function useUi() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  return { colors, t, row: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse' };
}

function HearButton({ word, big }: { word: string; big?: boolean }) {
  const { colors, t } = useUi();
  return (
    <Pressable
      onPress={() => void playWord(word)}
      accessibilityRole="button"
      accessibilityLabel={t('hubHear')}
      style={[styles.hear, { backgroundColor: colors.primary, width: big ? 88 : 48, height: big ? 88 : 48 }]}
    >
      <Ionicons name="volume-high" size={big ? 40 : 22} color="#fff" />
    </Pressable>
  );
}

function Progress({ i, n }: { i: number; n: number }) {
  const { colors, t } = useUi();
  return <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13, textAlign: 'center' }}>{t('hubQuestion', i + 1, n)}</Text>;
}

// ─── Flashcards ─────────────────────────────────────────────────────────────

export function Flashcards({ words }: { words: HubWord[] }) {
  const { colors, t, row } = useUi();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const w = words[i];

  const go = (next: number) => {
    const j = (next + words.length) % words.length;
    setI(j);
    setFlipped(false);
    void playWord(words[j].en);
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={words.length} />
      <Pressable
        onPress={() => setFlipped(f => !f)}
        accessibilityHint={t('hubTapToFlip')}
        style={[styles.flash, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {flipped ? (
          <Text style={[styles.flashAr, { color: colors.foreground }]}>{w.ar}</Text>
        ) : (
          <Text style={[styles.flashEn, { color: colors.foreground }]}>{w.en}</Text>
        )}
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Almarai_400Regular' }}>{t('hubTapToFlip')}</Text>
      </Pressable>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 20 }}>
        <Pressable onPress={() => go(i - 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>{t('hubPrev')}</Text>
        </Pressable>
        <HearButton word={w.en} big />
        <Pressable onPress={() => go(i + 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>{t('hubNext')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Listen and choose ──────────────────────────────────────────────────────

export function ListenChoose({ words, onFinish }: { words: HubWord[]; onFinish: Finish }) {
  const { colors, t } = useUi();
  const round = useMemo(() => buildListenRound(words), [words]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];

  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === q.answerIndex;
    if (ok) setCorrect(c => c + 1);
    void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
    void playWord(round[i + 1].word.en);
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <HearButton word={q.word.en} big />
      <View style={{ width: '100%', gap: 10 }}>
        {q.options.map((o, k) => {
          const shown = picked !== null && (k === q.answerIndex || k === picked);
          const tint = !shown ? colors.border : k === q.answerIndex ? RIGHT : WRONG;
          return (
            <Pressable
              key={o}
              onPress={() => pick(k)}
              style={[styles.option, { borderColor: tint, backgroundColor: shown ? tint + '18' : colors.card }]}
            >
              <Text style={[styles.optionText, { color: colors.foreground }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked !== null ? (
        <>
          <Text style={{ color: picked === q.answerIndex ? RIGHT : WRONG, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
            {picked === q.answerIndex ? t('hubCorrect') : t('hubWrong', q.word.en)} · {q.word.ar}
          </Text>
          <Pressable onPress={next} style={[styles.primary, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryText}>{t('hubNext')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// ─── Match the meaning ──────────────────────────────────────────────────────

export function MatchMeaning({ words, onFinish }: { words: HubWord[]; onFinish: Finish }) {
  const { colors, t } = useUi();
  const deck = useMemo(() => buildMatchDeck(words), [words]);
  const [selected, setSelected] = useState<MatchCard | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [miss, setMiss] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const pairs = deck.length / 2;

  const tap = (c: MatchCard) => {
    if (matched.has(c.pairId) || miss.length) return;
    if (c.lang === 'en') void playWord(c.text);
    if (!selected || selected.id === c.id) return setSelected(selected?.id === c.id ? null : c);
    if (selected.lang === c.lang) return setSelected(c);
    const m = moves + 1;
    setMoves(m);
    setSelected(null);
    if (isMatchPair(selected, c)) {
      const next = new Set(matched).add(c.pairId);
      setMatched(next);
      // Stars by accuracy: a perfect board is one move per pair.
      if (next.size === pairs) setTimeout(() => onFinish(pairs, m), 400);
    } else {
      setMiss([selected.id, c.id]);
      setTimeout(() => setMiss([]), 700);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13, textAlign: 'center' }}>{t('hubMoves', moves)}</Text>
      <View style={styles.grid}>
        {deck.map(c => {
          const done = matched.has(c.pairId);
          const bad = miss.includes(c.id);
          const on = selected?.id === c.id;
          const border = done ? RIGHT : bad ? WRONG : on ? colors.primary : colors.border;
          return (
            <Pressable
              key={c.id}
              onPress={() => tap(c)}
              style={[styles.matchCard, { borderColor: border, backgroundColor: done ? RIGHT + '18' : on ? colors.primary + '14' : colors.card, opacity: done ? 0.7 : 1 }]}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: c.lang === 'ar' ? 'Almarai_400Regular' : 'Cairo_600SemiBold',
                  fontSize: 15,
                  textAlign: 'center',
                  writingDirection: c.lang === 'ar' ? 'rtl' : 'ltr',
                }}
              >
                {c.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Spell it ───────────────────────────────────────────────────────────────

export function SpellIt({ words, onFinish }: { words: HubWord[]; onFinish: Finish }) {
  const { colors, t } = useUi();
  const round = useMemo(() => buildSpellRound(words), [words]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const w = round[i];

  const check = () => {
    if (result !== null || !typed.trim()) return;
    const ok = isSpeltCorrectly(typed, w.en);
    setResult(ok);
    if (ok) setCorrect(c => c + 1);
    void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setTyped('');
    setResult(null);
    void playWord(round[i + 1].en);
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <HearButton word={w.en} big />
      {/* The meaning is the hint: the child knows what the word is, the question is its letters. */}
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 18, writingDirection: 'rtl' }}>{w.ar}</Text>
      <TextInput
        value={typed}
        // Frozen by ignoring edits, not `editable={false}`: a read-only input
        // drops focus on web, and Enter would stop moving on to the next word.
        onChangeText={v => { if (result === null) setTyped(v); }}
        onSubmitEditing={result === null ? check : next}
        blurOnSubmit={false}
        placeholder={t('hubTypeHere')}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: result === null ? colors.border : result ? RIGHT : WRONG,
          },
        ]}
      />
      {result === null ? (
        <Pressable onPress={check} style={[styles.primary, { backgroundColor: colors.primary, opacity: typed.trim() ? 1 : 0.5 }]}>
          <Text style={styles.primaryText}>{t('hubCheck')}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={{ color: result ? RIGHT : WRONG, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
            {result ? t('hubCorrect') : t('hubWrong', w.en)}
          </Text>
          <Pressable onPress={next} style={[styles.primary, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryText}>{t('hubNext')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hear: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  flash: { width: '100%', minHeight: 200, borderWidth: 1.5, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  flashEn: { fontFamily: 'Cairo_700Bold', fontSize: 40, textAlign: 'center' },
  flashAr: { fontFamily: 'Cairo_700Bold', fontSize: 34, lineHeight: 56, textAlign: 'center', writingDirection: 'rtl' },
  navBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  option: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontFamily: 'Cairo_600SemiBold', fontSize: 20, textAlign: 'center' },
  primary: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  primaryText: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  matchCard: { width: '47%', minHeight: 64, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 10 },
  input: { width: '100%', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', writingDirection: 'ltr' },
});

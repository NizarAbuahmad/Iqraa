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
import { playLocalUri, playWord } from '@/services/englishAudio';
import { useSpeakingRecorder } from '@/hooks/useSpeakingRecorder';
import {
  buildListenRound,
  buildMatchDeck,
  buildPictureDeck,
  buildScrambleRound,
  buildSpellRound,
  isMatchPair,
  isPictureMatch,
  isScrambleSolved,
  isSpeltCorrectly,
  type MatchCard,
  type PictureCard,
  type ScrambleTile,
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

// ─── Scramble ───────────────────────────────────────────────────────────────

/**
 * Tap-to-place tiles, not drag-and-drop: no gesture library, and it's the same
 * interaction as every other activity here. Tapping a tray tile fills the next
 * empty slot; tapping a placed tile returns it to the tray, so a mis-tap is a
 * second tap away from fixed, not a restart.
 */
export function Scramble({ words, onFinish }: { words: HubWord[]; onFinish: Finish }) {
  const { colors, t } = useUi();
  const round = useMemo(() => buildScrambleRound(words), [words]);
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState<(ScrambleTile | null)[]>(() => round[0].tiles.map(() => null));
  const [result, setResult] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];
  const tray = q.tiles.filter(tile => !slots.some(s => s?.id === tile.id));

  const place = (tile: ScrambleTile) => {
    if (result !== null) return;
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    const next = [...slots];
    next[empty] = tile;
    setSlots(next);
    if (next.every(s => s !== null)) {
      const ok = isScrambleSolved(next as ScrambleTile[], q.word.en);
      setResult(ok);
      if (ok) setCorrect(c => c + 1);
      void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const unplace = (slotIndex: number) => {
    if (result !== null || slots[slotIndex] === null) return;
    const next = [...slots];
    next[slotIndex] = null;
    setSlots(next);
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    const j = i + 1;
    setI(j);
    setSlots(round[j].tiles.map(() => null));
    setResult(null);
    void playWord(round[j].word.en);
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <HearButton word={q.word.en} big />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 18, writingDirection: 'rtl' }}>{q.word.ar}</Text>

      {/* Answer slots: empty ones show a dashed placeholder, filled ones the letter. */}
      <View style={styles.tileRow}>
        {slots.map((tile, idx) => (
          <Pressable
            key={idx}
            onPress={() => unplace(idx)}
            style={[
              styles.tile,
              {
                borderColor: result === null ? colors.border : result ? RIGHT : WRONG,
                backgroundColor: tile ? colors.card : 'transparent',
                borderStyle: tile ? 'solid' : 'dashed',
              },
            ]}
          >
            {tile ? <Text style={styles.tileText}>{tile.letter}</Text> : null}
          </Pressable>
        ))}
      </View>

      {/* Tray: the remaining scrambled letters, tap one to place it. */}
      <View style={styles.tileRow}>
        {tray.map(tile => (
          <Pressable
            key={tile.id}
            onPress={() => place(tile)}
            style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Text style={styles.tileText}>{tile.letter}</Text>
          </Pressable>
        ))}
      </View>

      {result !== null ? (
        <>
          <Text style={{ color: result ? RIGHT : WRONG, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
            {result ? t('hubCorrect') : t('hubWrong', q.word.en)}
          </Text>
          <Pressable onPress={next} style={[styles.primary, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryText}>{t('hubNext')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// ─── Picture matching ───────────────────────────────────────────────────────

export function PictureMatch({ words, onFinish }: { words: HubWord[]; onFinish: Finish }) {
  const { colors, t } = useUi();
  const deck = useMemo(() => buildPictureDeck(words), [words]);
  const [selected, setSelected] = useState<PictureCard | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [miss, setMiss] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const pairs = deck.length / 2;

  const tap = (c: PictureCard) => {
    if (matched.has(c.pairId) || miss.length) return;
    if (c.kind === 'word') void playWord(c.text);
    if (!selected || selected.id === c.id) return setSelected(selected?.id === c.id ? null : c);
    if (selected.kind === c.kind) return setSelected(c);
    const m = moves + 1;
    setMoves(m);
    setSelected(null);
    if (isPictureMatch(selected, c)) {
      const next = new Set(matched).add(c.pairId);
      setMatched(next);
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
              {c.kind === 'emoji' ? (
                <Text style={{ fontSize: 32 }}>{c.text}</Text>
              ) : (
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: 'center' }}>{c.text}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Speaking ───────────────────────────────────────────────────────────────

/**
 * Hear it, then record yourself saying it, then hear yourself back. No score —
 * see `useSpeakingRecorder`'s header for why. Browsed like Flashcards, not
 * scored like the other four: no `onFinish`, no round loop, no "done" screen,
 * and (matching Flashcards) never appears with a star count on the activity
 * list, because nothing here is graded to earn one.
 */
export function Speaking({ words }: { words: HubWord[] }) {
  const { colors, t, row } = useUi();
  const [i, setI] = useState(0);
  const rec = useSpeakingRecorder();
  const w = words[i];

  const go = (next: number) => {
    const j = (next + words.length) % words.length;
    setI(j);
    rec.reset();
    void playWord(words[j].en);
  };

  const onMicPress = () => {
    if (rec.phase === 'recording') void rec.stop();
    else void rec.start();
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={words.length} />
      <Text style={[styles.flashEn, { color: colors.foreground }]}>{w.en}</Text>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 20 }}>
        <HearButton word={w.en} />
        <Pressable
          onPress={onMicPress}
          accessibilityRole="button"
          accessibilityLabel={t(rec.phase === 'recording' ? 'hubStopRecording' : 'hubRecord')}
          style={[
            styles.mic,
            { backgroundColor: rec.phase === 'recording' ? WRONG : colors.card, borderColor: rec.phase === 'recording' ? WRONG : colors.border },
          ]}
        >
          <Ionicons name={rec.phase === 'recording' ? 'stop' : 'mic'} size={30} color={rec.phase === 'recording' ? '#fff' : colors.primary} />
        </Pressable>
        {rec.uri ? (
          <Pressable onPress={() => void playLocalUri(rec.uri!)} style={[styles.navBtn, { borderColor: colors.border }]}>
            <Ionicons name="play" size={18} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Almarai_400Regular', textAlign: 'center' }}>
        {rec.phase === 'denied' ? t('hubMicDenied') : rec.phase === 'recording' ? t('hubRecording') : rec.uri ? t('hubHearYourself') : t('hubTapMicToRecord')}
      </Text>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 20 }}>
        <Pressable onPress={() => go(i - 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>{t('hubPrev')}</Text>
        </Pressable>
        <Pressable onPress={() => go(i + 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>{t('hubNext')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hear: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  flash: { width: '100%', minHeight: 200, borderWidth: 1.5, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  flashEn: { fontFamily: 'Cairo_700Bold', fontSize: 40, textAlign: 'center' },
  flashAr: { fontFamily: 'Cairo_700Bold', fontSize: 34, lineHeight: 56, textAlign: 'center', writingDirection: 'rtl' },
  navBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  mic: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  option: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontFamily: 'Cairo_600SemiBold', fontSize: 20, textAlign: 'center' },
  primary: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  primaryText: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  matchCard: { width: '47%', minHeight: 64, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 10 },
  input: { width: '100%', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', writingDirection: 'ltr' },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tile: { width: 44, height: 44, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: 'Cairo_700Bold', fontSize: 22, textTransform: 'uppercase' },
});

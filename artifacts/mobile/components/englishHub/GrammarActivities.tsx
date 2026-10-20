/**
 * The English corner's three Grade 1 grammar activities: Choose the word, Build
 * the sentence, True or false. The sentences, and every decision with a right
 * answer, come from `services/englishHub/games.ts` over
 * `@workspace/curriculum/englishGrammar`; these only render and count.
 *
 * The English is always laid out left to right whatever the UI language — only
 * the instructions follow it. Audio starts from a tap, as in `Activities.tsx`.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { GrammarMarker, GrammarSentence } from '@workspace/curriculum/englishGrammar';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { playWord } from '@/services/englishAudio';
import {
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  isSentenceBuilt,
  type BuildTile,
  wordPicture,
} from '@/services/englishHub/games';
import { HearButton, Progress, RIGHT, WRONG } from './Activities';

type Finish = (correct: number, total: number) => void;

function buzz(ok: boolean) {
  void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}

// ─── The picture ────────────────────────────────────────────────────────────

/** Artwork, not text — sized as a picture, as `WordPicture` in `Activities.tsx` is. */
const PICTURE_SIZE = 72;
const MARKER_SIZE = 40;

/** What decides the contrast: ✅/❌ for got/like, 👦/👧 for he/she. "many" is shown as two pictures. */
const MARKER_GLYPH: Partial<Record<GrammarMarker, string>> = { yes: '✅', no: '❌', boy: '👦', girl: '👧' };

export function GrammarPicture({ word, count, marker }: { word: string; count: 1 | 2; marker: GrammarMarker | null }) {
  const pic = wordPicture(word);
  const glyph = marker ? MARKER_GLYPH[marker] : undefined;
  if (!pic && !glyph) return null;
  return (
    <View style={styles.pictureRow} accessible={false}>
      {glyph ? <Text style={styles.marker}>{glyph}</Text> : null}
      {pic ? <Text style={styles.picture}>{count === 2 ? `${pic}${pic}` : pic}</Text> : null}
    </View>
  );
}

function SentencePicture({ s }: { s: GrammarSentence }) {
  if (!s.picture) return s.marker ? <GrammarPicture word="" count={1} marker={s.marker} /> : null;
  return <GrammarPicture word={s.picture.word} count={s.picture.count} marker={s.marker} />;
}

function EnglishLine({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.sentence, { color: colors.foreground }]}>{text}</Text>;
}

/** The sentence with its Choose span shown as a gap; the span's closing punctuation stays. */
function gapped(s: GrammarSentence): string {
  const { start, length } = s.choose!;
  const last = s.tokens[start + length - 1] ?? '';
  const punct = /[.?!,]+$/.exec(last)?.[0] ?? '';
  return [...s.tokens.slice(0, start), `____${punct}`, ...s.tokens.slice(start + length)].join(' ');
}

export function Feedback({ ok, answer, onNext, sentence }: { ok: boolean; answer: string; onNext: () => void; sentence: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  return (
    <>
      <Text style={{ color: ok ? RIGHT : WRONG, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: 'center' }}>
        {/* LRI…PDI: inside the Arabic line, an English sentence's full stop would otherwise jump to its left end. */}
        {ok ? t('hubCorrect') : t('hubWrong', `⁦${answer}⁩`)}
      </Text>
      <HearButton word={sentence} />
      <Pressable onPress={onNext} style={[styles.primary, { backgroundColor: colors.primary }]}>
        <Text style={styles.primaryText}>{t('hubNext')}</Text>
      </Pressable>
    </>
  );
}

// ─── Choose the word ────────────────────────────────────────────────────────

export function GrammarChoose({ sentences, onFinish }: { sentences: readonly GrammarSentence[]; onFinish: Finish }) {
  const colors = useColors();
  const round = useMemo(() => buildChooseRound(sentences), [sentences]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];
  const s = q.sentence;

  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === q.answerIndex;
    if (ok) setCorrect(c => c + 1);
    buzz(ok);
    // Heard only once answered: before, the sentence would give the answer away.
    void playWord(s.text);
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <SentencePicture s={s} />
      {picked !== null ? <EnglishLine text={s.text} /> : s.choose!.kind === 'whole' ? null : <EnglishLine text={gapped(s)} />}
      <View style={{ width: '100%', gap: 12 }}>
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
        <Feedback ok={picked === q.answerIndex} answer={q.options[q.answerIndex]} onNext={next} sentence={s.text} />
      ) : null}
    </View>
  );
}

// ─── Build the sentence ─────────────────────────────────────────────────────

/** `Scramble` with words: tap a tile into the next slot, tap a placed tile to send it back. */
export function BuildSentence({ sentences, onFinish }: { sentences: readonly GrammarSentence[]; onFinish: Finish }) {
  const colors = useColors();
  const round = useMemo(() => buildSentenceRound(sentences), [sentences]);
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState<(BuildTile | null)[]>(() => round[0].tiles.map(() => null));
  const [result, setResult] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];
  const tray = q.tiles.filter(tile => !slots.some(s => s?.id === tile.id));

  const place = (tile: BuildTile) => {
    if (result !== null) return;
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    const next = [...slots];
    next[empty] = tile;
    setSlots(next);
    if (next.every(s => s !== null)) {
      const ok = isSentenceBuilt(next as BuildTile[], q.sentence);
      setResult(ok);
      if (ok) setCorrect(c => c + 1);
      buzz(ok);
      void playWord(q.sentence.text);
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
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <SentencePicture s={q.sentence} />

      <View style={styles.tileRow}>
        {slots.map((tile, idx) => (
          <Pressable
            key={idx}
            onPress={() => unplace(idx)}
            style={[
              styles.wordTile,
              {
                borderColor: result === null ? colors.border : result ? RIGHT : WRONG,
                backgroundColor: tile ? colors.card : 'transparent',
                borderStyle: tile ? 'solid' : 'dashed',
              },
            ]}
          >
            {tile ? <Text style={[styles.wordTileText, { color: colors.foreground }]}>{tile.text}</Text> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.tileRow}>
        {tray.map(tile => (
          <Pressable
            key={tile.id}
            onPress={() => place(tile)}
            style={[styles.wordTile, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Text style={[styles.wordTileText, { color: colors.foreground }]}>{tile.text}</Text>
          </Pressable>
        ))}
      </View>

      {result !== null ? <Feedback ok={result} answer={q.sentence.text} onNext={next} sentence={q.sentence.text} /> : null}
    </View>
  );
}

// ─── True or false ──────────────────────────────────────────────────────────

export function TrueFalse({ sentences, onFinish }: { sentences: readonly GrammarSentence[]; onFinish: Finish }) {
  const colors = useColors();
  const { t } = useLanguage();
  const round = useMemo(() => buildTrueFalseRound(sentences), [sentences]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];

  const pick = (said: boolean) => {
    if (picked !== null) return;
    setPicked(said);
    const ok = said === q.isTrue;
    if (ok) setCorrect(c => c + 1);
    buzz(ok);
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
    // A Grade 1 child reads with the sound: unlike Choose, hearing it gives nothing away.
    void playWord(round[i + 1].sentence.text);
  };

  const choice = (value: boolean) => {
    const shown = picked !== null && (value === q.isTrue || value === picked);
    const tint = !shown ? colors.border : value === q.isTrue ? RIGHT : WRONG;
    return (
      <Pressable
        key={String(value)}
        onPress={() => pick(value)}
        accessibilityRole="button"
        accessibilityLabel={t(value ? 'hubGIsTrue' : 'hubGIsFalse')}
        style={[styles.judge, { borderColor: tint, backgroundColor: shown ? tint + '18' : colors.card }]}
      >
        <Ionicons name={value ? 'checkmark' : 'close'} size={40} color={value ? RIGHT : WRONG} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t(value ? 'hubGIsTrue' : 'hubGIsFalse')}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <GrammarPicture word={q.pictureWord} count={q.sentence.picture!.count} marker={q.sentence.marker} />
      <EnglishLine text={q.sentence.text} />
      {picked === null ? <HearButton word={q.sentence.text} /> : null}
      {/* ✓ on the left in both languages: the pair is read with the English sentence. */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {choice(true)}
        {choice(false)}
      </View>
      {picked !== null ? (
        <Feedback ok={picked === q.isTrue} answer={t(q.isTrue ? 'hubGIsTrue' : 'hubGIsFalse')} onNext={next} sentence={q.sentence.text} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  picture: { fontSize: PICTURE_SIZE, lineHeight: PICTURE_SIZE + 16, textAlign: 'center' },
  marker: { fontSize: MARKER_SIZE, lineHeight: MARKER_SIZE + 8 },
  sentence: { fontFamily: 'ReadexPro_700Bold', fontSize: 24, textAlign: 'center', writingDirection: 'ltr' },
  option: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  optionText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 20, textAlign: 'center', writingDirection: 'ltr' },
  primary: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 32 },
  primaryText: { color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 15 },
  // A physical row, never flipped for Arabic: the order of the tiles is the English sentence's.
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  wordTile: { minWidth: 48, minHeight: 48, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  wordTileText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 20, writingDirection: 'ltr' },
  judge: { width: 120, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 4 },
});

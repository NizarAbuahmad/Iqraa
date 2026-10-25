/**
 * Rebuild a lesson term from its shuffled letters. Tap a tray letter to place
 * it, tap a placed letter to return it. Terms are Arabic, so both rows run
 * right-to-left whatever the UI language (RTL is laid out by hand in this app,
 * `I18nManager` is off). Only a first try without the hint scores; the hint
 * shows the term. Logic: services/lessonGames.ts.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { GameShell } from './GameShell';
import { buildTermScramble, isTermUnscrambled, type TermTile } from '@/services/lessonGames';
import { RADIUS, TYPE } from '@/constants/theme';

const ACCENT = '#7C3AED';
const RIGHT = '#16A34A';
const WRONG = '#DC2626';

export function TermScrambleGame({ terms, onBack, analytics, onFinished, footer }: {
  terms: string[];
  onBack?: () => void;
  analytics?: Record<string, string>;
  onFinished?: (score: number, total: number) => void;
  footer?: React.ReactNode;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [round, setRound] = useState(0);
  const questions = useMemo(() => buildTermScramble(terms), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState<(TermTile | null)[]>(() => questions[0]?.tiles.map(() => null) ?? []);
  const [result, setResult] = useState<boolean | null>(null);
  // A hint or a wrong first try means this question no longer scores.
  const [hinted, setHinted] = useState(false);
  const [missed, setMissed] = useState(false);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const q = questions[i];
  if (!q) return null;
  const tray = q.tiles.filter(tile => !slots.some(s => s?.id === tile.id));

  const place = (tile: TermTile) => {
    if (result !== null) return;
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    const next = [...slots];
    next[empty] = tile;
    setSlots(next);
    if (next.every(s => s !== null)) {
      const ok = isTermUnscrambled(next as TermTile[], q.answer);
      setResult(ok);
      if (ok && !hinted && !missed) setScore(s => s + 1);
      if (!ok) setMissed(true);
      void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const unplace = (idx: number) => {
    if (result !== null || slots[idx] === null) return;
    const next = [...slots];
    next[idx] = null;
    setSlots(next);
  };

  const go = (j: number) => {
    setI(j);
    setSlots(questions[j].tiles.map(() => null));
    setResult(null);
    setHinted(false);
    setMissed(false);
  };

  const next = () => (i + 1 >= questions.length ? setOver(true) : go(i + 1));
  const retry = () => { setSlots(q.tiles.map(() => null)); setResult(null); };
  const replay = () => { setRound(r => r + 1); setScore(0); setOver(false); setI(0); setResult(null); setHinted(false); setMissed(false); setSlots([]); };

  // After "play again" the new round's slots are set on first render.
  if (slots.length !== q.tiles.length) setSlots(q.tiles.map(() => null));

  const tile = (letter: string, extra: object, onPress: () => void, key: React.Key) => (
    <Pressable key={key} onPress={onPress} style={[styles.tile, extra]}>
      <Text style={[styles.tileText, { color: colors.foreground }]}>{letter}</Text>
    </Pressable>
  );

  return (
    <GameShell
      titleKey="lessonGameScrambleTitle"
      accent={ACCENT}
      scoreLabel={t('playScoreLabel', score, questions.length)}
      gameOver={over ? { message: t('playScoreLabel', score, questions.length), score, total: questions.length } : null}
      onReplay={replay}
      onBack={onBack}
      analytics={analytics}
      onFinished={onFinished}
      footer={footer}
    >
      <View style={{ flex: 1, padding: 20, gap: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          {t('playQuestionProgress', i + 1, questions.length)}
        </Text>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: 'center' }}>
          {t('lessonGameScramblePrompt')}
        </Text>
        {(hinted || result === true) && (
          <Text style={{ color: result === true ? RIGHT : ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.headline, writingDirection: 'rtl' }}>
            {q.term}
          </Text>
        )}

        <View style={styles.row}>
          {slots.map((s, idx) =>
            s
              ? tile(s.letter, { borderColor: result === null ? colors.border : result ? RIGHT : WRONG, backgroundColor: colors.card }, () => unplace(idx), `s${idx}`)
              : <Pressable key={`s${idx}`} style={[styles.tile, { borderColor: colors.border, borderStyle: 'dashed' }]} />,
          )}
        </View>

        <View style={styles.row}>
          {tray.map(x => tile(x.letter, { borderColor: colors.border, backgroundColor: colors.muted }, () => place(x), x.id))}
        </View>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 8 }}>
          {result === null && !hinted && (
            <Button label={t('lessonGameHint')} variant="secondary" onPress={() => setHinted(true)} />
          )}
          {result === false && <Button label={t('lessonGameRetry')} variant="secondary" onPress={retry} />}
          {result !== null && (
            <Button label={i + 1 >= questions.length ? t('lessonGameFinish') : t('playNext')} onPress={next} fill={ACCENT} />
          )}
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 420 },
  tile: { width: 44, height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title },
});

/**
 * Memory-match: flip two cards, keep them face up on a match, flip back
 * otherwise. Win condition is simply "every pair found" — moves count is the
 * only score, so fewer is better rather than more.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { GameShell } from './GameShell';
import { buildMemoryDeck, isMatch, type MemoryCard } from '@/services/publicGames/memory';

const ACCENT = '#0369A1';
const PAIR_COUNT = 8;

export function MemoryGame() {
  const colors = useColors();
  const { t } = useLanguage();
  const [round, setRound] = useState(0);
  const deck = useMemo(() => buildMemoryDeck(PAIR_COUNT), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false); // true while a non-matching pair is shown

  const won = matched.size === deck.length;

  const flip = (card: MemoryCard) => {
    if (busy || flipped.includes(card.id) || matched.has(card.id) || flipped.length === 2) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      const [aId, bId] = next;
      const a = deck.find(c => c.id === aId)!;
      const b = deck.find(c => c.id === bId)!;
      if (isMatch(a, b)) {
        setMatched(prev => new Set(prev).add(a.id).add(b.id));
        setFlipped([]);
      } else {
        setBusy(true);
        setTimeout(() => { setFlipped([]); setBusy(false); }, 700);
      }
    }
  };

  const replay = () => {
    setRound(r => r + 1);
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setBusy(false);
  };

  return (
    <GameShell
      titleKey="playMemoryTitle"
      accent={ACCENT}
      scoreLabel={t('playMemoryMoves', moves)}
      gameOver={won ? { message: `${t('playMemoryWin')} — ${t('playMemoryMoves', moves)}` } : null}
      onReplay={replay}
    >
      <View style={styles.grid}>
        {deck.map(card => {
          const isFaceUp = flipped.includes(card.id) || matched.has(card.id);
          return (
            <Pressable
              key={card.id}
              onPress={() => flip(card)}
              style={[
                styles.card,
                {
                  backgroundColor: isFaceUp ? colors.card : ACCENT,
                  borderColor: matched.has(card.id) ? '#16A34A' : colors.border,
                },
              ]}
            >
              <Text style={styles.icon}>{isFaceUp ? card.icon : ''}</Text>
            </Pressable>
          );
        })}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, justifyContent: 'center' },
  card: {
    width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 30 },
});

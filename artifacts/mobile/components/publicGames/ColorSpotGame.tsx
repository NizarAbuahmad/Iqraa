/**
 * Spot-the-different-square. Three lives; each correct tap advances the
 * round and the odd square gets a little closer in shade to the rest.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { GameShell } from './GameShell';
import { buildColorGrid } from '@/services/publicGames/colorSpot';

const ACCENT = '#DB2777';
const START_LIVES = 3;

export function ColorSpotGame() {
  const colors = useColors();
  const { t } = useLanguage();
  const [round, setRound] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [gameOverAt, setGameOverAt] = useState<number | null>(null);

  const grid = useMemo(() => buildColorGrid(round), [round]);

  const tap = (i: number) => {
    if (gameOverAt !== null) return;
    if (i === grid.oddIndex) {
      setWrongIndex(null);
      setRound(r => r + 1);
      return;
    }
    setWrongIndex(i);
    const remaining = lives - 1;
    setLives(remaining);
    if (remaining <= 0) setGameOverAt(round + 1);
  };

  const replay = () => {
    setRound(0);
    setLives(START_LIVES);
    setWrongIndex(null);
    setGameOverAt(null);
  };

  return (
    <GameShell
      titleKey="playColorsTitle"
      accent={ACCENT}
      scoreLabel={`${t('playColorsRound', round + 1)} · ${t('playColorsLives', lives)}`}
      gameOver={gameOverAt !== null ? { message: t('playColorsGameOver', gameOverAt) } : null}
      onReplay={replay}
    >
      <View style={{ flex: 1, padding: 20, gap: 20 }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: 'center' }}>
          {t('playColorsInstructions')}
        </Text>
        <View style={styles.grid}>
          {grid.colors.map((c, i) => (
            <Pressable
              key={i}
              onPress={() => tap(i)}
              style={[
                styles.square,
                { backgroundColor: c, borderColor: wrongIndex === i ? '#DC2626' : 'transparent' },
              ]}
            />
          ))}
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  square: { width: 90, height: 90, borderRadius: 12, borderWidth: 3 },
});

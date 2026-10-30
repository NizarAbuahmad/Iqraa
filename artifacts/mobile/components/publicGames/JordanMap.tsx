/**
 * The 12 governorates of Jordan, drawn from services/publicGames/jordanMapData.ts.
 * Shown only after an answer: the right governorate is filled in the game's
 * accent, a wrong pick is outlined in red. Decorative for screen readers (the
 * explanation line says the same thing in words).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { readableOn } from '@/services/readableColor';
import { SPACE, TYPE } from '@/constants/theme';
import { JORDAN_MAP } from '@/services/publicGames/jordanMapData';

const WRONG = '#DC2626';
const MAP_MAX_WIDTH = 320; // the size of a drawing, not spacing
const [, , VW, VH] = JORDAN_MAP.viewBox.split(' ').map(Number) as [number, number, number, number];

export function JordanMap({ correctId, pickedId, accent }: { correctId: string; pickedId: string; accent: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  const lit = readableOn(accent, colors.card, 3);
  const wrong = pickedId !== correctId ? pickedId : null;
  // Draw the wrong pick, then the right one, last, so their outlines sit on top.
  const order = [...Object.keys(JORDAN_MAP.paths).filter(id => id !== wrong && id !== correctId), ...(wrong ? [wrong] : []), correctId];
  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <Svg width="100%" height="100%" viewBox={JORDAN_MAP.viewBox} accessible={false}>
          {order.map(id => (
            <Path
              key={id}
              d={JORDAN_MAP.paths[id]}
              fillRule="evenodd"
              fill={id === correctId ? lit : colors.muted}
              stroke={colors.mutedForeground}
              strokeOpacity={0.5}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
          {wrong ? (
            // Last, so the right governorate's stroke cannot cover a shared edge.
            <Path d={JORDAN_MAP.paths[wrong]} fill="none" stroke={WRONG} strokeWidth={2.5} strokeLinejoin="round" />
          ) : null}
        </Svg>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, textAlign: 'center' }}>
        {t('playMapCredit')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch', gap: SPACE.xs },
  map: { width: '100%', maxWidth: MAP_MAX_WIDTH, aspectRatio: VW / VH, alignSelf: 'center' },
});

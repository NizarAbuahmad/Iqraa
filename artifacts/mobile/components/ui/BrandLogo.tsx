import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import {
  BRAND_INK,
  BRAND_TEAL,
  DOT,
  LEAF_PATH,
  LOCKUP_ASPECT,
  LOCKUP_MARK_OFFSET,
  LOCKUP_VIEWBOX,
  MARK_RADIUS,
  STEM_PATH,
  WORDMARK_PATH,
} from '@/constants/brandMark';

type Props = {
  /**
   * true  → white lockup (for teal / navy / dark backgrounds)
   * false → teal mark with ink wordmark (for light backgrounds)
   */
  onDark?: boolean;
  /** Width of the whole lockup; height follows its aspect. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * The Iqrra lockup: the leaf mark beside the اقرأ wordmark. Drawn as vector, so
 * it is crisp at any size and needs no font.
 */
export function BrandLogo({ onDark = false, width = 96, style, accessibilityLabel = 'Iqrra' }: Props) {
  const ground = onDark ? '#FFFFFF' : BRAND_TEAL;
  const leaf = onDark ? BRAND_TEAL : '#FFFFFF';
  const ink = onDark ? '#FFFFFF' : BRAND_INK;

  return (
    <View style={style} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={width / LOCKUP_ASPECT} viewBox={LOCKUP_VIEWBOX}>
        <G transform={`translate(${LOCKUP_MARK_OFFSET.x} ${LOCKUP_MARK_OFFSET.y})`}>
          <Rect width={48} height={48} rx={48 * MARK_RADIUS} fill={ground} />
          <Path d={LEAF_PATH} fill={leaf} />
          <Path d={STEM_PATH} stroke={ground} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={leaf} />
        </G>
        <Path d={WORDMARK_PATH} fill={ink} />
      </Svg>
    </View>
  );
}

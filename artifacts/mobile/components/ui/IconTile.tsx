import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { GlyphId } from '@/constants/glyphs';
import { TILE_ICON, type IconName, type TileSize } from '@/constants/icons';
import { RADIUS } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';
import { ConceptIcon } from './Glyph';

/**
 * A rounded square that leads a list row or card: the glyph in its concept's
 * colour on a 12% tint of the same colour. A bare grey icon says nothing about
 * what a row is; a tinted tile lets the eye sort a list by kind before it reads.
 *
 * `soft` (default) sits on a card: the tint is `color + '1F'` and the glyph is
 * `readableOn(color, colors.card)`, so it holds 4.5:1 in dark mode too.
 * `onBand` is for a coloured header band, where a 12% tint would vanish: a
 * white tile with the glyph readable on white.
 *
 * Decorative: the row's own text is what a screen reader hears.
 */
export function IconTile({
  icon,
  glyph,
  color,
  size = 44,
  tone = 'soft',
  style,
}: {
  icon: IconName;
  /** Iqraa's own drawing, drawn in place of `icon` when the concept has one. */
  glyph?: GlyphId;
  color: string;
  size?: TileSize;
  tone?: 'soft' | 'onBand';
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const onBand = tone === 'onBand';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: RADIUS.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundColor: onBand ? '#FFFFFF' : color + '1F',
        },
        style,
      ]}
    >
      <ConceptIcon icon={icon} glyph={glyph} size={TILE_ICON[size]} color={readableOn(color, onBand ? '#FFFFFF' : colors.card)} />
    </View>
  );
}

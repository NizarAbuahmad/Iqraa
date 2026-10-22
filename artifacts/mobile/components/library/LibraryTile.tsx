/**
 * One tile on the library's front row, in three parts:
 * - a strip of its corner's colour and pattern across the top;
 * - the icon on a filled circle that sits across the strip's edge;
 * - the title, and a line under it.
 *
 * The corner tiles wear their corner, so its look is learned before it is
 * entered. The curriculum and «my exams» tiles wear the brand teal and leaf.
 *
 * The strip rounds its own top corners instead of the tile clipping it: a
 * clipping tile would cut off its own shadow on iOS (see Surface.tsx). The
 * accessibility label is «title, line», as the library's tiles always read.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { MotifId } from '@/constants/corners';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { CornerMotif } from '@/components/corners/CornerMotif';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';

export type TileLook = { hero: string; primary: string; primaryForeground: string };

type Props = {
  /** Position in the row, for the entrance stagger. */
  index: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
  /** The «my exams» waiting count is a call to act, drawn in the tile's primary. */
  descStrong?: boolean;
  look: TileLook;
  motif: MotifId;
  motifOpacity: number;
  onPress: () => void;
};

const STRIP = 28;
const BADGE = 52;

export function LibraryTile({ index, icon, title, desc, descStrong, look, motif, motifOpacity, onPress }: Props) {
  const colors = useColors();
  const surface = useSurface();
  return (
    <Entrance index={index} style={styles.cell}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${desc}`}
        style={[styles.tile, surface]}
      >
        <View style={[styles.strip, { backgroundColor: look.hero }]}>
          <CornerMotif motif={motif} opacity={motifOpacity} />
        </View>
        <View style={[styles.badge, { backgroundColor: look.primary, borderColor: colors.card }]}>
          <Ionicons name={icon} size={24} color={look.primaryForeground} />
        </View>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.desc,
            {
              color: descStrong ? look.primary : colors.mutedForeground,
              fontFamily: descStrong ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
            },
          ]}
        >
          {desc}
        </Text>
      </PressableScale>
    </Entrance>
  );
}

const styles = StyleSheet.create({
  cell: { flexGrow: 1, flexBasis: '30%', minWidth: 104, maxWidth: 220 },
  tile: { flexGrow: 1, alignItems: 'center', gap: SPACE.xs, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.sm },
  strip: {
    alignSelf: 'stretch',
    height: STRIP,
    marginHorizontal: -SPACE.sm,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    marginTop: -BADGE / 2,
    marginBottom: SPACE.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: TYPE.label, textAlign: 'center' },
  desc: { fontSize: TYPE.caption, textAlign: 'center' },
});

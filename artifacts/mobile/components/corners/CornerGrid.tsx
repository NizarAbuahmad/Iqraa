/**
 * A corner hub's cards: one column on a phone, two on a tablet, three on
 * desktop (services/cornerLayout.ts), inside the frame's 1120px cap. Cards
 * carry no margins of their own — the grid pays the edges and the gutters —
 * so a card looks the same in a column and in a cell. Each cell enters in turn
 * (`Entrance`), in reading order.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { SPACE } from '@/constants/theme';
import { Entrance } from '@/components/ui/Entrance';
import { cornerColumns } from '@/services/cornerLayout';

export function CornerGrid({ children }: { children: React.ReactNode }) {
  const viewportW = useViewportWidth();
  const { isRTL } = useLanguage();
  const cols = cornerColumns(Math.min(viewportW, CONTENT_MAX_WIDTH));
  const width: `${number}%` = `${100 / cols}%`;
  // toArray drops null/false children, so the stagger counts only cards that are there.
  return (
    <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {React.Children.toArray(children).map((child, i) => (
        <Entrance key={React.isValidElement(child) && child.key != null ? child.key : i} index={i} style={[styles.cell, { width }]}>
          {child}
        </Entrance>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm },
  cell: { padding: SPACE.sm },
});

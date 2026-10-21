/**
 * A corner's band pattern, drawn in white at the corner's `motifOpacity` over
 * the hero colour. Vector only: nothing to ship per density, nothing to bump
 * in app.json. Five motifs, one per corner — add a case when a corner is
 * added, or the band is plain.
 */
import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { MotifId } from '@/constants/corners';

type Props = { motif: MotifId; opacity: number };

export function CornerMotif({ motif, opacity }: Props) {
  // Pattern ids are global to the document, and on web earlier stack screens
  // stay mounted (hidden), so a fixed id would bind to the hidden screen's
  // pattern. useId's colons are not valid in a url(#…) reference.
  const id = 'motif-' + useId().replace(/:/g, '');
  return (
    <Svg pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]} width="100%" height="100%">
      {MOTIFS[motif](id)}
    </Svg>
  );
}

const MOTIFS: Record<MotifId, (id: string) => React.ReactNode> = {
  grid: id => (
    <>
      <Defs>
        <Pattern id={id} width={24} height={24} patternUnits="userSpaceOnUse">
          <Path d="M24 0H0V24" fill="none" stroke="#fff" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
      <Path d="M0 150 Q 100 20 200 120 T 420 40" fill="none" stroke="#fff" strokeWidth={2.5} />
    </>
  ),
  bubbles: () => (
    <>
      <G fill="none" stroke="#fff" strokeWidth={2}>
        <Rect x={20} y={30} width={90} height={46} rx={14} />
        <Path d="M40 76 l-8 14 l22 -14" />
        <Rect x={250} y={95} width={110} height={50} rx={16} />
        <Path d="M340 145 l8 14 l-22 -14" />
        <Rect x={150} y={10} width={70} height={36} rx={12} />
      </G>
      <SvgText x={55} y={63} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hi!</SvgText>
      <SvgText x={275} y={130} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hello</SvgText>
      <SvgText x={165} y={36} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={18}>ABC</SvgText>
    </>
  ),
  hex: id => (
    <>
      <Defs>
        <Pattern id={id} width={40} height={69} patternUnits="userSpaceOnUse">
          <Path d="M20 0L40 11.5V34.5L20 46L0 34.5V11.5Z M20 46L40 57.5V80 M0 57.5L20 46" fill="none" stroke="#fff" strokeWidth={1.4} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  ),
  stars: id => (
    <>
      <Defs>
        <Pattern id={id} width={64} height={64} patternUnits="userSpaceOnUse">
          <G fill="none" stroke="#fff" strokeWidth={1.2}>
            <Rect x={18} y={18} width={28} height={28} transform="rotate(45 32 32)" />
            <Rect x={18} y={18} width={28} height={28} />
            <Circle cx={0} cy={0} r={6} />
            <Circle cx={64} cy={64} r={6} />
            <Circle cx={0} cy={64} r={6} />
            <Circle cx={64} cy={0} r={6} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  ),
  confetti: () => (
    <G fill="#fff">
      <Circle cx={30} cy={40} r={5} />
      <Circle cx={90} cy={120} r={4} />
      <Circle cx={330} cy={30} r={6} />
      <Circle cx={280} cy={140} r={4} />
      <Rect x={150} y={20} width={10} height={10} transform="rotate(20 155 25)" />
      <Rect x={230} y={90} width={9} height={9} transform="rotate(-15 234 94)" />
      <Rect x={60} y={150} width={8} height={8} transform="rotate(35 64 154)" />
      <Path d="M350 100 l6 12 l13 2 l-9 9 l2 13 l-12 -6 l-12 6 l2 -13 l-9 -9 l13 -2z" />
      <Path d="M190 130 l5 10 l11 2 l-8 8 l2 11 l-10 -5 l-10 5 l2 -11 l-8 -8 l11 -2z" />
      <Path d="M110 60 l4 8 l9 1 l-6 6 l1 9 l-8 -4 l-8 4 l1 -9 l-6 -6 l9 -1z" />
    </G>
  ),
};

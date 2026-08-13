/**
 * The Jordanian flag, drawn rather than typed.
 *
 * This was `🇯🇴` inline. That is a regional-indicator pair, and **Windows ships
 * no flag glyphs at all** — Segoe UI Emoji renders every country flag as its two
 * letters, so an Arabic lesson line opened in Chrome on a Jordanian teacher's
 * laptop began with a stray latin "jo". It looked like a text-encoding bug in
 * the one place the product is claiming national-curriculum provenance.
 *
 * Vector avoids the whole class of problem: identical on Windows, Android, iOS
 * and every browser, and crisp at the 13px it is used at.
 */
import React from 'react';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

const BLACK = '#000000';
const WHITE = '#FFFFFF';
const GREEN = '#007A3D';
const RED = '#CE1126';

type Props = {
  /** Width in px. Height follows the flag's 2:1 ratio. */
  width?: number;
};

export function JordanFlag({ width = 18 }: Props) {
  const height = width / 2;

  return (
    <Svg width={width} height={height} viewBox="0 0 72 36" accessibilityLabel="الأردن">
      <Rect x="0" y="0" width="72" height="12" fill={BLACK} />
      <Rect x="0" y="12" width="72" height="12" fill={WHITE} />
      <Rect x="0" y="24" width="72" height="12" fill={GREEN} />
      {/* Hoist triangle — points to the fly side. */}
      <Polygon points="0,0 36,18 0,36" fill={RED} />
      {/*
        The seven-pointed star, at the size it actually renders: a literal
        heptagram at 13px reads as noise, so this is the star simplified to its
        silhouette. Recognisable, and it does not turn into a white smudge.
      */}
      <Path
        d="M11 18 L13.6 16.1 L12.6 13 L15.7 14 L17.6 11.4 L19.5 14 L22.6 13 L21.6 16.1 L24.2 18 L21.6 19.9 L22.6 23 L19.5 22 L17.6 24.6 L15.7 22 L12.6 23 L13.6 19.9 Z"
        fill={WHITE}
      />
    </Svg>
  );
}

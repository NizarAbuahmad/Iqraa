import React, { useId } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import {
  GLYPHS,
  GLYPH_STROKE,
  GLYPH_TINT,
  GLYPH_VIEWBOX,
  cutPath,
  type GlyphId,
  type GlyphPart,
} from '@/constants/glyphs';
import type { IconName } from '@/constants/icons';

/**
 * One of Iqraa's own icons (`constants/glyphs.ts`) in `color`: the outline at
 * full strength, the main shape tinted with the same colour. The caller picks a
 * colour that already reads on its background (`readableOn`, or `textOn` on a
 * solid fill), exactly as it would for an Ionicons glyph.
 *
 * Decorative: whatever row or button holds it supplies the label.
 */
export function Glyph({ name, size, color }: { name: GlyphId; size: number; color: string }) {
  // The clip is referenced by url(#id), so the id must be a plain token.
  const clipId = 'glyph-cut-' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const def = GLYPHS[name];
  const cut = 'cut' in def ? def.cut : undefined;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${GLYPH_VIEWBOX} ${GLYPH_VIEWBOX}`}
      fill="none"
      stroke={color}
      strokeWidth={GLYPH_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Native reads the first two; react-native-web only maps aria-hidden.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {cut ? (
        <Defs>
          <ClipPath id={clipId}>
            {/* Web reads the rule here; iOS and Android read it from the clipped G. */}
            <Path d={cutPath(cut)} clipRule="evenodd" fillRule="evenodd" />
          </ClipPath>
        </Defs>
      ) : null}
      {cut ? <G clipPath={`url(#${clipId})`} clipRule="evenodd">{def.parts.filter(p => 'cut' in p).map((p, i) => part(p, i, color))}</G> : null}
      {def.parts.filter(p => !cut || !('cut' in p)).map((p, i) => part(p, i + 100, color))}
    </Svg>
  );
}

function paint(role: GlyphPart['role'], color: string) {
  switch (role) {
    case 'tinted': return { fill: color, fillOpacity: GLYPH_TINT };
    case 'tint': return { fill: color, fillOpacity: 0.22, stroke: 'none' };
    case 'solid': return { fill: color, stroke: 'none' };
    case 'faint': return { strokeOpacity: 0.35 };
    default: return {};
  }
}

function part(p: GlyphPart, key: number, color: string) {
  const look = paint(p.role, color);
  switch (p.el) {
    case 'path': return <Path key={key} d={p.d} {...look} />;
    case 'rect': return <Rect key={key} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...look} />;
    case 'circle': return <Circle key={key} cx={p.cx} cy={p.cy} r={p.r} {...look} />;
  }
}

/**
 * A concept's icon: its own drawing when it has one, else the stock glyph. The
 * one way a screen draws a tool or corner icon, so a concept that gains a
 * drawing changes everywhere at once.
 */
export function ConceptIcon({
  icon,
  glyph,
  size,
  color,
}: {
  icon: IconName;
  glyph?: GlyphId;
  size: number;
  color: string;
}) {
  return glyph ? <Glyph name={glyph} size={size} color={color} /> : <Ionicons name={icon} size={size} color={color} />;
}

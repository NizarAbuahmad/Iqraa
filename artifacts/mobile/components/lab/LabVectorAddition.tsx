/**
 * Two vectors drawn head-to-tail with their resultant, adjusted with − / +
 * steppers (big targets, easy on a projector). All geometry comes from
 * `labVectors.ts`, so what is drawn is what the tests checked.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { addVectors, layoutScene, type PolarVector, type ScenePoint } from '@/services/labVectors';
import { formatLabNumber } from '@/services/labFormat';

const SIZE = 300;
const A_COLOR = '#0EA5E9';
const B_COLOR = '#F97316';

export function LabVectorAddition() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [a, setA] = useState<PolarVector>({ magnitude: 3, angleDeg: 0 });
  const [b, setB] = useState<PolarVector>({ magnitude: 4, angleDeg: 90 });

  const { resultant } = useMemo(() => addVectors(a, b), [a, b]);
  const scene = useMemo(() => layoutScene(a, b, SIZE), [a, b]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Arrow from={scene.origin} to={scene.aTip} color={A_COLOR} label="A" />
          <Arrow from={scene.aTip} to={scene.rTip} color={B_COLOR} label="B" />
          <Arrow from={scene.origin} to={scene.rTip} color={colors.primary} label="R" bold />
        </Svg>
      </View>

      <Control title={t('labVecA')} color={A_COLOR} v={a} onChange={setA} lang={lang} isRTL={isRTL} t={t} colors={colors} />
      <Control title={t('labVecB')} color={B_COLOR} v={b} onChange={setB} lang={lang} isRTL={isRTL} t={t} colors={colors} />

      <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }}>
          {t('labVecResultant')}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }}>
          {formatLabNumber(resultant.magnitude, lang)} @ {formatLabNumber(resultant.angleDeg, lang, 1)}°
        </Text>
      </View>
    </View>
  );
}

function Arrow({
  from,
  to,
  color,
  label,
  bold,
}: {
  from: ScenePoint;
  to: ScenePoint;
  color: string;
  label: string;
  bold?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const head = 10;
  const base = { x: to.x - ux * head, y: to.y - uy * head };
  const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
  const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
  const mid = { x: (from.x + to.x) / 2 - uy * 12, y: (from.y + to.y) / 2 + ux * 12 };
  return (
    <>
      <Line x1={from.x} y1={from.y} x2={base.x} y2={base.y} stroke={color} strokeWidth={bold ? 4 : 3} />
      <Polygon points={`${to.x},${to.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color} />
      <SvgText x={mid.x} y={mid.y} fill={color} fontSize={14} fontWeight="bold" textAnchor="middle">
        {label}
      </SvgText>
    </>
  );
}

function Control({
  title,
  color,
  v,
  onChange,
  lang,
  isRTL,
  t,
  colors,
}: {
  title: string;
  color: string;
  v: PolarVector;
  onChange: (v: PolarVector) => void;
  lang: 'ar' | 'en';
  isRTL: boolean;
  t: (k: 'labVecMagnitude' | 'labVecAngle') => string;
  colors: { foreground: string; mutedForeground: string; muted: string; card: string; border: string };
}) {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  return (
    <View style={[styles.control, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ color, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }}>{title}</Text>
      <Stepper
        label={t('labVecMagnitude')}
        value={formatLabNumber(v.magnitude, lang)}
        onMinus={() => onChange({ ...v, magnitude: clamp(v.magnitude - 1, 0, 20) })}
        onPlus={() => onChange({ ...v, magnitude: clamp(v.magnitude + 1, 0, 20) })}
        colors={colors}
        isRTL={isRTL}
      />
      <Stepper
        label={t('labVecAngle')}
        value={formatLabNumber(v.angleDeg, lang)}
        onMinus={() => onChange({ ...v, angleDeg: (v.angleDeg - 15 + 360) % 360 })}
        onPlus={() => onChange({ ...v, angleDeg: (v.angleDeg + 15) % 360 })}
        colors={colors}
        isRTL={isRTL}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  colors,
  isRTL,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: { foreground: string; mutedForeground: string; muted: string };
  isRTL: boolean;
}) {
  return (
    <View style={[styles.stepper, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel="−" style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stepText, { color: colors.foreground }]}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 56, textAlign: 'center', color: colors.foreground, fontSize: 18, fontFamily: 'ReadexPro_600SemiBold' }}>{value}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="+" style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stepText, { color: colors.foreground }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  control: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  stepper: { alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, lineHeight: 28 },
  result: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 4 },
});

/**
 * Drop-in replacement for `<Text style={style}>{text}</Text>` on generated
 * content that may contain math — worksheet/quiz questions, lesson-plan
 * sections, chat replies. Before this, "3x^2" and "(x+1)/(x-1)" rendered as
 * typed-looking flat strings everywhere except the projector; this is the
 * same MathText/hasRenderableMath decision the projector already uses,
 * reused rather than reinvented per screen.
 *
 * Splits on newlines (a no-op for single-line content, since a bare string
 * with no '\n' is already a one-element array) and renders each line either
 * through MathText or as plain text — a line the parser doesn't recognise
 * renders exactly as the original <Text> did, so prose is never at risk.
 *
 * MathText's own row can pack either reading direction depending on whether
 * the LINE itself opens with Arabic — that is its own internal decision,
 * correct for a mixed prose+equation line like "بسّط: 3x^2 - 5". It is
 * independent of where the whole block sits on the page, which this
 * wrapper's `alignItems` controls — so a bare equation with no Arabic
 * lead-in (a worksheet question that's nothing but "3x^2 - 5 = 0") still
 * lands on the correct margin instead of drifting to the wrong side.
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import { MathText } from '@/components/classroom/MathText';
import { hasRenderableMath, isolateForeignRuns } from '@/services/mathRender';

type LineStyle = Pick<TextStyle, 'fontSize' | 'color' | 'fontFamily' | 'lineHeight' | 'textAlign' | 'writingDirection'>;

type Props = {
  text: string;
  style: LineStyle;
  isRTL?: boolean;
  /** Wraps the whole block — pass `{ flex: 1 }` etc. to match the layout the plain <Text> sat in. */
  containerStyle?: ViewStyle;
};

export function MathParagraph({ text, style, isRTL, containerStyle }: Props) {
  const lines = (text ?? '').split('\n');
  const align = style.textAlign ?? (isRTL ? 'right' : 'left');
  return (
    <View style={[{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }, containerStyle]}>
      {lines.map((line, i) =>
        hasRenderableMath(line) ? (
          <MathText
            key={i}
            text={line}
            fontSize={(style.fontSize as number) ?? 14}
            color={(style.color as string) ?? '#000'}
            fontFamily={(style.fontFamily as string) ?? 'Almarai_400Regular'}
            isRTL={isRTL}
          />
        ) : (
          <Text key={i} style={style}>{isolateForeignRuns(line)}</Text>
        ),
      )}
    </View>
  );
}

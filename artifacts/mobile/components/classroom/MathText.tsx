/**
 * Draws a slide line with real mathematical layout: stacked fraction bars,
 * raised exponents, a radical with an overline. Pure Views/Texts, so it
 * renders identically on native and web with no math library or WebView.
 *
 * Only lines where the parser found an actual construct come here — the
 * caller keeps plain <Text> for everything else, so prose never risks the
 * flex re-layout. Math itself is laid out LTR regardless of UI language
 * (matching how equations already render as flat strings today); an Arabic
 * prose line with embedded math keeps RTL reading order via row-reverse.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseMathLine, type MathNode } from '@/services/mathRender';

type Props = {
  text: string;
  fontSize: number;
  color: string;
  /** Bold family for equations, regular for hints/answers. */
  fontFamily?: string;
  /** Reading direction of the surrounding line (math itself stays LTR). */
  isRTL?: boolean;
  /** Center the line (projected equations) or align to the reading edge. */
  centered?: boolean;
};

const ARABIC_LEAD = /^[\s]*[؀-ۿ]/;

export function MathText({ text, fontSize, color, fontFamily = 'Cairo_700Bold', isRTL, centered }: Props) {
  const nodes = parseMathLine(text);
  // A line that *reads* as Arabic prose keeps its segments in RTL visual
  // order; a pure equation reads LTR even inside an Arabic deck.
  const rtlLine = isRTL && ARABIC_LEAD.test(text);

  return (
    <View
      style={[
        styles.row,
        {
          flexDirection: rtlLine ? 'row-reverse' : 'row',
          justifyContent: centered ? 'center' : (rtlLine ? 'flex-start' : 'flex-start'),
        },
      ]}
    >
      {nodes.map((n, i) => (
        <Node key={i} node={n} fontSize={fontSize} color={color} fontFamily={fontFamily} />
      ))}
    </View>
  );
}

function Node({ node, fontSize, color, fontFamily }: {
  node: MathNode; fontSize: number; color: string; fontFamily: string;
}) {
  const base = { fontSize, color, fontFamily, lineHeight: Math.round(fontSize * 1.4) };

  if (node.kind === 'text') {
    return <Text style={base}>{node.text}</Text>;
  }

  if (node.kind === 'sup') {
    const supSize = Math.max(11, Math.round(fontSize * 0.62));
    return (
      <View style={styles.supRow}>
        <Text style={base}>{node.base}</Text>
        <Text style={{ fontSize: supSize, color, fontFamily, lineHeight: Math.round(supSize * 1.15) }}>
          {node.exp}
        </Text>
      </View>
    );
  }

  if (node.kind === 'frac') {
    const partSize = Math.max(12, Math.round(fontSize * 0.8));
    return (
      <View style={styles.fracCol}>
        <View style={styles.fracPart}>
          {node.num.map((n, i) => (
            <Node key={i} node={n} fontSize={partSize} color={color} fontFamily={fontFamily} />
          ))}
        </View>
        <View style={[styles.fracBar, { backgroundColor: color }]} />
        <View style={styles.fracPart}>
          {node.den.map((n, i) => (
            <Node key={i} node={n} fontSize={partSize} color={color} fontFamily={fontFamily} />
          ))}
        </View>
      </View>
    );
  }

  // root
  return (
    <View style={styles.rootRow}>
      <Text style={{ fontSize: Math.round(fontSize * 1.05), color, fontFamily, lineHeight: Math.round(fontSize * 1.4) }}>
        √
      </Text>
      <View style={[styles.rootBody, { borderTopColor: color }]}>
        {node.body.map((n, i) => (
          <Node key={i} node={n} fontSize={fontSize} color={color} fontFamily={fontFamily} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexWrap: 'wrap', alignItems: 'center' },
  // Exponent hangs off the top of its base — flex-start against the base's
  // full line height reads as "raised" without unsupported baseline shifts.
  supRow: { flexDirection: 'row', alignItems: 'flex-start' },
  fracCol: { alignItems: 'center', paddingHorizontal: 3, alignSelf: 'center' },
  fracPart: { flexDirection: 'row', alignItems: 'center' },
  fracBar: { alignSelf: 'stretch', height: 2, borderRadius: 1, marginVertical: 1 },
  rootRow: { flexDirection: 'row', alignItems: 'center' },
  rootBody: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 2, paddingHorizontal: 2, paddingTop: 1 },
});

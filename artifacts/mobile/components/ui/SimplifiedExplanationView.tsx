/**
 * «تبسيط الشرح» rendered — a handout the student reads, not a plan.
 *
 * Read-only on purpose for now. `LessonPlanView` is editable because its
 * fields are flat strings that `EditableText` can take; this artifact's
 * `workedExample` and `misconception` are nested objects, and there is no
 * nested-field editor yet. A teacher who does not like what came back
 * regenerates. Editing is its own change, not a half-done one here.
 *
 * The answers sit in their own block at the end rather than under each
 * question: this sheet goes home with the student, so the checks have to be
 * answerable before the key is in view. An item whose `answer` is absent
 * prints nothing there — an omitted answer means nothing established one, and
 * a guess printed under «الإجابات» reads as official.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SimplifiedExplanationOutput } from '@/services/ai/AIService';
import { MathParagraph } from '@/components/ui/MathParagraph';

type Colors = {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  primary: string;
  muted: string;
  radius: number;
};

type Props = {
  explainer: SimplifiedExplanationOutput;
  colors: Colors;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
  accent: string;
};

export function SimplifiedExplanationView({ explainer, colors, isRTL, t, accent }: Props) {
  const align = isRTL ? 'right' : 'left';
  const body = {
    fontSize: styles.bodyText.fontSize,
    lineHeight: styles.bodyText.lineHeight,
    color: colors.foreground,
    fontFamily: 'Almarai_400Regular',
    textAlign: align,
  } as const;

  const answered = explainer.checks.filter(c => (c.answer ?? '').trim().length > 0);

  return (
    <View>
      <Section title={t('sectionBigIdea')} icon="bulb-outline" {...{ isRTL, colors, accent }}>
        <MathParagraph text={explainer.bigIdea} style={body} isRTL={isRTL} />
      </Section>

      <Section title={t('sectionExplanation')} icon="list-outline" {...{ isRTL, colors, accent }}>
        {explainer.explanation.map((step, i) => (
          <NumberedRow key={i} n={i + 1} {...{ colors, isRTL, accent }}>
            <MathParagraph text={step} style={body} isRTL={isRTL} />
          </NumberedRow>
        ))}
      </Section>

      {explainer.keyWords && explainer.keyWords.length > 0 ? (
        <Section title={t('sectionKeyWords')} icon="book-outline" {...{ isRTL, colors, accent }}>
          {explainer.keyWords.map((w, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={[styles.term, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
                {w.term}
              </Text>
              <MathParagraph text={w.meaning} style={body} isRTL={isRTL} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title={t('sectionWorkedExample')} icon="create-outline" {...{ isRTL, colors, accent }}>
        <MathParagraph text={explainer.workedExample.text} style={body} isRTL={isRTL} />
        {explainer.workedExample.steps.map((step, i) => (
          <NumberedRow key={i} n={i + 1} {...{ colors, isRTL, accent }}>
            <MathParagraph text={step} style={body} isRTL={isRTL} />
          </NumberedRow>
        ))}
        <View style={[styles.answerBox, { borderColor: accent, borderRadius: colors.radius }]}>
          <MathParagraph
            text={`${t('workedExampleAnswerLabel')} ${explainer.workedExample.answer}`}
            style={{ ...body, fontFamily: 'Cairo_600SemiBold' }}
            isRTL={isRTL}
          />
        </View>
      </Section>

      <Section title={t('sectionMisconception')} icon="alert-circle-outline" {...{ isRTL, colors, accent }}>
        <MathParagraph
          text={explainer.misconception.claim}
          style={{ ...body, color: colors.mutedForeground }}
          isRTL={isRTL}
        />
        <MathParagraph text={explainer.misconception.correction} style={body} isRTL={isRTL} />
      </Section>

      <Section title={t('sectionSelfCheck')} icon="help-circle-outline" {...{ isRTL, colors, accent }}>
        {explainer.checks.map((c, i) => (
          <NumberedRow key={i} n={i + 1} {...{ colors, isRTL, accent }}>
            <MathParagraph text={c.text} style={body} isRTL={isRTL} />
          </NumberedRow>
        ))}
      </Section>

      {answered.length > 0 ? (
        <Section title={t('sectionSelfCheckAnswers')} icon="key-outline" {...{ isRTL, colors, accent }}>
          {explainer.checks.map((c, i) =>
            (c.answer ?? '').trim().length > 0 ? (
              <NumberedRow key={i} n={i + 1} {...{ colors, isRTL, accent }}>
                <MathParagraph text={c.answer as string} style={body} isRTL={isRTL} />
              </NumberedRow>
            ) : null,
          )}
        </Section>
      ) : null}
    </View>
  );
}

function NumberedRow({
  n, colors, isRTL, accent, children,
}: {
  n: number;
  colors: Colors;
  isRTL: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.numberedRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={[styles.number, { color: accent, fontFamily: 'Cairo_600SemiBold' }]}>{n}.</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Section({
  title, icon, isRTL, colors, accent, children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  isRTL: boolean;
  colors: Colors;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={15} color={accent} />
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {title}
        </Text>
      </View>
      <View
        style={[
          styles.body,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, marginBottom: 6 },
  headerTitle: { fontSize: 13 },
  body: { borderWidth: 1, padding: 12, gap: 8 },
  bodyText: { fontSize: 13.5, lineHeight: 22 },
  numberedRow: { alignItems: 'flex-start', gap: 8 },
  number: { fontSize: 13, lineHeight: 22, minWidth: 16 },
  term: { fontSize: 13.5, lineHeight: 22 },
  answerBox: { borderWidth: 1, borderStyle: 'dashed', padding: 8, marginTop: 4 },
});

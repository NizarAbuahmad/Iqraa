/**
 * The lesson plan, rendered and editable — used by the tool screen and by chat.
 *
 * One component on purpose. The chat produces exactly the same
 * `LessonPlanOutput` as the tool screen does — it calls the same generator —
 * and then used to flatten it to a string one line later, so the same plan
 * looked like a document in one place and a paragraph in the other, and was
 * only editable in the first. Two renderers would drift; this one cannot.
 *
 * `onEdit` is optional. Without it the plan is read-only, which is what
 * exporting and previewing want.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LessonPlanOutput } from '@/services/ai/AIService';
import { EditableList, EditableText } from '@/components/ui/Editable';
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
  plan: LessonPlanOutput;
  colors: Colors;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
  accent: string;
  /** Omit to render read-only. */
  onEdit?: <K extends keyof LessonPlanOutput>(field: K, value: LessonPlanOutput[K]) => void;
  editedFields?: ReadonlySet<string>;
};

/** Section order is the order a teacher teaches in; it is not alphabetical. */
const PROSE_SECTIONS: [keyof LessonPlanOutput, string, keyof typeof Ionicons.glyphMap][] = [
  ['introduction', 'sectionIntroduction', 'play-outline'],
  ['mainActivity', 'sectionMainActivity', 'people-outline'],
  ['guidedPractice', 'sectionGuidedPractice', 'hand-left-outline'],
  ['independentPractice', 'sectionIndependentPractice', 'person-outline'],
  ['closure', 'sectionClosure', 'stop-circle-outline'],
  ['assessment', 'sectionAssessment', 'checkmark-done-outline'],
  ['differentiation', 'sectionDifferentiation', 'layers-outline'],
  ['homework', 'sectionHomework', 'home-outline'],
];

export function LessonPlanView({
  plan,
  colors,
  isRTL,
  t,
  accent,
  onEdit,
  editedFields,
}: Props) {
  const edited = editedFields ?? new Set<string>();
  const align = isRTL ? 'right' : 'left';

  const list = (field: 'objectives' | 'materials') =>
    onEdit ? (
      <EditableList
        items={plan[field]}
        onChange={next => onEdit(field, next)}
        colors={colors}
        isRTL={isRTL}
        placeholder={t('editPlaceholder')}
        addLabel={t('editAddItem')}
      />
    ) : (
      <>
        {plan[field].map((item, i) => (
          <View key={i} style={[styles.bulletRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.bulletDot, { backgroundColor: accent }]} />
            <MathParagraph
              text={item}
              style={{ fontSize: styles.bulletText.fontSize, lineHeight: styles.bulletText.lineHeight, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}
              containerStyle={{ flex: 1 }}
              isRTL={isRTL}
            />
          </View>
        ))}
      </>
    );

  const prose = (field: keyof LessonPlanOutput) =>
    onEdit ? (
      <EditableText
        value={String(plan[field] ?? '')}
        onChange={next => onEdit(field, next as LessonPlanOutput[typeof field])}
        colors={colors}
        isRTL={isRTL}
        placeholder={t('editPlaceholder')}
        edited={edited.has(field as string)}
      />
    ) : (
      <MathParagraph
        text={String(plan[field] ?? '')}
        style={{ fontSize: styles.bodyText.fontSize, lineHeight: styles.bodyText.lineHeight, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}
        isRTL={isRTL}
      />
    );

  return (
    <View>
      <Section title={t('sectionObjectives')} icon="flag-outline" isRTL={isRTL} colors={colors} accent={accent}>
        {list('objectives')}
      </Section>
      <Section title={t('sectionMaterials')} icon="bag-outline" isRTL={isRTL} colors={colors} accent={accent}>
        {list('materials')}
      </Section>
      {PROSE_SECTIONS.map(([field, labelKey, icon]) => (
        <Section
          key={field as string}
          title={t(labelKey)}
          icon={icon}
          isRTL={isRTL}
          colors={colors}
          accent={accent}
        >
          {prose(field)}
        </Section>
      ))}
    </View>
  );
}

function Section({
  title,
  icon,
  isRTL,
  colors,
  accent,
  children,
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
            {
              color: colors.foreground,
              fontFamily: 'Cairo_600SemiBold',
              textAlign: isRTL ? 'right' : 'left',
            },
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
  body: { borderWidth: 1, padding: 12, gap: 6 },
  bulletRow: { alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 22 },
  bodyText: { fontSize: 13.5, lineHeight: 22 },
});

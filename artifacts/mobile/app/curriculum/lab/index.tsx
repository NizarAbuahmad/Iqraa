/**
 * The Science Lab shelf — every lab item, filterable by subject and kind.
 *
 * Reached from the library's «المختبر» card. Student-reachable with no gating
 * change: `/curriculum` is already on the non-teacher allowlist and matches by
 * prefix (pinned in routeGating.test.ts). Tapping an item opens present mode.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LAB_ITEMS, filterLabItems, type LabItem, type LabItemKind } from '@workspace/curriculum/lab';
import { SUBJECTS, getVisibleGrades } from '@workspace/curriculum';
import { useAuth } from '@/context/AuthContext';
import { initialLabGrade, keepLabSubject, labGradeIds, labSubjectIds } from '@/services/labFilters';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/knowledgeBase';
import { labItemPath } from '@/services/labLinks';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import type { TranslationKey } from '@/services/i18n';

const KIND_LABEL: Record<LabItemKind, TranslationKey> = {
  interactive: 'labKindInteractive',
  law: 'labKindLaw',
  external: 'labKindExternal',
};

// The manifest is static, so the chip sets are module constants.
const VISIBLE_GRADES = getVisibleGrades();
const LAB_GRADE_IDS = labGradeIds(LAB_ITEMS, VISIBLE_GRADES.map(g => g.id));
const KINDS = [...new Set(LAB_ITEMS.map(i => i.kind))] as LabItemKind[];

const KIND_ICON: Record<LabItemKind, React.ComponentProps<typeof Ionicons>['name']> = {
  interactive: 'flask-outline',
  law: 'calculator-outline',
  external: 'open-outline',
};

type Colors = ReturnType<typeof useColors>;
type TFn = (key: TranslationKey) => string;

// Module-scope (not nested in the screen) so the React compiler can optimise
// the screen and so each row keeps its identity across re-renders.
function ItemRow({
  item,
  colors,
  isRTL,
  lang,
  t,
  gradeName,
}: {
  item: LabItem;
  colors: Colors;
  isRTL: boolean;
  lang: string;
  t: TFn;
  /** Shown only when all grades are listed, so two grades' rows can be told apart. */
  gradeName?: string;
}) {
  const surface = useSurface();
  const lesson = getLessonById(item.lessonId);
  const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : '';
  return (
    <PressableScale
      onPress={() => {
        Haptics.selectionAsync();
        router.push(labItemPath(item.id) as never);
      }}
      accessibilityRole="button"
      style={[styles.row, surface, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={KIND_ICON[item.kind]} size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.rowTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}
        >
          {lang === 'ar' ? item.titleAr : item.titleEn}
        </Text>
        <Text
          style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
        >
          {gradeName ? `${gradeName} · ` : ''}
          {t(KIND_LABEL[item.kind])}
          {lessonTitle ? ` · ${lessonTitle}` : ''}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
    </PressableScale>
  );
}

function Chip({
  label,
  on,
  onPress,
  colors,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  colors: Colors;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      aria-selected={on}
      style={[styles.chip, { backgroundColor: on ? colors.primary : colors.muted }]}
    >
      <Text
        style={{
          color: on ? colors.primaryForeground : colors.foreground,
          fontFamily: 'ReadexPro_500Medium',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function LabShelfScreen() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  // `undefined` = not chosen yet: follow the user's grade, which may arrive
  // after the first render. A tap stores a grade id or `null` (all grades).
  const [pickedGrade, setPickedGrade] = useState<string | null | undefined>(undefined);
  const gradeId = pickedGrade === undefined ? initialLabGrade(LAB_GRADE_IDS, user?.gradeIds) : pickedGrade;
  const [pickedSubject, setSubjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<LabItemKind | null>(null);

  const subjectIds = labSubjectIds(LAB_ITEMS, gradeId);
  const subjectId = keepLabSubject(pickedSubject, subjectIds);
  const shown = filterLabItems({
    gradeId: gradeId ?? undefined,
    subjectId: subjectId ?? undefined,
    kind: kind ?? undefined,
  });

  const gradeName = (id: string) => {
    const g = VISIBLE_GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };

  const subjectName = (id: string) => {
    const s = SUBJECTS.find(x => x.id === id);
    return s ? (lang === 'ar' ? s.nameAr : s.name) : id;
  };

  return (
    <CornerFrame title={t('labTitle')} subtitle={t('labIntro')}>
      {LAB_GRADE_IDS.length > 1 ? (
        <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Chip colors={colors} label={t('labAllGrades')} on={gradeId === null} onPress={() => setPickedGrade(null)} />
          {LAB_GRADE_IDS.map(id => (
            <Chip colors={colors} key={id} label={gradeName(id)} on={gradeId === id} onPress={() => setPickedGrade(id)} />
          ))}
        </View>
      ) : null}
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip colors={colors} label={t('labAllSubjects')} on={subjectId === null} onPress={() => setSubjectId(null)} />
        {subjectIds.map(id => (
          <Chip colors={colors} key={id} label={subjectName(id)} on={subjectId === id} onPress={() => setSubjectId(id)} />
        ))}
      </View>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip colors={colors} label={t('labAllKinds')} on={kind === null} onPress={() => setKind(null)} />
        {KINDS.map(k => (
          <Chip colors={colors} key={k} label={t(KIND_LABEL[k])} on={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>

      {shown.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('labEmpty')}
        </Text>
      ) : (
        <CornerGrid>
          {shown.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              colors={colors}
              isRTL={isRTL}
              lang={lang}
              t={t}
              gradeName={gradeId === null ? gradeName(item.gradeId) : undefined}
            />
          ))}
        </CornerGrid>
      )}
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  row: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', padding: 32 },
});

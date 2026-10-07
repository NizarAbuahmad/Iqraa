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
import { SUBJECTS } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/knowledgeBase';
import { labItemPath } from '@/services/labLinks';
import { LabFrame } from '@/components/lab/LabFrame';
import type { TranslationKey } from '@/services/i18n';

const KIND_LABEL: Record<LabItemKind, TranslationKey> = {
  interactive: 'labKindInteractive',
  law: 'labKindLaw',
  external: 'labKindExternal',
};

// The manifest is static, so the chip sets are module constants.
const SUBJECT_IDS = [...new Set(LAB_ITEMS.map(i => i.subjectId))];
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
}: {
  item: LabItem;
  colors: Colors;
  isRTL: boolean;
  lang: string;
  t: TFn;
}) {
  const lesson = getLessonById(item.lessonId);
  const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : '';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(labItemPath(item.id) as never);
      }}
      accessibilityRole="button"
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={KIND_ICON[item.kind]} size={22} color={colors.primary} />
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
          {t(KIND_LABEL[item.kind])}
          {lessonTitle ? ` · ${lessonTitle}` : ''}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
    </Pressable>
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
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<LabItemKind | null>(null);

  const shown = filterLabItems({ subjectId: subjectId ?? undefined, kind: kind ?? undefined });

  const subjectName = (id: string) => {
    const s = SUBJECTS.find(x => x.id === id);
    return s ? (lang === 'ar' ? s.nameAr : s.name) : id;
  };

  return (
    <LabFrame title={t('labTitle')} subtitle={t('labIntro')}>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip colors={colors} label={t('labAllSubjects')} on={subjectId === null} onPress={() => setSubjectId(null)} />
        {SUBJECT_IDS.map(id => (
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
        shown.map(item => <ItemRow key={item.id} item={item} colors={colors} isRTL={isRTL} lang={lang} t={t} />)
      )}
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  row: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', padding: 32 },
});

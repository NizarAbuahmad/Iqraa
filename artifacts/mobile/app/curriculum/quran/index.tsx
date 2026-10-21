/**
 * The Quran Corner — the surahs the Islamic Education books assign, grouped by
 * the first grade that assigns them, and a shelf of outside resources.
 *
 * Reached from the library's «ركن القرآن» card. Student-reachable with no gating
 * change: `/curriculum` is on the non-teacher allowlist and matches by prefix
 * (pinned in routeGating.test.ts).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GRADES } from '@workspace/curriculum';
import {
  QURAN_SURAHS,
  groupSurahsByGrade,
  isWholeSurah,
  segmentsText,
  type QuranSurah,
} from '@workspace/curriculum/quran';
import { QURAN_RESOURCES, type QuranResource, type QuranResourceKind } from '@workspace/curriculum/quran-resources';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { countMemorised, type QuranProgress } from '@/services/quranProgress';
import { openExternal } from '@/services/externalLinks';
import { surahPath } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { QuranGate } from '@/components/quran/QuranGate';
import type { TranslationKey } from '@/services/i18n';

type Colors = ReturnType<typeof useColors>;
type TFn = (key: TranslationKey) => string;

const KIND_LABEL: Record<QuranResourceKind, TranslationKey> = {
  reader: 'quranKindReader',
  audio: 'quranKindAudio',
  tajweed: 'quranKindTajweed',
  tafsir: 'quranKindTafsir',
  text: 'quranKindText',
};

// The data is static, so the grouping is a module constant.
const GROUPS = groupSurahsByGrade(QURAN_SURAHS);

function SurahRow({
  surah,
  progress,
  colors,
  isRTL,
  lang,
  t,
}: {
  surah: QuranSurah;
  progress: QuranProgress;
  colors: Colors;
  isRTL: boolean;
  lang: string;
  t: TFn;
}) {
  const digits = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);
  const done = countMemorised(progress, surah.number, surah.ayahs.map(a => a.n));
  const where = isWholeSurah(surah)
    ? t('quranWholeSurah')
    : `${t('quranAyahsLabel')} ${digits(segmentsText(surah.segments, lang === 'ar' ? '، ' : ', '))}`;
  const align = isRTL ? 'right' : 'left';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(surahPath(surah.number) as never);
      }}
      accessibilityRole="button"
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="book-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        {/* The surah name is Arabic whatever the interface language. */}
        <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {surah.nameAr}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {where}
          {done > 0 ? ` · ${t('quranMemorisedLabel')} ${digits(`${done} / ${surah.ayahs.length}`)}` : ''}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ResourceRow({
  item,
  colors,
  isRTL,
  t,
}: {
  item: QuranResource;
  colors: Colors;
  isRTL: boolean;
  t: TFn;
}) {
  const align = isRTL ? 'right' : 'left';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        void openExternal(item.url);
      }}
      accessibilityRole="link"
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="open-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {item.provider}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {t(KIND_LABEL[item.kind])} · {new URL(item.url).host}
        </Text>
        {item.urlCheckedAt === null ? (
          <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
            {t('quranLinkUnchecked')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function QuranCorner() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress } = useQuranProgress();
  const align = isRTL ? 'right' : 'left';

  const gradeName = (id: string) => {
    const g = GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };

  return (
    <CornerFrame title={t('quranTitle')} subtitle={t('quranIntro')}>
      {GROUPS.map(group => (
        <View key={group.gradeId}>
          <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {gradeName(group.gradeId)}
          </Text>
          <CornerGrid>
            {group.surahs.map(s => (
              <SurahRow key={s.number} surah={s} progress={progress} colors={colors} isRTL={isRTL} lang={lang} t={t} />
            ))}
          </CornerGrid>
        </View>
      ))}

      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranResourcesTitle')}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranResourcesNote')}
      </Text>
      <CornerGrid>
        {QURAN_RESOURCES.map(r => (
          <ResourceRow key={r.id} item={r} colors={colors} isRTL={isRTL} t={t} />
        ))}
      </CornerGrid>
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: TYPE.bodyLg, marginTop: SPACE.md, marginHorizontal: 16 },
  note: { fontSize: TYPE.caption, marginTop: 4, marginHorizontal: 16 },
  row: {
    alignItems: 'center',
    gap: 12,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: TYPE.caption, marginTop: 2 },
});

export default function QuranCornerScreen() {
  return (
    <QuranGate>
      <QuranCorner />
    </QuranGate>
  );
}

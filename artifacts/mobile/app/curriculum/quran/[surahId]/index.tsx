/**
 * The reader — one surah, only the ayahs the books assign. The text is shown
 * exactly as the source has it, always right-to-left in the Quran font. Where
 * the assigned ayahs do not touch (البقرة 143–144, then 183–186) a «…» stands
 * between them and every ayah keeps its number, so a gap is never read as
 * continuous. The URL param is untrusted: it resolves through
 * `resolveSurahParam` or the screen says it could not find the surah.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GRADES } from '@workspace/curriculum';
import { QURAN_CORNER, isWholeSurah, segmentsText } from '@workspace/curriculum/quran';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { stateOf } from '@/services/quranProgress';
import { getLessonById } from '@/services/knowledgeBase';
import { openExternal } from '@/services/externalLinks';
import { memorizePath, resolveSurahParam } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { LabFrame } from '@/components/lab/LabFrame';

export default function QuranReaderScreen() {
  const { surahId } = useLocalSearchParams<{ surahId: string }>();
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress } = useQuranProgress();
  const align = isRTL ? 'right' : 'left';
  const digits = (s: string | number) => (lang === 'ar' ? toArabicDigits(String(s)) : String(s));

  const surah = resolveSurahParam(surahId);
  if (!surah) {
    return (
      <LabFrame title={t('quranTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('quranNotFound')}
        </Text>
      </LabFrame>
    );
  }

  const gradeName = (id: string) => {
    const g = GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };
  const sep = lang === 'ar' ? '، ' : ', ';
  const subtitle = isWholeSurah(surah)
    ? t('quranWholeSurah')
    : `${t('quranAyahsLabel')} ${digits(segmentsText(surah.segments, sep))}`;

  return (
    <LabFrame title={surah.nameAr} subtitle={subtitle}>
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push(memorizePath(surah.number) as never);
          }}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="school-outline" size={18} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
            {t('quranMemorize')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.text}>
        {surah.ayahs.map((a, i) => {
          const prev = surah.ayahs[i - 1];
          const gap = prev !== undefined && a.n !== prev.n + 1;
          const memorised = stateOf(progress, surah.number, a.n) === 'memorised';
          return (
            <React.Fragment key={a.n}>
              {gap ? (
                <Text style={[styles.gap, { color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>…</Text>
              ) : null}
              {/* Fixed row-reverse: the Quran reads right to left in every interface language. */}
              <View style={[styles.ayah, { borderColor: colors.border, flexDirection: 'row-reverse' }]}>
                <View style={[styles.badge, { backgroundColor: memorised ? colors.primary : colors.muted }]}>
                  <Text
                    style={{
                      color: memorised ? colors.primaryForeground : colors.foreground,
                      fontFamily: 'ReadexPro_500Medium',
                      fontSize: TYPE.caption,
                    }}
                  >
                    {digits(a.n)}
                  </Text>
                </View>
                <Text style={[styles.quran, { color: colors.foreground }]}>{a.text}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranLessonsTitle')}
      </Text>
      {surah.lessons.map(l => {
        const lesson = getLessonById(l.lessonId);
        const title = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : l.lessonId;
        return (
          <Pressable
            key={l.lessonId}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/curriculum/lesson-detail', params: { lessonId: l.lessonId } } as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('quranOpenLesson')}: ${title}`}
            style={[
              styles.lesson,
              { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}>
                {title}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                {gradeName(l.gradeId)} · {t('quranAyahsLabel')} {digits(segmentsText([{ from: l.from, to: l.to }]))}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
          </Pressable>
        );
      })}

      <View style={[styles.source, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
          {t('quranSourceTitle')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align, marginTop: 4 }}>
          {t('quranSourceBody')}
        </Text>
        <Pressable
          onPress={() => void openExternal(QURAN_CORNER.source.url)}
          accessibilityRole="link"
          style={{ marginTop: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
        >
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
            {t('quranSourceLink')} · github.com/quran-ws/quran-text
          </Text>
        </Pressable>
        <Text selectable style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, textAlign: 'left', writingDirection: 'ltr' }}>
          {QURAN_CORNER.notice}
        </Text>
        <Text selectable style={{ color: colors.mutedForeground, fontSize: 11, marginTop: SPACE.sm, textAlign: 'left', writingDirection: 'ltr' }}>
          {`${QURAN_CORNER.source.version} · sha256 ${QURAN_CORNER.source.sha256.slice(0, 12)}`}
        </Text>
      </View>
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  actions: { paddingHorizontal: 16, paddingTop: 16 },
  primary: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: SPACE.md, borderRadius: 999 },
  text: { marginTop: 8 },
  ayah: {
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: { minWidth: 28, height: 28, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.sm },
  quran: {
    flex: 1,
    fontFamily: 'UthmanicHafs',
    fontSize: 28,
    lineHeight: 58,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  gap: { textAlign: 'center', fontSize: TYPE.title, marginTop: 8 },
  heading: { fontSize: TYPE.bodyLg, marginTop: 24, marginHorizontal: 16 },
  lesson: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  source: { margin: 16, marginTop: 24, padding: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1 },
});

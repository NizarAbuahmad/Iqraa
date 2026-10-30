/**
 * Public games hub — no login. The link is the identity, same idea as
 * app/take/[code].tsx: this is meant to be shared and opened cold, which is
 * why `/play` is in routeGating.ts's PUBLIC_ROUTES.
 *
 * Every game funnels back here, and every game-over screen offers the
 * teacher-signup CTA (see GameShell) — this hub is the top of that funnel.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import type { TranslationKey } from '@/services/i18n';
import { CORNERS } from '@/constants/corners';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { PLAY_GAME_GRADES, gradeBandLabel, type PlayGameId } from '@/services/publicGames/gradeBands';
import { readableOn } from '@/services/readableColor';
import { ELEMENTS_ACCENT } from '@/components/publicGames/ElementsGame';
import { ChipGroup } from '@/components/generator/ChipGroup';
import { SPACE, TYPE } from '@/constants/theme';
import {
  NO_FILTER, PLAY_FILTER_GRADES, PLAY_SUBJECTS, filterGames, hubFilterParams, parseHubFilter,
  type HubFilter, type PlaySubject,
} from '@/services/publicGames/hubFilter';

const SUBJECT_LABEL: Record<PlaySubject, TranslationKey> = {
  math: 'playSubjectMath',
  arabic: 'playSubjectArabic',
  english: 'playSubjectEnglish',
  science: 'playSubjectScience',
  geography: 'playSubjectGeography',
  skills: 'playSubjectSkills',
};

/** The chips' ids: 'all' clears that row, anything else is the subject or the grade itself. */
const ALL = 'all';

const GAMES: Array<{
  id: PlayGameId;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  // First: it's the one game built from the students' own books.
  // The English corner's own colour, as on the library tile.
  { id: 'english', route: '/curriculum/english', icon: 'headset-outline', color: CORNERS.english.light.primary, titleKey: 'hubTitle', descKey: 'playEnglishDesc' },
  // Second: the hub's science game, from the G7–10 science/chemistry books.
  { id: 'elements', route: '/play/elements', icon: 'flask-outline', color: ELEMENTS_ACCENT, titleKey: 'playElementsTitle', descKey: 'playElementsDesc' },
  { id: 'flags', route: '/play/flags', icon: 'flag-outline', color: '#1D4ED8', titleKey: 'playFlagsTitle', descKey: 'playFlagsDesc' },
  { id: 'capitals', route: '/play/capitals', icon: 'location-outline', color: '#0B7F77', titleKey: 'playCapitalsTitle', descKey: 'playCapitalsDesc' },
  { id: 'memory', route: '/play/memory', icon: 'apps-outline', color: '#0369A1', titleKey: 'playMemoryTitle', descKey: 'playMemoryDesc' },
  { id: 'colors', route: '/play/colors', icon: 'color-palette-outline', color: '#DB2777', titleKey: 'playColorsTitle', descKey: 'playColorsDesc' },
  { id: 'multiply', route: '/play/multiply', icon: 'calculator-outline', color: '#166534', titleKey: 'playMultiplyTitle', descKey: 'playMultiplyDesc' },
  { id: 'divide', route: '/play/divide', icon: 'pie-chart-outline', color: '#7C3AED', titleKey: 'playDivideTitle', descKey: 'playDivideDesc' },
  { id: 'add', route: '/play/add', icon: 'add-circle-outline', color: '#4338CA', titleKey: 'playAddTitle', descKey: 'playAddDesc' },
  { id: 'subtract', route: '/play/subtract', icon: 'remove-circle-outline', color: '#BE123C', titleKey: 'playSubtractTitle', descKey: 'playSubtractDesc' },
  { id: 'antonyms', route: '/play/antonyms', icon: 'swap-horizontal-outline', color: '#A21CAF', titleKey: 'playAntonymsTitle', descKey: 'playAntonymsDesc' },
  { id: 'plurals', route: '/play/plurals', icon: 'copy-outline', color: '#334155', titleKey: 'playPluralsTitle', descKey: 'playPluralsDesc' },
  { id: 'numberType', route: '/play/numberType', icon: 'keypad-outline', color: '#4D7C0F', titleKey: 'playNumberTypeTitle', descKey: 'playNumberTypeDesc' },
  { id: 'fractions', route: '/play/fractions', icon: 'contrast-outline', color: '#B91C1C', titleKey: 'playFractionsTitle', descKey: 'playFractionsDesc' },
  { id: 'matter', route: '/play/matter', icon: 'water-outline', color: '#0E7490', titleKey: 'playMatterTitle', descKey: 'playMatterDesc' },
  { id: 'governorates', route: '/play/governorates', icon: 'map-outline', color: '#1E3A8A', titleKey: 'playGovernoratesTitle', descKey: 'playGovernoratesDesc' },
];

export default function PlayHubScreen() {
  const colors = useColors();
  const surface = useSurface();
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  // The filter lives in the URL (`/play?subject=math&grade=5`) so a teacher can share a filtered hub, and is
  // read once: after that the chips own it and mirror every change back with setParams.
  const params = useLocalSearchParams<{ subject?: string; grade?: string }>();
  const [filter, setFilter] = useState<HubFilter>(() => parseHubFilter(params));
  const change = useCallback((next: HubFilter) => {
    setFilter(next);
    router.setParams(hubFilterParams(next));
  }, []);
  const shown = useMemo(() => filterGames(GAMES, filter), [filter]);

  const subjectOptions = [
    { id: ALL, label: t('playFilterAll') },
    ...PLAY_SUBJECTS.map(s => ({ id: s as string, label: t(SUBJECT_LABEL[s]) })),
  ];
  const gradeOptions = [
    { id: ALL, label: t('playFilterAll') },
    ...PLAY_FILTER_GRADES.map(g => ({ id: String(g), label: String(g) })),
  ];

  return (
    <CornerFrame title={t('playHubTitle')} subtitle={t('playHubSubtitle')} hideBack>
      <View style={styles.filters}>
        <ChipGroup
          label={t('playFilterSubject')}
          options={subjectOptions}
          selected={new Set([filter.subject ?? ALL])}
          onToggle={id => change({ ...filter, subject: id === ALL ? null : (id as PlaySubject) })}
          single
          accent={colors.primary}
        />
        <ChipGroup
          label={t('playFilterGrade')}
          options={gradeOptions}
          selected={new Set([filter.grade === null ? ALL : String(filter.grade)])}
          onToggle={id => change({ ...filter, grade: id === ALL ? null : Number(id) })}
          single
          accent={colors.primary}
        />
        <Text
          aria-live="polite"
          style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: lang === 'ar' ? 'right' : 'left' }}
        >
          {t('playFilterCount', shown.length)}
        </Text>
      </View>

      {shown.length === 0 ? (
        <View style={[styles.emptyCard, surface]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 23, textAlign: 'center' }}>
            {t('playFilterEmpty')}
          </Text>
          <Button label={t('playFilterClear')} variant="secondary" onPress={() => change(NO_FILTER)} />
        </View>
      ) : null}

      <View style={styles.grid}>
        {shown.map((g, i) => (
          <Entrance key={g.id} index={i} style={styles.cell}>
            <PressableScale
              onPress={() => router.push(g.route as any)}
              style={[styles.card, surface]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${g.color}1a` }]}>
                <Ionicons name={g.icon} size={24} color={readableOn(g.color, colors.card, 3)} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: 'center' }}>
                {t(g.titleKey)}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: 'center' }}>
                {t(g.descKey)}
              </Text>
              <View style={[styles.gradeChip, { backgroundColor: `${g.color}14` }]}>
                <Ionicons name="school-outline" size={14} color={readableOn(g.color, colors.card)} />
                <Text style={{ color: readableOn(g.color, colors.card), fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>
                  {gradeBandLabel(PLAY_GAME_GRADES[g.id], lang)}
                </Text>
              </View>
            </PressableScale>
          </Entrance>
        ))}
      </View>

      {!user && (
        <View style={[styles.ctaCard, surface]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: 'center' }}>
            {t('playCtaHeading')}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 23 }}>
            {t('playCtaBody')}
          </Text>
          <Button
            label={t('playCtaButton')}
            onPress={() => router.push('/(auth)/register')}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl, gap: SPACE.md },
  emptyCard: { marginHorizontal: SPACE.xl, marginTop: SPACE.lg, padding: SPACE.xl, gap: SPACE.md, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 20 },
  cell: { flexBasis: '46%', flexGrow: 1 },
  card: { flexGrow: 1, padding: 18, gap: 8, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 'auto' },
  ctaCard: { marginHorizontal: 20, padding: 20, gap: 10 },
});

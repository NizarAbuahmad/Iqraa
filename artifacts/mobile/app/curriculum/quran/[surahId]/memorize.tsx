/**
 * Memorise — one ayah at a time. The learner picks how much to hide, taps a
 * hidden word to check themselves, then rates the ayah. The rating is THEIR
 * OWN: the app does not hear a recitation and says so on screen. Hiding never
 * changes the text underneath (`quranMemorize.ts` tests the round trip).
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { QuranSurah } from '@workspace/curriculum/quran';
import { HIDE_LEVELS, hiddenFlags, tokenizeAyah, type HideLevel } from '@workspace/curriculum/quran-memorize';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { useQuranFont } from '@/hooks/useQuranFont';
import { countMemorised, stateOf, type AyahState } from '@/services/quranProgress';
import { resolveSurahParam } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { LabFrame } from '@/components/lab/LabFrame';
import type { TranslationKey } from '@/services/i18n';

const LEVEL_LABEL: Record<HideLevel, TranslationKey> = {
  none: 'quranLevelNone',
  every3: 'quranLevelEvery3',
  every2: 'quranLevelEvery2',
  secondHalf: 'quranLevelSecondHalf',
  firstWordHint: 'quranLevelFirstWordHint',
  all: 'quranLevelAll',
};

const STATE_LABEL: Record<AyahState, TranslationKey> = {
  new: 'quranStatusNew',
  learning: 'quranStatusLearning',
  memorised: 'quranStatusMemorised',
};

type Colors = ReturnType<typeof useColors>;

function Chip({ label, on, onPress, colors }: { label: string; on: boolean; onPress: () => void; colors: Colors }) {
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
      <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Memorize({ surah }: { surah: QuranSurah }) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress, loaded, rate } = useQuranProgress();
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState<HideLevel>('every3');
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [repeats, setRepeats] = useState(0);
  const align = isRTL ? 'right' : 'left';
  const digits = (v: string | number) => (lang === 'ar' ? toArabicDigits(String(v)) : String(v));

  const ayah = surah.ayahs[index]!;
  const words = useMemo(() => tokenizeAyah(ayah.text), [ayah.text]);
  const hidden = useMemo(() => hiddenFlags(words.length, level), [words.length, level]);
  const state = stateOf(progress, surah.number, ayah.n);
  const done = countMemorised(progress, surah.number, surah.ayahs.map(a => a.n));

  const goTo = (i: number) => {
    setIndex(i);
    setRevealed(new Set());
    setRepeats(0);
  };
  const pickLevel = (l: HideLevel) => {
    setLevel(l);
    setRevealed(new Set());
  };
  const toggle = (i: number) =>
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const showAll = () => setRevealed(new Set(hidden.flatMap((h, i) => (h ? [i] : []))));
  const anyHidden = hidden.some(Boolean);
  const allShown = hidden.every((h, i) => !h || revealed.has(i));

  const subtitle = `${digits(`${index + 1} / ${surah.ayahs.length}`)} · ${t('quranMemorisedLabel')} ${digits(`${done} / ${surah.ayahs.length}`)}`;
  const rateBtn = (label: string, status: 'learning' | 'memorised' | null, active: boolean) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        rate(surah.number, ayah.n, status);
      }}
      disabled={!loaded}
      accessibilityRole="button"
      aria-selected={active}
      style={[styles.rate, { backgroundColor: active ? colors.primary : colors.muted, opacity: loaded ? 1 : 0.5 }]}
    >
      <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <LabFrame title={surah.nameAr} subtitle={subtitle}>
      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranLevelTitle')}
      </Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {HIDE_LEVELS.map(l => (
          <Chip key={l} colors={colors} label={t(LEVEL_LABEL[l])} on={level === l} onPress={() => pickLevel(l)} />
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: align }}>
          {t('quranAyahsLabel')} {digits(ayah.n)} · {t(STATE_LABEL[state])}
        </Text>
        {/* Fixed row-reverse: the Quran reads right to left in every interface language. */}
        <View style={[styles.words, { flexDirection: 'row-reverse' }]}>
          {words.map((w, i) => {
            const covered = hidden[i]! && !revealed.has(i);
            return (
              <Pressable
                key={i}
                disabled={!hidden[i]}
                onPress={() => toggle(i)}
                accessibilityRole="button"
                accessibilityLabel={covered ? t('quranTapToReveal') : undefined}
                style={covered ? [styles.cover, { backgroundColor: colors.muted }] : undefined}
              >
                <Text style={[styles.quran, { color: colors.foreground, opacity: covered ? 0 : 1 }]}>{w}</Text>
              </Pressable>
            );
          })}
        </View>
        {anyHidden ? (
          <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, flex: 1, textAlign: align }}>
              {t('quranTapToReveal')}
            </Text>
            <Chip
              colors={colors}
              label={allShown ? t('quranHideAgain') : t('quranShowAll')}
              on={false}
              onPress={() => (allShown ? setRevealed(new Set()) : showAll())}
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16 }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, flex: 1, textAlign: align }}>
          {t('quranRepeat')}: {digits(repeats)}
        </Text>
        <Chip colors={colors} label={t('quranRepeatBtn')} on={false} onPress={() => setRepeats(r => r + 1)} />
      </View>

      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {rateBtn(t('quranRateMemorised'), 'memorised', state === 'memorised')}
        {rateBtn(t('quranRateLearning'), 'learning', state === 'learning')}
        {state !== 'new' ? rateBtn(t('quranRateClear'), null, false) : null}
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranSelfRated')}
      </Text>

      <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, marginTop: 16 }]}>
        <Chip
          colors={colors}
          label={t('quranPrevAyah')}
          on={false}
          onPress={() => index > 0 && goTo(index - 1)}
        />
        <View style={{ flex: 1 }} />
        <Chip
          colors={colors}
          label={t('quranNextAyah')}
          on={false}
          onPress={() => index < surah.ayahs.length - 1 && goTo(index + 1)}
        />
      </View>
    </LabFrame>
  );
}

export default function QuranMemorizeScreen() {
  const { surahId } = useLocalSearchParams<{ surahId: string }>();
  const colors = useColors();
  const { t } = useLanguage();
  const fontReady = useQuranFont();
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
  if (!fontReady) {
    return (
      <LabFrame title={t('quranTitle')}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.xl }} />
      </LabFrame>
    );
  }
  // keyed by surah so a param change on a mounted screen restarts at the first ayah
  return <Memorize key={surah.number} surah={surah} />;
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  heading: { fontSize: 14, marginTop: 16, marginHorizontal: 16 },
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: SPACE.md },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: 8, borderRadius: 999 },
  rate: { paddingHorizontal: 16, paddingVertical: SPACE.md, borderRadius: 999 },
  card: { margin: 16, padding: 16, borderRadius: RADIUS.md, borderWidth: 1, gap: 12 },
  words: { flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  cover: { borderRadius: 8 },
  quran: { fontFamily: 'UthmanicHafs', fontSize: TYPE.display, lineHeight: 58, writingDirection: 'rtl' },
  rowEnd: { alignItems: 'center', gap: 12 },
  note: { fontSize: TYPE.caption, marginTop: SPACE.md, marginHorizontal: 16 },
});

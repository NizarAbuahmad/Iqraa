/**
 * Evaluations list — the entry point to authoring.
 *
 * Mirrors `app/classes/index.tsx`: the server is the only source of truth,
 * `useFocusEffect` refreshes on every return to the screen (e.g. right after
 * publishing), and a failed load says so rather than showing an empty list
 * that looks like "no evaluations yet".
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { EvaluationError, listEvaluations, type Evaluation } from '@/services/evaluations';
import { bookLabel, formatListDate } from '@/services/evaluationRow';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';

const ACCENT = '#007C74';

const STATUS_KEY: Record<Evaluation['status'], TranslationKey> = {
  draft: 'evalStatusDraft',
  published: 'evalStatusPublished',
  closed: 'evalStatusClosed',
};
const STATUS_COLOR: Record<Evaluation['status'], string> = {
  draft: '#B54708',
  published: '#067647',
  closed: '#6B7280',
};

export default function EvaluationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const describe = useCallback(
    (err: unknown): string => {
      if (err instanceof EvaluationError && err.status > 0 && err.status < 500) return err.message;
      return t('evaluationLoadFailed');
    },
    [t],
  );

  const load = useCallback(async () => {
    setError('');
    try {
      setEvaluations(await listEvaluations());
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, [describe]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // On a phone this list is the only thing on screen, so a full-bleed color
  // band and a thumb-reach floating button read as a normal app header and
  // primary action. Stretched across a desktop window the same band becomes a
  // flat strip of color and the floating circle looks like a stray control —
  // there the sidebar already supplies navigation chrome, so the header here
  // just needs a title and an inline action, like the rest of the page.
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const numColumns = isDesktop ? 3 : 1;
  const centered = { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };

  const backButton = (
    <Pressable
      onPress={() => goBack()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('back')}
      style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
    >
      <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={isDesktop ? colors.foreground : '#fff'} />
    </Pressable>
  );

  const header = isDesktop ? (
    <View style={[styles.deskHeader, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }, centered]}>
      <View style={{ gap: 4 }}>
        {backButton}
        <Text style={[styles.deskTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('myEvaluations')}
        </Text>
        <Text style={[styles.deskSub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('evaluationsSubtitle')}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/evaluations/new')}
        style={[styles.deskNewBtn, { backgroundColor: ACCENT }]}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>{t('newEvaluation')}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
      {backButton}
      <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
        {t('myEvaluations')}
      </Text>
      <Text
        style={[
          styles.heroSub,
          { fontFamily: 'Almarai_400Regular', textAlign: align, color: 'rgba(255,255,255,0.85)' },
        ]}
      >
        {t('evaluationsSubtitle')}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={evaluations}
          keyExtractor={e => e.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
          contentContainerStyle={[{ padding: 20, paddingBottom: 100, gap: 12 }, centered]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                  {error}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="clipboard-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                  {t('noEvaluationsYet')}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
                  ]}
                >
                  {t('noEvaluationsDesc')}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/evaluations/[id]', params: { id: item.id } })}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, numColumns > 1 && { flex: 1 }]}
            >
              <View style={{ flex: 1 }}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text
                    style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}
                    numberOfLines={1}
                  >
                    {(lang === 'ar' ? item.titleAr : item.title) || t('newEvaluation')}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                    <Text style={{ color: STATUS_COLOR[item.status], fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>
                      {t(STATUS_KEY[item.status])}
                    </Text>
                  </View>
                </View>
                {/* What the row was missing: which exam this actually is.
                    Book and date both come back on every list row and were
                    simply not rendered, which is how seven exams came to look
                    like four copies of «تقييم جديد». Either may be absent, so
                    the separator is built from what survived rather than
                    printed unconditionally. */}
                {(() => {
                  const scope = [bookLabel(item.bookId, lang), formatListDate(item.createdAt, lang)]
                    .filter(Boolean)
                    .join(' · ');
                  return scope ? (
                    <Text
                      style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
                      numberOfLines={1}
                    >
                      {scope}
                    </Text>
                  ) : null;
                })()}
                <Text style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                  {[
                    t('evalTotalMarks', item.totalMarks),
                    // `questionCount` is what the paper holds; the list
                    // endpoint does not return targetQuestionCount, so
                    // reading that here would print "undefined".
                    typeof item.questionCount === 'number' ? t('evalRowQuestions', item.questionCount) : null,
                    // Marking progress is only a question once an exam is out
                    // in front of students — on a draft it would always read
                    // zero and mean nothing.
                    item.status === 'published'
                      ? item.markedCount
                        ? t('evalRowMarked', item.markedCount)
                        : t('evalRowNoneMarked')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}

      {/* Desktop gets the inline header button above instead — a floating
          circle only makes sense within thumb reach of a phone screen. */}
      {isDesktop ? null : (
        <Pressable
          onPress={() => router.push('/evaluations/new')}
          style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  heroTitle: { fontSize: 26, color: '#fff' },
  heroSub: { fontSize: 13, lineHeight: 21 },
  deskHeader: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  deskTitle: { fontSize: 26, marginTop: 8 },
  deskSub: { fontSize: 14, lineHeight: 22 },
  deskNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  cardTop: { alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, flex: 1 },
  cardMeta: { fontSize: 13, lineHeight: 21, marginTop: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17 },
  emptyText: { fontSize: 14, maxWidth: 280, lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  fab: { position: 'absolute', alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

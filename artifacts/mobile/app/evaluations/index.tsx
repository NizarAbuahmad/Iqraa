/**
 * Evaluations list — the entry point to authoring.
 *
 * Mirrors `app/classes/index.tsx`: the server is the only source of truth,
 * `useFocusEffect` refreshes on every return to the screen (e.g. right after
 * publishing), and a failed load says so rather than showing an empty list
 * that looks like "no evaluations yet".
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { EvaluationError, listEvaluations, type Evaluation } from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

const STATUS_KEY: Record<Evaluation['status'], TranslationKey> = {
  draft: 'evalStatusDraft',
  published: 'evalStatusPublished',
  closed: 'evalStatusClosed',
};
const STATUS_COLOR: Record<Evaluation['status'], string> = {
  draft: '#F59E0B',
  published: '#10B981',
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={evaluations}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
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
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                <Text style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                  {t('evalTotalMarks', item.totalMarks)}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/evaluations/new')}
        style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  heroTitle: { fontSize: 26, color: '#fff' },
  heroSub: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  cardTop: { alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, flex: 1 },
  cardMeta: { fontSize: 13, marginTop: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17 },
  emptyText: { fontSize: 14, maxWidth: 280, lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  fab: { position: 'absolute', alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

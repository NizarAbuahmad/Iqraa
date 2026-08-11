import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  buildGeneratorNav,
  getRelatedToolIds,
  getToolById,
  type HomeToolId,
} from '@/services/homeAiTools';

type Props = {
  /** Tool that was just generated */
  toolId?: HomeToolId | string;
  topic: string;
  isRTL?: boolean;
};

/**
 * Post-generation recommendations — keep teachers creating related materials.
 */
export function RelatedResourcesPanel({ toolId = 'lesson-plan', topic, isRTL }: Props) {
  const colors = useColors();
  const { t, lang, isRTL: ctxRtl } = useLanguage();
  const rtl = isRTL ?? ctxRtl;
  const related = getRelatedToolIds(toolId);

  const openTool = (id: HomeToolId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nav = buildGeneratorNav(id, topic, lang);
    router.push({ pathname: nav.pathname as any, params: nav.params });
  };

  const createAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (related.length === 0) return;
    openTool(related[0]);
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        style={[
          styles.done,
          { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: rtl ? 'right' : 'left' },
        ]}
      >
        {toolId === 'lesson-plan'
          ? (lang === 'ar' ? '✅ خطة الدرس جاهزة.' : '✅ Lesson plan created.')
          : t('relatedResourcesDone')}
      </Text>
      <Text
        style={[
          styles.hint,
          { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: rtl ? 'right' : 'left' },
        ]}
      >
        {t('relatedResourcesHint')}
      </Text>

      <View style={[styles.grid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {related.map(id => {
          const tool = getToolById(id);
          const label = lang === 'ar' ? tool.labelAr : tool.labelEn;
          return (
            <Pressable
              key={id}
              onPress={() => openTool(id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'Cairo_500Medium' }]}>
                {tool.emoji} {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={createAll}
        style={({ pressed }) => [
          styles.createAll,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
            flexDirection: rtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Text style={[styles.createAllText, { fontFamily: 'Cairo_600SemiBold' }]}>
          {t('relatedCreateAll')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  done: { fontSize: 15 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 2 },
  grid: { flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  createAll: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  createAllText: { color: '#fff', fontSize: 14 },
});

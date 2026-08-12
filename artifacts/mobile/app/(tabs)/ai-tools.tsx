import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { DEMO_MODE } from '@/services/ai/demoMode';
import { DemoModeBanner } from '@/components/ui/DemoModeBanner';
import { openGeogebraGraphing } from '@/services/geogebra';
import { getPickerSubjects } from '@/services/curriculumData';
import { loadLessonPick } from '@/services/lessonContext';
import {
  AFTER_CLASS,
  BEFORE_CLASS,
  DURING_CLASS,
  MORE_TOOLS,
  WORKFLOW,
  type ToolDef,
} from '@/services/toolCatalog';


async function runToolAction(tool: ToolDef) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (tool.externalAction === 'geogebra-graphing') {
    await openGeogebraGraphing();
    return;
  }
  if (tool.route) {
    // Prefill from the global "current lesson" so a tool opened from the hub
    // already knows the teacher's context (set on home / in chat). Explicit
    // routeParams always win; the teacher can still change it in the tool —
    // that change stays local to the material being generated.
    const pick = await loadLessonPick();
    const prefill: Record<string, string> = {};
    if (pick?.topic && !tool.routeParams?.topic) {
      prefill.topic = pick.topic;
      if (pick.subjectId) {
        const idx = getPickerSubjects().findIndex(s => s.id === pick.subjectId);
        if (idx >= 0) prefill.subjectIdx = String(idx);
      }
    }
    router.push({ pathname: tool.route as any, params: { ...prefill, ...tool.routeParams } });
  }
}

function ToolCard({
  tool,
  isRTL,
  colors,
  t,
  compact,
}: {
  tool: ToolDef;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: any) => string;
  compact?: boolean;
}) {
  const isExternal = !!tool.externalAction;
  return (
    <Pressable
      onPress={() => { void runToolAction(tool); }}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.8 : 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View style={[
        styles.iconWrap,
        compact && styles.iconWrapCompact,
        { backgroundColor: tool.color + '1A', borderRadius: 14 },
      ]}>
        <Ionicons name={tool.icon} size={compact ? 22 : 28} color={tool.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: compact ? 14 : 15 }]}>
            {t(tool.titleKey as any)}
          </Text>
          {tool.badgeKey && (
            <View style={[styles.badge, { backgroundColor: tool.color + '22' }]}>
              <Text style={[styles.badgeText, { color: tool.color, fontFamily: 'Cairo_600SemiBold' }]}>
                {t(tool.badgeKey as any)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
          numberOfLines={compact ? 2 : 3}
        >
          {t(tool.descKey as any)}
        </Text>
      </View>
      <Ionicons
        name={isExternal ? 'open-outline' : (isRTL ? 'chevron-back' : 'chevron-forward')}
        size={18}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

export default function AIToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiTools')}
        </Text>
        {DEMO_MODE ? (
          <DemoModeBanner isRTL={isRTL} />
        ) : (
          <View style={[styles.aiBadge, { backgroundColor: colors.primary + '18', borderRadius: 20, alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={[styles.aiBadgeText, { color: colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('poweredByAI')}
            </Text>
          </View>
        )}
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiToolsSubtitle')}
        </Text>
      </View>

      {WORKFLOW.map(section => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t(section.titleKey as any)}
          </Text>
          <View style={styles.list}>
            {section.tools.map(tool => (
              <ToolCard key={tool.id} tool={tool} isRTL={isRTL} colors={colors} t={t} />
            ))}
          </View>
        </View>
      ))}

      {/* More tools — secondary, collapsed by default */}
      <View style={styles.section}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setMoreOpen(v => !v);
          }}
          style={[styles.moreHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', marginBottom: 0 }]}>
            {t('toolsMoreTitle')}
          </Text>
          <Ionicons
            name={moreOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
        {moreOpen && (
          <>
            <Text style={[styles.moreHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('toolsMoreHint')}
            </Text>
            <View style={styles.list}>
              {MORE_TOOLS.map(tool => (
                <ToolCard key={tool.id} tool={tool} isRTL={isRTL} colors={colors} t={t} compact />
              ))}
            </View>
          </>
        )}
      </View>

      {/*
        The retired home screen. It is still the only way to attach media to a
        lesson and to reach Smart Templates, so it stays reachable — here, among
        the tools, rather than in the account settings where it used to sit.
      */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/home'); }}
        style={({ pressed }) => [
          styles.workspaceCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            marginHorizontal: 20,
            marginBottom: 12,
            opacity: pressed ? 0.8 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <View style={[styles.workspaceIcon, { backgroundColor: '#6366F1' + '18', borderRadius: 12 }]}>
          <Ionicons name="grid-outline" size={22} color="#6366F1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('moreTools')}
          </Text>
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('toolsMoreHint')}
          </Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
      </Pressable>

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/workspace'); }}
        style={({ pressed }) => [
          styles.workspaceCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            marginHorizontal: 20,
            marginBottom: 12,
            opacity: pressed ? 0.8 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <View style={[styles.workspaceIcon, { backgroundColor: '#10B981' + '18', borderRadius: 12 }]}>
          <Ionicons name="folder-outline" size={22} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('myWorkspace')}
          </Text>
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('workspaceSubtitle')}
          </Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
      </Pressable>

      {DEMO_MODE && (
        <View style={[styles.note, { backgroundColor: colors.muted, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('aiToolsNote')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, marginBottom: 8 },
  aiBadge: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  aiBadgeText: { fontSize: 12 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  section: { paddingTop: 8 },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  moreHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  moreHint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 20, marginBottom: 8 },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  card: { alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  cardCompact: { padding: 14 },
  iconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconWrapCompact: { width: 44, height: 44 },
  titleRow: { alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10 },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  workspaceCard: { alignItems: 'center', padding: 16, borderWidth: 1, gap: 14, marginTop: 8 },
  workspaceIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  note: { alignItems: 'flex-start', gap: 8, padding: 14, marginBottom: 20 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});

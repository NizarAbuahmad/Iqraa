import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { DEMO_MODE } from '@/services/ai/demoMode';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { openGeogebraGraphing } from '@/services/geogebra';
import { trackEvent } from '@/services/analytics';
import { pickPrefillParams } from '@/services/lessonPrep';
import { loadLessonPick } from '@/services/lessonContext';
import { classToolParamsFromRoute, type ClassToolParams } from '@/services/classToolParams';
import {
  ALL_TOOLS,
  LIBRARY_TOOL,
  type ToolDef,
} from '@/services/toolCatalog';


async function runToolAction(tool: ToolDef, lang: 'ar' | 'en', forClass: ClassToolParams | null) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  trackEvent('tool_opened', { toolId: tool.id, source: 'tools_tab' });
  if (tool.externalAction === 'geogebra-graphing') {
    await openGeogebraGraphing();
    return;
  }
  // Arrived from a class: the class decides the scope, so the global "current
  // lesson" below is skipped — it can belong to another subject, and a topic
  // from one subject under another's indices is refused as a conflict.
  // Explicit routeParams still win. The library is a catalogue, not a
  // generator, so it is left alone.
  if (tool.route && forClass && tool.id !== LIBRARY_TOOL.id) {
    router.push({ pathname: tool.route as any, params: { ...forClass, ...tool.routeParams } });
    return;
  }
  if (tool.route) {
    // Prefill from the global "current lesson" so a tool opened from the hub
    // already knows the teacher's context (set on home / in chat). Explicit
    // routeParams always win; the teacher can still change it in the tool —
    // that change stays local to the material being generated.
    const pick = await loadLessonPick();
    // The lesson's own grade and subject travel with its title — see
    // `pickPrefillParams`. An explicit `routeParams.topic` still wins whole:
    // the pick's grade must not ride along with somebody else's topic.
    const prefill: Record<string, string> = tool.routeParams?.topic
      ? {}
      : pickPrefillParams(pick, lang) as Record<string, string>;
    router.push({ pathname: tool.route as any, params: { ...prefill, ...tool.routeParams } });
  }
}

function ToolCard({
  tool,
  isRTL,
  colors,
  t,
  compact,
  grid,
  forClass,
}: {
  tool: ToolDef;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: any) => string;
  compact?: boolean;
  grid?: boolean;
  /** Set when the teacher came from a class's الموارد tab. */
  forClass: ClassToolParams | null;
}) {
  const isExternal = !!tool.externalAction;
  const { lang } = useLanguage();

  // A left-icon/right-text row reads fine at phone width, but stretched
  // across a desktop grid tile it leaves the icon and chevron stranded at
  // opposite edges of mostly empty space. The grid tile centers everything
  // instead — icon on top, bigger, the way a launcher tile or app icon reads.
  if (grid) {
    return (
      <Pressable
        onPress={() => { void runToolAction(tool, lang, forClass); }}
        style={({ pressed }) => [
          styles.gridCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={[styles.gridIconWrap, { backgroundColor: tool.color + '1A', borderRadius: 16 }]}>
          <Ionicons name={tool.icon} size={30} color={tool.color} />
        </View>
        <View style={[styles.gridTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: 'center' }]}>
            {t(tool.titleKey as any)}
          </Text>
          {tool.badgeKey && (
            <View style={[styles.badge, { backgroundColor: tool.color + '22' }]}>
              <Text style={[styles.badgeText, { color: tool.color, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t(tool.badgeKey as any)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}
          numberOfLines={2}
        >
          {t(tool.descKey as any)}
        </Text>
        {isExternal && <Ionicons name="open-outline" size={14} color={colors.mutedForeground} />}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => { void runToolAction(tool, lang, forClass); }}
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
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: compact ? 14 : 15 }]}>
            {t(tool.titleKey as any)}
          </Text>
          {tool.badgeKey && (
            <View style={[styles.badge, { backgroundColor: tool.color + '22' }]}>
              <Text style={[styles.badgeText, { color: tool.color, fontFamily: 'ReadexPro_600SemiBold' }]}>
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
  const { t, isRTL, lang } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  // Set only when the teacher tapped «أنشئ مادة جديدة» inside a class.
  const routeParams = useLocalSearchParams<{ classId?: string; gradeIdx?: string; subjectIdx?: string }>();
  const forClass = classToolParamsFromRoute(routeParams);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiTools')}
        </Text>
        {DEMO_MODE ? (
          <AiSourceBadge isRTL={isRTL} />
        ) : (
          <View style={[styles.aiBadge, { backgroundColor: colors.primary + '18', borderRadius: 20, alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={[styles.aiBadgeText, { color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }]}>
              {t('poweredByAI')}
            </Text>
          </View>
        )}
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiToolsSubtitle')}
        </Text>
      </View>

      {/* One flat grid, library first. The before/during/after headings were
          dropped 2026-09-25: with a dozen tools they cost scrolling without
          helping a teacher choose. WORKFLOW still orders the list, and still
          groups the home screen and command palette. */}
      <View style={[styles.section, { paddingTop: 16 }]}>
        <View style={[styles.list, isDesktop && styles.listGrid]}>
          {[LIBRARY_TOOL, ...ALL_TOOLS].map(tool => (
            <ToolCard key={tool.id} tool={tool} isRTL={isRTL} colors={colors} t={t} grid={isDesktop} forClass={forClass} />
          ))}
        </View>
      </View>

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
  subtitle: { fontSize: 15, lineHeight: 23 },
  section: { paddingTop: 8 },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridCard: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 220,
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    gap: 8,
  },
  gridIconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  gridTitleRow: { alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  card: { alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  cardCompact: { padding: 14 },
  iconWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconWrapCompact: { width: 44, height: 44 },
  titleRow: { alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  note: { alignItems: 'flex-start', gap: 8, padding: 14, marginBottom: 20 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

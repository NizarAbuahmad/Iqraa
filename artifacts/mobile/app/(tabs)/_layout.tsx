import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { scheme } from '@/constants/colors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, Tabs, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { WebSidebar } from '@/components/ui/WebSidebar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { GlobalLessonBar } from '@/components/ui/GlobalLessonBar';
import { TranslationKey } from '@/services/i18n';
import { HomeLessonPick, loadLessonPick, subscribeLessonPick } from '@/services/lessonContext';
import { DEFAULT_ACTIVE_LESSON_ID } from '@/services/lessonCopilot';
import { lessonPickerParams, resolveLessonPrepContext, scopePickerParams } from '@/services/lessonPrep';

/**
 * Ionicons name per tab, for surfaces that need the name rather than the
 * rendered icon (the command palette). Kept next to `buildTabEntries` so a new
 * tab is one edit away from being addressable by ⌘K.
 */
function iconNameFor(name: string): string {
  switch (name) {
    case 'index': return 'grid-outline';
    case 'iqra': return 'chatbubble-ellipses-outline';
    case 'curriculum': return 'library-outline';
    case 'ai-tools': return 'sparkles-outline';
    case 'notifications': return 'chatbubble-outline';
    case 'profile': return 'person-circle-outline';
    default: return 'ellipse-outline';
  }
}

/** Hides a tab without unregistering its route, so a deep link to it still resolves. */
const HIDDEN = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };

type TabIcon = (args: { color: string; focused: boolean; isIOS: boolean }) => React.ReactNode;

/**
 * Single source of truth for tab metadata, consumed by both the native/mobile
 * `Tabs.Screen` list below and `WebSidebar` — so role-gating (isTeacher) can't
 * drift between the two nav renderings.
 */
export type TabEntry = {
  name: string;
  titleKey: TranslationKey;
  visible: boolean;
  icon: TabIcon;
};

function buildTabEntries(isTeacher: boolean, isDesktop: boolean): TabEntry[] {
  return [
    {
      /*
        The desktop landing: the lesson and what is still missing from it.
        Desktop only, and only for a teacher — a phone opens straight into the
        chat (see index.tsx), where a workspace this wide has nowhere to go,
        and a sixth item would crush the tab bar.
      */
      name: 'index',
      titleKey: 'tabToday',
      visible: isTeacher && isDesktop,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView name={focused ? 'square.grid.2x2.fill' : 'square.grid.2x2'} tintColor={color} size={22} />
        ) : (
          <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
        ),
    },
    {
      name: 'iqra',
      titleKey: 'tabIqra',
      visible: isTeacher,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView
            name={focused ? 'bubble.left.and.bubble.right.fill' : 'bubble.left.and.bubble.right'}
            tintColor={color}
            size={22}
          />
        ) : (
          <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
        ),
    },
    {
      name: 'curriculum',
      titleKey: 'tabCurriculum',
      visible: true,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView name={focused ? 'books.vertical.fill' : 'books.vertical'} tintColor={color} size={22} />
        ) : (
          <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
        ),
    },
    {
      name: 'ai-tools',
      titleKey: 'tabTools',
      visible: isTeacher,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView
            name={focused ? 'wand.and.stars' : 'wand.and.stars.inverse'}
            tintColor={color}
            size={22}
          />
        ) : (
          <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
        ),
    },
    {
      // Route file is still "notifications" — was "Notifications", repurposed
      // for person-to-person messaging once that shipped.
      name: 'notifications',
      titleKey: 'tabAlerts',
      visible: true,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView name={focused ? 'bubble.left.fill' : 'bubble.left'} tintColor={color} size={22} />
        ) : (
          <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={22} color={color} />
        ),
    },
    {
      name: 'profile',
      titleKey: 'tabProfile',
      visible: true,
      icon: ({ color, focused, isIOS }) =>
        isIOS ? (
          <SymbolView name={focused ? 'person.circle.fill' : 'person.circle'} tintColor={color} size={22} />
        ) : (
          <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={color} />
        ),
    },
  ];
}

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const isDark = scheme === 'dark';
  const { user } = useAuth();
  const viewportW = useViewportWidth();
  const isDesktop = isWeb && viewportW >= DESKTOP_BREAKPOINT;

  /*
   * A parent or student gets الرسائل, المنهج and حسابي — and not the two tabs
   * that only a teacher can actually use. iQra and AI Tools call generation
   * routes the server refuses for these roles (see middlewares/auth.ts), so
   * showing them offers a door that only ever opens onto a 403. The curriculum
   * tab stays: it reads bundled data, and getBooksForSubjectGrade already
   * narrows a non-teacher to student-facing books.
   */
  const isTeacher = isTeacherRole(user?.role);
  const pathname = usePathname();

  // Mirrors the same storage the iQra tab's change-lesson sheet writes to —
  // kept in sync via subscribeLessonPick rather than reloaded per-tab, since
  // this bar is a sibling of the tab navigator, not a screen inside it.
  const [lessonPick, setLessonPick] = useState<HomeLessonPick | null>(null);
  useEffect(() => {
    if (!isTeacher) return;
    loadLessonPick().then(setLessonPick);
    return subscribeLessonPick(setLessonPick);
  // `user?.id` too: a second teacher signing in on the same device kept the
  // first one's lesson, because the role — the only dependency — never changed.
  }, [isTeacher, user?.id]);

  /*
    The lesson ⌘K acts on: the teacher's pick, or the one the chat and the
    workspace both fall back to when there is none. Resolved here rather than
    in the palette so all three surfaces name the same lesson.
  */
  const fallbackLesson = resolveLessonPrepContext(DEFAULT_ACTIVE_LESSON_ID, lang as 'ar' | 'en');
  const activeLesson = lessonPick?.topic?.trim()
    ? {
        topic: lessonPick.topic.trim(),
        lessonId: lessonPick.lessonId ?? null,
        gradeId: lessonPick.gradeId,
        subjectId: lessonPick.subjectId,
      }
    : fallbackLesson
      ? {
          topic: fallbackLesson.topic,
          lessonId: fallbackLesson.lessonId,
          gradeId: fallbackLesson.gradeId,
          subjectId: fallbackLesson.subjectId,
        }
      : null;

  const tabEntries = buildTabEntries(isTeacher, isDesktop);

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
          // Desktop web gets a sidebar instead (rendered alongside, below) —
          // style-only toggle so Tabs.Navigator stays mounted and keeps nav state.
          ...(isDesktop ? { display: 'none' as const } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ) : null,
        tabBarLabelStyle: { fontFamily: 'Cairo_600SemiBold', fontSize: 11 },
      }}
    >
      {/*
        ── Landing ──────────────────────────────────────────
        "index" is the route Expo Router lands on. On desktop web it renders
        the lesson workspace and appears in the rail as «اليوم»; everywhere
        else it forwards to the chat (see index.tsx) and stays out of the tab
        bar — which is why it is an ordinary entry in `tabEntries` now, with
        `visible` doing the deciding, rather than a hard-coded hidden screen.
      */}
      {tabEntries.map((entry) => (
        <Tabs.Screen
          key={entry.name}
          name={entry.name}
          options={
            entry.visible
              ? {
                  title: t(entry.titleKey),
                  tabBarIcon: ({ color, focused }) => entry.icon({ color, focused, isIOS }),
                }
              : HIDDEN
          }
        />
      ))}
    </Tabs>
  );

  // Not shown to a parent/student: they have no lesson context to switch, and
  // the two tabs it would drive them toward (iQra, AI Tools) are hidden for
  // them anyway.
  // The fallback-aware lesson, not the raw pick: with no pick saved yet the bar
  // said «اختر الدرس الحالي» while the chat card beside it showed the default
  // lesson it seeds — the same teacher told two different things.
  const shownPick: HomeLessonPick | null = activeLesson ? { ...activeLesson, unitOrder: null } : null;
  const lessonProps = {
    pick: shownPick,
    lang: lang as 'ar' | 'en',
    isRTL,
    colors,
    t,
    onPress: () => router.push({ pathname: '/iqra', params: { openLessonPicker: String(Date.now()) } }),
  };
  // them anyway. Not shown on iQra itself either — CurrentLessonCard already
  // does this job there, full-width and with the Start Class action; a second
  // copy stacked above it would just be the same line twice.
  const onWorkspaceHome = isDesktop && (pathname === '/' || pathname === '/index');
  const bar = isTeacher && !pathname.startsWith('/iqra') && !onWorkspaceHome ? (
    <GlobalLessonBar
      layout="bar"
      pick={shownPick}
      lang={lang as 'ar' | 'en'}
      isRTL={isRTL}
      colors={colors}
      topInset={isDesktop ? 0 : insets.top}
      t={t}
      onPress={() => router.push({ pathname: '/iqra', params: { openLessonPicker: String(Date.now()) } })}
    />
  ) : null;

  if (!isDesktop) {
    // Not on iQra itself — CurrentLessonCard already does this job there,
    // full-width and with the Start Class action; a second copy stacked above
    // it would just be the same line twice.
    const bar = isTeacher && !pathname.startsWith('/iqra') ? (
      <GlobalLessonBar layout="bar" topInset={insets.top} {...lessonProps} />
    ) : null;
    return (
      <View style={{ flex: 1 }}>
        {bar}
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
    );
  }

  // In the sidebar the card stays on iQra too: a nav rail whose top block
  // vanishes on one tab reads as a bug, and it is beside the thread there,
  // not stacked over CurrentLessonCard.
  return (
    <View style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <WebSidebar
        entries={tabEntries}
        isIOS={isIOS}
        lessonCard={isTeacher ? <GlobalLessonBar layout="card" {...lessonProps} /> : null}
      />
      <View style={{ flex: 1 }}>
        {bar}
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
      <CommandPalette
        enabled={isDesktop}
        /*
          The same lesson the chat card and the workspace show when a teacher
          has never opened the picker — otherwise ⌘K is the one surface that
          claims there is no lesson while the two screens beside it name one.
        */
        lessonTopic={activeLesson?.topic ?? null}
        lessonParams={
          activeLesson
            ? {
                topic: activeLesson.topic,
                ...(lessonPickerParams(activeLesson.lessonId, lang as 'ar' | 'en') ??
                  scopePickerParams(activeLesson.gradeId, activeLesson.subjectId) ??
                  {}),
              }
            : undefined
        }
        nav={tabEntries
          .filter(e => e.visible)
          .map(e => ({ name: e.name, label: t(e.titleKey), icon: iconNameFor(e.name) }))}
      />
    </View>
  );
}

export default function TabLayout() {
  // Classic Tabs only — NativeTabs lacks BottomTabBarHeight context and crashes
  // iqra.tsx (useBottomTabBarHeight) in Expo Go.
  return <ClassicTabLayout />;
}

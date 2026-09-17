import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { WebSidebar } from '@/components/ui/WebSidebar';
import { TranslationKey } from '@/services/i18n';

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

function buildTabEntries(isTeacher: boolean): TabEntry[] {
  return [
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
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
  const tabEntries = buildTabEntries(isTeacher);

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
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
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
        tabBarLabelStyle: { fontFamily: 'Cairo_500Medium', fontSize: 10 },
      }}
    >
      {/*
        ── Landing (redirects to iQra) ──────────────────────
        "index" is still the route Expo Router lands on, but it now forwards to
        the chat rather than rendering a home screen. Home and chat had grown
        into the same screen — both carried the current lesson, the same tool
        chips and a text box — except home's box was a keyword matcher that
        silently fell back to generating a lesson plan for anything it did not
        recognise. Chat's box is the real one, so chat is the landing.
      */}
      <Tabs.Screen name="index" options={HIDDEN} />

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

  if (!isDesktop) {
    return tabs;
  }

  return (
    <View style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <WebSidebar entries={tabEntries} isIOS={isIOS} />
      <View style={{ flex: 1 }}>{tabs}</View>
    </View>
  );
}

export default function TabLayout() {
  // Classic Tabs only — NativeTabs lacks BottomTabBarHeight context and crashes
  // iqra.tsx (useBottomTabBarHeight) in Expo Go.
  return <ClassicTabLayout />;
}

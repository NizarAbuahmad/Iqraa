import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
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
      <Tabs.Screen
        name="index"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />

      {/* ── iQra Chat (first tab) ─────────────────────────── */}
      <Tabs.Screen
        name="iqra"
        options={{
          title: t('tabIqra'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'bubble.left.and.bubble.right.fill' : 'bubble.left.and.bubble.right'}
                tintColor={color}
                size={22}
              />
            ) : (
              <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
            ),
          tabBarBadge: undefined,
        }}
      />

      {/* ── Curriculum ────────────────────────────────────── */}
      <Tabs.Screen
        name="curriculum"
        options={{
          title: t('tabCurriculum'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'books.vertical.fill' : 'books.vertical'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
            ),
        }}
      />

      {/* ── AI Tools ──────────────────────────────────────── */}
      <Tabs.Screen
        name="ai-tools"
        options={{
          title: t('tabTools'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'wand.and.stars' : 'wand.and.stars.inverse'}
                tintColor={color}
                size={22}
              />
            ) : (
              <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
            ),
        }}
      />

      {/* ── Notifications ─────────────────────────────────── */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabAlerts'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'bell.fill' : 'bell'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
            ),
        }}
      />

      {/* ── Profile ───────────────────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'person.circle.fill' : 'person.circle'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={color} />
            ),
        }}
      />

    </Tabs>
  );
}

export default function TabLayout() {
  // Classic Tabs only — NativeTabs lacks BottomTabBarHeight context and crashes
  // iqra.tsx (useBottomTabBarHeight) in Expo Go.
  return <ClassicTabLayout />;
}

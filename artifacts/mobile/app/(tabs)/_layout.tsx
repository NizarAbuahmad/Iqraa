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
      {/* ── Home ──────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'house.fill' : 'house'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
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

      {/* ── iQra Chat ─────────────────────────────────────── */}
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

      {/* ── AI Tools (hidden from tab bar, still routable) ── */}
      <Tabs.Screen
        name="ai-tools"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
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

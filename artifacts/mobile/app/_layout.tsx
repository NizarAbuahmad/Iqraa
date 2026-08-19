import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
/**
 * Arabic type. Inter has no Arabic glyphs, so every Arabic string — which is
 * nearly the whole product — was being drawn by whatever fallback each device
 * happened to pick, at that fallback's own weight. Bold headings were not
 * reliably bold, and three users on three platforms saw three typefaces.
 *
 * Almarai carries body copy; Cairo carries every heavier weight, which is where
 * headings, titles, buttons and labels live. Both cover Latin and digits too,
 * so English terms and numerals stay in one family rather than switching
 * mid-sentence.
 */
import { Almarai_400Regular } from '@expo-google-fonts/almarai';
import {
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import { useFonts } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { hasSeenAppIntro } from '@/services/appIntro';
import { isEntryRoute } from '@/services/routeGating';
import { identifyUser, initAnalytics, resetAnalyticsIdentity, trackScreen } from '@/services/analytics';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  // Only navigate on auth transitions (boot / login / logout) — never bounce
  // away from Workspace, Profile, or AI tools on every user truthy render.
  const wasLoading = useRef(true);
  const wasSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    const signedIn = !!user;
    const finishedBoot = wasLoading.current;
    const authChanged =
      wasSignedIn.current !== null && wasSignedIn.current !== signedIn;
    // Internal CQV / developer tools — never bounce away from /dev/*
    const onInternalDev = pathname?.startsWith('/dev') ?? false;

    if (onInternalDev) {
      wasLoading.current = false;
      wasSignedIn.current = signedIn;
      return;
    }

    if (finishedBoot || authChanged) {
      if (signedIn) {
        // Ties every subsequent event to this teacher — no-op if analytics
        // is unconfigured, same as everything else in services/analytics.ts.
        if (user) identifyUser(user.id, { role: user.role });
        // Only bounce to the tabs from an entry route, or on a fresh sign-in.
        // This used to fire on every cold boot, which meant no link into the
        // app survived arriving at it: on web every reload IS a cold boot, so
        // opening /admin/dashboard, refreshing a worksheet, or sharing an
        // evaluation link all landed the recipient on the home tab instead.
        if (authChanged || isEntryRoute(pathname)) router.replace('/(tabs)');
      } else if (finishedBoot) {
        // Cold boot, signed out: a brand-new install sees the product intro
        // once; a device that just signed out goes straight back to login.
        if (authChanged) resetAnalyticsIdentity();
        hasSeenAppIntro().then(seen => {
          // '/onboarding' isn't in the generated typed-routes union until the
          // dev server regenerates it — same reason other routes in this app
          // are cast, e.g. '/ai-tools/classroom/presentation' throughout.
          router.replace((seen ? '/(auth)/login' : '/onboarding') as any);
        });
      } else {
        if (authChanged) resetAnalyticsIdentity();
        router.replace('/(auth)/login');
      }
    }

    wasLoading.current = false;
    wasSignedIn.current = signedIn;
  }, [user, isLoading, pathname]);

  // One screen-view event per route change — covers every screen in the app
  // (not just AI tools) without instrumenting each one individually.
  useEffect(() => {
    if (pathname) trackScreen(pathname);
  }, [pathname]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="curriculum/subjects" options={{ headerShown: false }} />
      <Stack.Screen name="curriculum/lessons" options={{ headerShown: false }} />
      <Stack.Screen name="curriculum/unit" options={{ headerShown: false }} />
      <Stack.Screen name="curriculum/lesson-detail" options={{ headerShown: false }} />
      <Stack.Screen name="ai-tools/lesson-plan" options={{ headerShown: false }} />
      <Stack.Screen name="ai-tools/worksheet" options={{ headerShown: false }} />
      <Stack.Screen name="ai-tools/quiz" options={{ headerShown: false }} />
      <Stack.Screen name="ai-tools/activity" options={{ headerShown: false }} />
      <Stack.Screen name="ai-tools/lesson-flow" options={{ headerShown: false }} />
      <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="classes/index" options={{ headerShown: false }} />
      <Stack.Screen name="classes/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/index" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/new" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/[id]/answers/index" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/[id]/answers/[studentId]" options={{ headerShown: false }} />
      <Stack.Screen name="evaluations/[id]/results" options={{ headerShown: false }} />
      <Stack.Screen name="dev" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Almarai_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    // Vector icons must be explicitly loaded — Ionicons font powers all
    // non-iOS tab bar icons and in-app icons on Android / web.
    ...Ionicons.font,
  });

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

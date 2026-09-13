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
import { AuthProvider, isTeacherRole, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { hasSeenAppIntro } from '@/services/appIntro';
import { CLAIM_REQUIRED_ROUTE, isEntryRoute, isNonTeacherRoute, isPublicRoute, needsRosterClaim } from '@/services/routeGating';
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

    // A student sitting an exam is not a teacher and has no account to be
    // signed out of. Their link must survive both branches below — the
    // signed-out one would send them to a login screen they can never pass,
    // and the signed-in one would yank a teacher testing the link to the tabs.
    if (isPublicRoute(pathname)) {
      wasLoading.current = false;
      wasSignedIn.current = signedIn;
      return;
    }

    // A parent/student with zero roster links has nothing to do in the app
    // yet — every data-serving endpoint scopes by rosterLinks.userId, so an
    // unlinked account would see empty everywhere. Checked before the
    // non-teacher bounce below (and before entry routes get their usual
    // free pass) so it applies right after signup, on every login, and on
    // every app boot/refresh — not just once. `/claim-required` itself is in
    // NON_TEACHER_ROUTES, so once there this check no-ops and the next block
    // leaves them alone.
    if (signedIn && user && needsRosterClaim(user) && pathname !== CLAIM_REQUIRED_ROUTE) {
      router.replace(CLAIM_REQUIRED_ROUTE as any);
      wasLoading.current = false;
      wasSignedIn.current = signedIn;
      return;
    }

    // A parent or student who arrives at a teacher screen without the tab bar
    // — a bookmark, a typed URL, browser history — is sent to Messages rather
    // than shown a screen whose every call the server will refuse. The tabs
    // already hide these (app/(tabs)/_layout.tsx); this is the other door.
    // Entry routes are left alone so the sign-in redirect below still runs.
    if (signedIn && user && !isTeacherRole(user.role) && !isEntryRoute(pathname) && !isNonTeacherRoute(pathname)) {
      router.replace('/notifications');
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

  /**
   * Hold the logo until the app knows where it is going.
   *
   * This used to fire as soon as the fonts loaded, which is well before
   * `/auth/me` answers — so reopening the app after Android had killed it
   * revealed a bare header and tab bar with an empty screen between them, and
   * only then the real destination. Gating on `isLoading` means the user sees
   * the logo and then their screen, with nothing in between.
   *
   * Declared after the navigation effect above on purpose: that one dispatches
   * its `router.replace` in the same commit, so the destination is already
   * chosen by the time this reveals anything.
   *
   * It cannot stick: `isLoading` flips in AuthContext's `finally`, and every
   * await inside that block now goes through `fetchWithTimeout`.
   */
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync().catch(() => {});
  }, [isLoading]);

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
      <Stack.Screen name="join-class" options={{ headerShown: false }} />
      <Stack.Screen name="claim-required" options={{ headerShown: false, gestureEnabled: false }} />
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

  // The splash is hidden in RootLayoutNav, once auth has resolved — not here.
  // Returning null while the fonts load is invisible because the splash is
  // still up; it is only the *reason* AuthProvider cannot mount any earlier.
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

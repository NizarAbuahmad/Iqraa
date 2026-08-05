import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';

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
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }

    wasLoading.current = false;
    wasSignedIn.current = signedIn;
  }, [user, isLoading, pathname]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
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
      <Stack.Screen name="dev" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Vector icons must be explicitly loaded — Ionicons font powers all
    // non-iOS tab bar icons and in-app icons on Android / web.
    ...Ionicons.font,
  });

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

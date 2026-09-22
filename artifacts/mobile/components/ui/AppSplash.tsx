/**
 * The boot screen, drawn by the app rather than by the OS.
 *
 * The native splash (`app.json` → `splash`) can only be a bitmap, and a bitmap
 * is why the strapline was breaking: the lockup PNG is 1024px square, the
 * Arabic line occupies 62px of it, and `resizeMode: contain` lands that line at
 * roughly 7dp on a phone. Strokes a fraction of a pixel wide do not survive the
 * downscale — the bowl of the final ل in «أفضل» disappeared, so the tagline read
 * «أفضا». Nothing was clipped; it was simply drawn too small to exist. (Measured
 * against a device capture: the rendered ink box matches the asset's to within a
 * pixel, so the geometry was never the problem.)
 *
 * Here the same two lines are real text in the brand faces, so they are crisp at
 * any density and can never lose a stroke. The native splash keeps only the
 * mark, which is all a bitmap can carry safely.
 *
 * It also answers the other half: a static image cannot say "still working".
 * The bar below the lockup is indeterminate on purpose — the boot is one
 * `/auth/me` round trip and we have no honest percentage to report, so it
 * shuttles rather than pretending to fill.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';

const LOGO_MARK = require('@/assets/images/logo-mark.png');

const NAVY = '#081B3A';
const TEAL = '#00A99D';
const INK = '#DFE7E9';

const BAR_W = 168;
const BAR_FILL_W = 58;

/** Long enough for the entrance to be seen. A splash that flashes reads as a glitch. */
const MIN_VISIBLE_MS = 800;
const FADE_OUT_MS = 280;

type Props = {
  /** Usually auth's `isLoading`. Falls to false when the app knows where it is going. */
  visible: boolean;
  /** Fired once the overlay has actually painted — hand off the native splash here. */
  onLayout?: () => void;
};

export function AppSplash({ visible, onLayout }: Props) {
  // Kept mounted through the fade-out, then dropped entirely.
  const [mounted, setMounted] = useState(true);
  const enter = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const shuttle = useRef(new Animated.Value(0)).current;
  const shownAt = useRef(Date.now());

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();

    // Restarted by hand rather than with `Animated.loop`, which on this stack
    // ran the first pass and then sat at its start value — the bar looked like
    // an empty line. Linear, deliberately: an eased shuttle slows down at both
    // ends of its travel, which is exactly where the fill is outside the track
    // and clipped.
    let cancelled = false;
    const sweep = () => {
      shuttle.setValue(0);
      Animated.timing(shuttle, {
        toValue: 1,
        duration: 1150,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished && !cancelled) sweep();
      });
    };
    sweep();
    return () => {
      cancelled = true;
      shuttle.stopAnimation();
    };
  }, [enter, shuttle]);

  useEffect(() => {
    if (visible) return;
    // Never yank the screen away mid-entrance: a boot served from cache can
    // resolve in 40ms, and the resulting flash looks like a rendering fault.
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [visible, exit]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.root, { opacity: exit, pointerEvents: visible ? 'auto' : 'none' }]}
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityLabel="IQRA"
      accessibilityHint="جارٍ التحميل"
    >
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        }}
      >
        <Image source={LOGO_MARK} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* The strapline trails the mark slightly — the lockup assembles rather
          than appearing all at once. */}
      <Animated.View
        style={{
          opacity: enter.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] }),
        }}
      >
        <Text style={styles.latin}>AI TEACHING ASSISTANT</Text>
        <Text style={styles.arabic}>ذكاء يُساعدك لتعليم أفضل</Text>
      </Animated.View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              transform: [
                {
                  translateX: shuttle.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-BAR_FILL_W, BAR_W],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logo: {
    width: 176,
    height: 176,
  },
  latin: {
    color: TEAL,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    letterSpacing: 3,
    textAlign: 'center',
  },
  arabic: {
    color: INK,
    fontFamily: 'Almarai_400Regular',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
  },
  track: {
    width: BAR_W,
    height: 3,
    borderRadius: 2,
    marginTop: 40,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  fill: {
    width: BAR_FILL_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL,
  },
});

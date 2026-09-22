import { Platform } from 'react-native';

/**
 * Whether `Animated` may hand an animation to the native driver.
 *
 * react-native-web has no native animation module. It warns that it is
 * "falling back to JS-based animation" and then does not: a
 * `useNativeDriver: true` animation jumps straight to its end value with no
 * frames in between (traced with a value listener on the splash bar — 0 → 1,
 * nothing between). Every `Animated` call in this app passed `true`
 * unconditionally, so on the web build nothing moved. Toasts appeared and
 * vanished without fading, the presentation sheet teleported instead of
 * sliding, the assistant's mark never pulsed while it was thinking — and none
 * of it looked broken, only lifeless, which is why it went unnoticed.
 *
 * Pass this instead of a literal. Native keeps the native driver, which is the
 * whole point of it — animations that run off the JS thread. Web gets the JS
 * driver, which is slower and the only one that works there.
 *
 * Only the driver changes. An animation that the native driver cannot take at
 * all — anything animating a layout property like `width`, `height` or
 * `margin` — must still pass `false` on every platform.
 */
export const NATIVE_DRIVER = Platform.OS !== 'web';

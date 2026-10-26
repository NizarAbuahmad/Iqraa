/**
 * The first-run tour, drawn: the screen dimmed, one real element left clear and
 * ringed with a dashed line, and a card beside it. Mounted once at the root
 * (app/_layout.tsx) beside AppSplash and ConfirmHost, and not as a <Modal> —
 * a Modal is a separate native window, and on web only gets its Escape key and
 * focus trap after an `animationend` some embedded browsers never fire.
 *
 * Everything is in this overlay's own coordinates: it measures its own origin
 * and subtracts it from the target's window rectangle, which absorbs an Android
 * status bar or edge-to-edge offset without knowing about either.
 *
 * The state is `services/tourStore.ts`; where things go is `tourPlacement.ts`;
 * what each step points at is `tour.ts`; what may start it is `useTourAutostart`.
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect as SvgRect } from 'react-native-svg';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { scheme } from '@/constants/colors';
import { useLanguage } from '@/context/LanguageContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { NATIVE_DRIVER } from '@/constants/animation';
import { MOTION } from '@/services/motion';
import { isTourHome, tourRoleOf, type TourState } from '@/services/tour';
import {
  dropStep,
  getTourSnapshot,
  isTourActive,
  nextStep,
  prevStep,
  skipTour,
  subscribeTour,
} from '@/services/tourStore';
import { measureTarget, revealTarget, type Rect } from '@/services/tourRegistry';
import { centerCard, connectorFor, holeFor, holeRadius, placeCard, scrimPath, type Size } from '@/services/tourPlacement';
import { measureInWindow } from './TourTarget';
import { TourCard } from './TourCard';
import { useTourAutostart, useTourLayout } from '@/hooks/useTour';

/** The ring and the line sit on the dark scrim in both themes, so they are white in both. */
const ON_SCRIM = '#FFFFFF';
const DARK_SCRIM = '#000000B3';
const CARD_MAX_WIDTH = 360;
const EDGE = 16;
/** Past the target's own entrance motion before the first measurement. */
const FIRST_MEASURE_DELAY_MS = 120;
const RETRY_DELAY_MS = 100;
const MEASURE_ATTEMPTS = 6;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** True while a tour is on screen — the root layout hides the app from screen readers behind it. */
export function useTourActive(): boolean {
  return useSyncExternalStore(subscribeTour, isTourActive, isTourActive);
}

export function TourHost() {
  const state = useSyncExternalStore(subscribeTour, getTourSnapshot, getTourSnapshot);
  useTourAutostart();
  return state ? <TourOverlay state={state} /> : null;
}

function TourOverlay({ state }: { state: TourState }) {
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const role = tourRoleOf(user?.role);
  const pathname = usePathname();
  const reduced = useReduceMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  const step = state.steps[state.index];
  const total = state.steps.length;
  const direction = useRef<1 | -1>(1);
  const indexRef = useRef(state.index);
  indexRef.current = state.index;

  const rootRef = useRef<View>(null);
  const cardRef = useRef<View>(null);
  const nextRef = useRef<View>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [card, setCard] = useState<Size | null>(null);
  const [found, setFound] = useState<{ stepId: string; rect: Rect } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  // In dark mode the page is already navy, so a navy veil would barely dim it.
  const scrim = scheme === 'dark' ? DARK_SCRIM : `${colors.ink}C7`;

  // ── where this overlay sits in the window ────────────────────────────────
  const onRootLayout = useCallback(() => {
    void measureInWindow(rootRef.current).then(r => {
      if (!r) return;
      setBox(prev => (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r));
    });
  }, []);

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCard(prev => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // ── find the step's target ───────────────────────────────────────────────
  // Re-runs on a resize (a desktop window dragged narrow swaps the sidebar for
  // the tab bar) but keeps the old rectangle on screen until the new one lands.
  useEffect(() => {
    const id = step.targetId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      await revealTarget(id);
      for (let attempt = 0; attempt < MEASURE_ATTEMPTS; attempt++) {
        await sleep(attempt === 0 ? FIRST_MEASURE_DELAY_MS : RETRY_DELAY_MS);
        if (cancelled) return;
        const rect = await measureTarget(id);
        if (cancelled) return;
        if (rect) {
          setFound({ stepId: step.id, rect });
          return;
        }
      }
      // It never appeared (a tab this account does not have): skip the step
      // rather than ring nothing.
      if (!cancelled) dropStep(direction.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [step.id, step.targetId, winW, winH]);

  // ── what to draw ─────────────────────────────────────────────────────────
  const size: Size | null = box ? { width: box.width, height: box.height } : null;
  const targetReady = step.targetId === null || found?.stepId === step.id;
  const hole =
    size && box && step.targetId && found?.stepId === step.id
      ? holeFor({ x: found.rect.x - box.x, y: found.rect.y - box.y, width: found.rect.width, height: found.rect.height }, size)
      : null;
  const cardWidth = size ? Math.min(CARD_MAX_WIDTH, size.width - 2 * EDGE) : CARD_MAX_WIDTH;
  const placement =
    size && card && targetReady
      ? hole
        ? placeCard(hole, size, card)
        : { ...centerCard(size, card), side: 'center' as const }
      : null;
  const radius = hole ? holeRadius(hole) : 0;
  const connector = hole && placement && placement.side !== 'center' && card ? connectorFor(hole, placement, card) : null;
  const shown = placement !== null;

  // The ring and card fade in once the step has somewhere to be; between steps the
  // screen is simply dim, which reads as the transition.
  useEffect(() => {
    if (!shown) {
      fade.setValue(0);
      return;
    }
    if (reduced) {
      fade.setValue(1);
      return;
    }
    const timing = Animated.timing(fade, {
      toValue: 1,
      duration: MOTION.enterMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    timing.start();
    return () => timing.stop();
  }, [shown, step.id, reduced, fade]);

  // ── moving ───────────────────────────────────────────────────────────────
  const onNext = useCallback(() => {
    direction.current = 1;
    nextStep();
  }, []);
  const onBack = useCallback(() => {
    direction.current = -1;
    prevStep();
  }, []);

  // A deep link or a push that navigates away from the home screen ends the tour.
  useEffect(() => {
    if (!role || !isTourHome(role, pathname)) skipTour();
  }, [role, pathname]);

  // The steps point at a phone's tab bar or a desktop's sidebar, and a window
  // dragged across the sidebar breakpoint swaps one for the other. Rather than
  // let every remaining step be dropped as "not on screen" and report the tour
  // as completed, end it as skipped; Profile → «Replay the tour» starts it again.
  const layout = useTourLayout();
  const startLayout = useRef(layout);
  useEffect(() => {
    if (layout !== startLayout.current) skipTour();
  }, [layout]);

  // Android's back button steps back, then skips; it never pops the screen under the scrim.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (indexRef.current > 0) onBack();
      else skipTour();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Web: Escape skips, and Tab stays on the card.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        skipTour();
      } else if (e.key === 'Tab') {
        trapTab(e, cardRef.current as unknown as HTMLElement | null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // Keyboard focus follows the step; a screen reader hears it.
  useEffect(() => {
    if (!shown) return;
    if (Platform.OS === 'web') (nextRef.current as unknown as HTMLElement | null)?.focus?.();
    else AccessibilityInfo.announceForAccessibility(`${t(step.titleKey)}. ${t(step.bodyKey)}`);
    // `t` is stable per language; the step changing is what speaks.
  }, [shown, step.id]);

  return (
    <View
      ref={rootRef}
      onLayout={onRootLayout}
      // Swallow every touch: the screen under the tour is not for pressing.
      onStartShouldSetResponder={() => true}
      style={[styles.root, { backgroundColor: size ? 'transparent' : scrim }]}
    >
      {size ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={hole ? scrimPath(size, hole, radius) : `M0 0H${size.width}V${size.height}H0Z`}
            fill={scrim}
            fillRule="evenodd"
          />
        </Svg>
      ) : null}

      {size ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents={shown ? 'box-none' : 'none'}>
          {hole ? (
            <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <SvgRect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={radius}
                ry={radius}
                fill="none"
                stroke={ON_SCRIM}
                strokeWidth={2}
                strokeDasharray="7 6"
              />
              {connector ? (
                <>
                  <Line
                    x1={connector.x1}
                    y1={connector.y1}
                    x2={connector.x2}
                    y2={connector.y2}
                    stroke={ON_SCRIM}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Circle cx={connector.x2} cy={connector.y2} r={5} fill={ON_SCRIM} />
                </>
              ) : null}
            </Svg>
          ) : null}
          <TourCard
            step={step}
            index={state.index}
            total={total}
            width={cardWidth}
            cardRef={cardRef}
            nextRef={nextRef}
            onLayout={onCardLayout}
            onNext={onNext}
            onBack={onBack}
            onSkip={skipTour}
            style={{
              position: 'absolute',
              top: placement?.top ?? 0,
              left: placement?.left ?? 0,
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Keeps Tab and Shift+Tab inside the card: a dialog must not hand focus to the page behind it. */
function trapTab(e: KeyboardEvent, root: HTMLElement | null): void {
  if (!root?.querySelectorAll) return;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"], button, a[href]'));
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (!active || !root.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

const styles = StyleSheet.create({
  // Above the Stack and AppSplash (zIndex 10), below ConfirmHost, which mounts after this.
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
});

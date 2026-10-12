/**
 * One drag pans, two fingers pinch-zoom, a tap reads a point, and on web the
 * mouse wheel zooms. A tool that has things to pick up (the sketchpad's points)
 * can claim a one-finger drag with `onGrab`: the drag then moves the grabbed
 * thing instead of the view, and a second finger still pinches the view. A thin wrapper over `PanResponder` — the maths (what a
 * pinch means, how a pan moves the view) is `services/mathViewport.ts`, which
 * is where it is tested. `PanResponder` rather than gesture-handler: it is what
 * `components/classroom/PenLayer.tsx` already uses on both native and web, and
 * it needs no new dependency.
 *
 * Put `panHandlers` on a view with `pointerEvents="box-only"`, so the touch
 * target is that view and `locationX/Y` are canvas coordinates, not a child's.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, type GestureResponderEvent, type GestureResponderHandlers, type View } from 'react-native';
import { pinchDelta, type Point } from '@/services/mathViewport';

export type CanvasGestureHandlers = {
  /** Move the view by this many pixels (the finger's own movement). */
  onPan: (dx: number, dy: number) => void;
  /** Zoom by `factor` about this canvas pixel. */
  onZoom: (factor: number, ax: number, ay: number) => void;
  /** A touch that did not move: a tap at this canvas pixel. */
  onTap: (x: number, y: number) => void;
  /** The gesture finished (finger up, or the wheel stopped): a good moment to recompute. */
  onEnd: () => void;
  /** True while a finger is down, so the page does not scroll under the canvas. */
  onLock: (locked: boolean) => void;
  /**
   * A finger went down here. Return true to claim the drag (something was picked
   * up); the touch then calls `onDrag`/`onDrop` and never pans or taps. Optional.
   */
  onGrab?: (x: number, y: number) => boolean;
  onDrag?: (x: number, y: number) => void;
  /** A claimed drag ended (finger up or the touch was taken away). */
  onDrop?: () => void;
};

/** Movement under this many pixels is still a tap. */
const TAP_SLOP = 6;
const TAP_MS = 500;
/** How long after the last wheel tick the wheel counts as finished. */
const WHEEL_IDLE_MS = 150;

function touchesOf(ev: GestureResponderEvent): Point[] {
  return ev.nativeEvent.touches.map(t => ({ x: t.locationX, y: t.locationY }));
}

export function useCanvasGestures(handlers: CanvasGestureHandlers) {
  // PanResponder is built once; read the latest handlers through a ref.
  const latest = useRef(handlers);
  latest.current = handlers;
  // A callback ref held in state: the canvas mounts only after its first layout, so
  // an effect that ran once at mount would find nothing to attach the wheel to.
  const [node, setNode] = useState<View | null>(null);

  const panHandlers: GestureResponderHandlers = useMemo(() => {
    let last: Point = { x: 0, y: 0 };
    let start: Point = { x: 0, y: 0 };
    let startedAt = 0;
    let moved = false;
    let multi = false;
    let prevPinch: Point[] | null = null;
    let grabbed = false;

    const end = (allowTap: boolean) => {
      latest.current.onLock(false);
      if (grabbed) {
        grabbed = false;
        latest.current.onDrop?.();
      } else if (allowTap && !moved && !multi && Date.now() - startedAt < TAP_MS) latest.current.onTap(start.x, start.y);
      moved = false;
      multi = false;
      prevPinch = null;
      latest.current.onEnd();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Never hand the touch back to the page's ScrollView mid-gesture.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: ev => {
        latest.current.onLock(true);
        const t = touchesOf(ev);
        const p = t[0] ?? { x: ev.nativeEvent.locationX, y: ev.nativeEvent.locationY };
        last = p;
        start = p;
        startedAt = Date.now();
        moved = false;
        multi = t.length >= 2;
        prevPinch = multi ? t.slice(0, 2) : null;
        grabbed = !multi && (latest.current.onGrab?.(p.x, p.y) ?? false);
      },
      onPanResponderMove: ev => {
        const t = touchesOf(ev);
        if (t.length >= 2) {
          multi = true;
          // A second finger turns a drag of a point into a pinch of the view.
          if (grabbed) {
            grabbed = false;
            latest.current.onDrop?.();
          }
          const cur = t.slice(0, 2);
          const d = prevPinch ? pinchDelta(prevPinch, cur) : null;
          prevPinch = cur;
          if (d) {
            if (d.panX !== 0 || d.panY !== 0) latest.current.onPan(d.panX, d.panY);
            if (Math.abs(d.factor - 1) > 1e-6) latest.current.onZoom(d.factor, d.anchorX, d.anchorY);
          }
          last = cur[0];
          return;
        }
        // Back to one finger after a pinch: re-anchor, so there is no jump.
        if (prevPinch) {
          prevPinch = null;
          last = t[0] ?? last;
          return;
        }
        const p = t[0] ?? { x: ev.nativeEvent.locationX, y: ev.nativeEvent.locationY };
        if (grabbed) {
          latest.current.onDrag?.(p.x, p.y);
          last = p;
          return;
        }
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > TAP_SLOP) moved = true;
        if (moved) latest.current.onPan(p.x - last.x, p.y - last.y);
        last = p;
      },
      onPanResponderRelease: () => end(true),
      onPanResponderTerminate: () => end(false),
    }).panHandlers;
  }, []);

  // The wheel has no React prop on a View, and must be non-passive to stop the page scrolling.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = node as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      latest.current.onZoom(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => latest.current.onEnd(), WHEEL_IDLE_MS);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (idle) clearTimeout(idle);
    };
  }, [node]);

  return { panHandlers, viewRef: setNode };
}

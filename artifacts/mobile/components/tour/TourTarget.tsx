/**
 * How a screen says "the tour may point at this". `useTourTarget(id)` returns a
 * ref for an element that already exists (a Pressable, a Band); `<TourTarget id>`
 * is a View that registers itself. Either registers in `services/tourRegistry.ts`
 * while mounted, and the overlay asks for the rectangle only when it reaches the
 * step, so an element that is not on screen costs nothing.
 *
 * `tour.test.ts` fails a step whose target id nothing here registers.
 */
import React, { useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { registerTarget, type Rect, type TourTargetHandle } from '@/services/tourRegistry';

const MEASURE_TIMEOUT_MS = 500;

/** A host view's rectangle in window coordinates; `null` when it is gone or never answers. */
export function measureInWindow(node: View | null): Promise<Rect | null> {
  return new Promise(resolve => {
    if (!node) return resolve(null);
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve({ x, y, width, height });
    });
  });
}

/** Brings the element on screen before it is measured (a scroll view scrolling to it). Gets the element's own view. */
export type RevealFn = (node: View | null) => Promise<void> | void;

export function useTourTarget(id: string, reveal?: RevealFn) {
  const ref = useRef<View>(null);
  // Read through a ref so a new `reveal` closure each render does not re-register.
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    const handle: TourTargetHandle = {
      measure: () => measureInWindow(ref.current),
      reveal: () => revealRef.current?.(ref.current),
    };
    return registerTarget(id, handle);
  }, [id]);
  return ref;
}

export function TourTarget({ id, reveal, ...rest }: ViewProps & { id: string; reveal?: RevealFn }) {
  const ref = useTourTarget(id, reveal);
  // `collapsable={false}`: Android removes a View that only lays out its
  // children, and a removed View has no rectangle to measure.
  return <View ref={ref} collapsable={false} {...rest} />;
}

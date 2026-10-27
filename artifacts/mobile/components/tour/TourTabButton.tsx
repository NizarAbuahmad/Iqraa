/**
 * A tab-bar button the tour can point at. react-navigation draws the button
 * itself, so there is no ref to take from outside; `tabBarButton` replaces it
 * with the same `PlatformPressable` it would have used, plus a registration.
 * `BottomTabItem` already wraps the button in the View that lays it out, so
 * this adds no wrapper and changes no layout.
 *
 * Used for visible tabs on a phone only (`app/(tabs)/_layout.tsx`). On desktop
 * the sidebar rows register the same ids with a `nav-` prefix instead.
 */
import React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useTourTarget } from './TourTarget';

export function TourTabButton({ tabName, ...props }: BottomTabBarButtonProps & { tabName: string }) {
  const ref = useTourTarget(`tab-${tabName}`);
  return <PlatformPressable {...props} ref={ref} />;
}

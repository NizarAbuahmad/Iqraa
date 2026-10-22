/**
 * Which corner a screen is in, so `useColors()` can hand it that corner's
 * tokens (constants/corners.ts). Mounted by the `_layout.tsx` of each corner
 * directory and nowhere else — the library and the browser stay teal on
 * purpose (cornerTheme.test.ts pins that).
 *
 * Trap: a module-scope `const ACCENT = palette.primary` is read before any
 * provider exists and stays teal. Read colours inside the component.
 */
import React, { createContext, useContext } from 'react';
import { CORNERS, type Corner, type CornerId } from '@/constants/corners';

const CornerContext = createContext<Corner | null>(null);

export function CornerThemeProvider({ corner, children }: { corner: CornerId; children: React.ReactNode }) {
  return <CornerContext.Provider value={CORNERS[corner]}>{children}</CornerContext.Provider>;
}

/** The corner this screen is in, or null outside every corner. */
export function useCorner(): Corner | null {
  return useContext(CornerContext);
}

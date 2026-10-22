/**
 * Which tabs a user sees, and where the lesson bar shows. Pure, so
 * `node --test` can pin it (services/__tests__/tabVisibility.test.ts);
 * `(tabs)/_layout.tsx` reads it for both the phone tab bar and the desktop
 * sidebar, so the two cannot drift.
 *
 * Since 2026-10-22 a teacher's phone opens on Today, not the chat, and the
 * chat leaves the phone tab bar. Its route stays registered (hidden), so every
 * `router.push('/iqra')` still lands; Today's ask card is the way in. Desktop
 * keeps the chat in the sidebar beside Today.
 */
export type TabName = 'index' | 'iqra' | 'school' | 'curriculum' | 'ai-tools' | 'notifications' | 'profile';
export type NavContext = { isTeacher: boolean; isDesktop: boolean };

export function tabVisible(name: TabName, { isTeacher, isDesktop }: NavContext): boolean {
  switch (name) {
    case 'index': return isTeacher;
    case 'iqra': return isTeacher && isDesktop;
    case 'school': return !isTeacher;
    case 'ai-tools': return isTeacher;
    case 'curriculum':
    case 'notifications':
    case 'profile':
      return true;
  }
}

/** The landing route, under either spelling expo-router reports. */
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index';
}

/**
 * The lesson bar is for teachers, everywhere except the two screens that carry
 * the lesson themselves: Today (its lesson card) and the chat
 * (CurrentLessonCard). A second copy stacked above either is the same line twice.
 */
export function showLessonBar(pathname: string, { isTeacher }: NavContext): boolean {
  return isTeacher && !isHomePath(pathname) && !pathname.startsWith('/iqra');
}

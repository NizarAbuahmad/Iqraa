/**
 * Turns a chat participant's `role` into the label a teacher (or a parent /
 * student) sees under their name in the inbox and in a thread header.
 *
 * Every direct thread's `otherParticipant.role` is already returned by the
 * server (`GET /messaging/threads`, `/messaging/contacts`) and already typed
 * on the client (`ChatRole`) — this file exists only to turn that role into
 * the right existing i18n string, once, instead of re-deriving it at each
 * call site. `ParticipantPickerSheet.tsx` and `messaging/claim/[studentId].tsx`
 * already do this inline for the two roles they ever see (student/parent);
 * this generalizes that same mapping to the full `ChatRole` range, since an
 * inbox can also show a teacher or admin as the other party.
 *
 * Plain `.ts`, no RN/expo imports (only `import type`, erased at compile
 * time) — this repo's mobile test runner is bare `node --test` and only
 * executes `services/__tests__/**\/*.test.ts`, so a helper reachable by that
 * suite must not import anything RN cannot load. `services/messaging.ts`
 * imports `expo-image-picker` at module scope, which is why this lives here
 * instead of there — same reasoning as `routeGating.ts` being split out of
 * `_layout.tsx`.
 */
import type { ChatRole } from './messaging.ts';
import type { TranslationKey } from './i18n.ts';

/**
 * `school_admin` and `system_admin` share one label — no screen in this app
 * distinguishes them from each other, only from `teacher`. Exhaustive over
 * `ChatRole` so a future sixth role fails to compile instead of silently
 * rendering nothing.
 */
export function chatRoleLabel(role: ChatRole, t: (key: TranslationKey) => string): string {
  switch (role) {
    case 'teacher':
      return t('roleTeacher');
    case 'school_admin':
    case 'system_admin':
      return t('roleAdmin');
    case 'student':
      return t('roleStudent');
    case 'parent':
      return t('roleParent');
  }
}

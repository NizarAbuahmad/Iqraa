/**
 * Landing route — forwards to the iQra chat.
 *
 * Home and chat had converged: both carried the current lesson, the same tool
 * chips and a text box. The difference was that home's box only looked like an
 * assistant — `inferToolFromPrompt` matched five keywords and silently returned
 * a lesson plan for everything else, so typing anything unrecognised produced a
 * lesson plan with no indication that the request had not been understood.
 * Chat's box is the real one, so chat is now where the app opens.
 *
 * This stays a redirect rather than being deleted: `/` is the app's entry point
 * and anything already pointing at it — deep links, `router.replace('/')` after
 * login — must keep working.
 *
 * A parent lands on Messages instead. The chat is a teacher's
 * material-generation tool and its routes reject those roles outright, so
 * opening the app onto it would greet them with a screen that cannot work —
 * and it is not even in their tab bar (see _layout.tsx). Messages is also what
 * a parent opens the app *for*.
 *
 * **A student lands on the curriculum**, which is already the first tab they
 * can see. They were landing on Messages too, and for a student that is an
 * empty thread list: nothing to read, nothing to do, and no indication that the
 * books are one tab across. A student opens this app to study, so it opens on
 * the material — their books, the figures printed in them, and the library of
 * what those books' own QR codes point at.
 *
 * The former home screen still exists at `/home` for the two things it holds
 * that have no other entry point yet: attaching media to a lesson, and Smart
 * Templates. Reachable from Profile. See STATUS.md.
 */
import { Redirect } from 'expo-router';
import { isStudentRole, isTeacherRole, useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();
  // `user` is null for the whole of the session restore, and null is not a
  // teacher — so without this a teacher cold-booting was sent to Messages, and
  // nothing brought them back: the boot effect in _layout.tsx only re-routes
  // from an entry route or on a fresh sign-in, and /notifications is neither.
  // Rendering nothing here is invisible; the splash is still up until auth
  // resolves (see _layout.tsx).
  if (isLoading) return null;
  if (isTeacherRole(user?.role)) return <Redirect href="/iqra" />;
  // Ordered teacher → student → everyone else, so an unknown or absent role
  // still lands on Messages. Same fail-closed reasoning as the `isLoading`
  // guard above: guessing "student" for a null role would send a cold-booting
  // parent to a curriculum browser.
  return <Redirect href={isStudentRole(user?.role) ? '/(tabs)/curriculum' : '/notifications'} />;
}

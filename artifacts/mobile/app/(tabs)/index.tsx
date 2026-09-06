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
 * A parent or student lands on Messages instead. The chat is a teacher's
 * material-generation tool and its routes reject those roles outright, so
 * opening the app onto it would greet them with a screen that cannot work —
 * and it is not even in their tab bar (see _layout.tsx).
 *
 * The former home screen still exists at `/home` for the two things it holds
 * that have no other entry point yet: attaching media to a lesson, and Smart
 * Templates. Reachable from Profile. See STATUS.md.
 */
import { Redirect } from 'expo-router';
import { isTeacherRole, useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={isTeacherRole(user?.role) ? '/iqra' : '/notifications'} />;
}

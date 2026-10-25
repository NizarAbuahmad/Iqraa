export type SignupRole = 'teacher' | 'parent' | 'student';
export type StudentSignupMethod = 'code' | 'email';
export type SignupForm = 'code' | 'email' | 'choose';

/**
 * Which sign-up form the register screen shows for a role.
 *
 * A teacher signs up with an email and a parent with their child's code. A
 * student picks (since 2026-10-23): with a teacher's code, no email needed; or
 * with an email, no class needed — the code is only for joining one later.
 * Until the student has picked, `'choose'`: no default, so nobody is sent down
 * a path they were not asked about. With no role picked yet the email form
 * stays up (its submit is disabled), as the screen always did.
 *
 * Kept out of the screen because `node --test` cannot load a React Native file.
 */
export function signupForm(role: SignupRole | null, method: StudentSignupMethod | null): SignupForm {
  if (role === 'parent') return 'code';
  if (role === 'student') return method ?? 'choose';
  return 'email';
}

/**
 * Only a student signing up with an email is asked to confirm they are an adult
 * or have a guardian's agreement: a teacher's code is a person vouching for a
 * student, and an email has no one doing that. The server refuses a new student
 * account without it (`api-server/src/lib/ageConfirmation.ts`).
 */
export function needsAgeConfirmation(role: SignupRole | null, method: StudentSignupMethod | null): boolean {
  return role === 'student' && method === 'email';
}

/**
 * Whether changing an existing account to `to` asks for the same age /
 * guardian confirmation a student's sign-up does. Only a change **into**
 * student: the server (`api-server/src/lib/roleSwitch.ts`) refuses one without
 * `ageConfirmed` with a 400, so a screen that skips the box gets an error it
 * cannot explain. Staying a student, or leaving the role, asks for nothing.
 *
 * `guardianEnabled` is the server's parent-approval switch: when it is on, a
 * parent's approval replaces the tick, so the switch asks for nothing either.
 * Optional and false by default, so an existing caller is unchanged.
 */
export function switchNeedsAgeConfirmation(
  from: string | null | undefined,
  to: string,
  guardianEnabled = false,
): boolean {
  return to === 'student' && from !== 'student' && !guardianEnabled;
}

export type SignupPlan = {
  /** The age / guardian tick (today's behaviour, parent approval off). */
  askAge: boolean;
  /** The parent's email field (parent approval on). */
  askParent: boolean;
  /** A student with an email, and the server's switch is not known yet: ask neither, and hold the submit. */
  waitingForConfig: boolean;
};

/**
 * What the sign-up form asks of someone, by role, method and the server's parent-approval switch. Only a
 * student signing up with an email is asked anything: the tick when the switch is off, a parent's email when
 * it is on. A teacher, a parent and a student with a teacher's code are never asked either (a teacher's code
 * is a person vouching for the student). While the switch is still being read (`guardianLoading`) the email
 * student is asked neither, so a tick that would vanish a moment later is not drawn.
 */
export function signupPlan(
  role: SignupRole | null,
  method: StudentSignupMethod | null,
  guardianEnabled: boolean,
  guardianLoading = false,
): SignupPlan {
  const studentEmail = needsAgeConfirmation(role, method);
  const waitingForConfig = studentEmail && guardianLoading;
  return {
    askAge: studentEmail && !guardianEnabled && !waitingForConfig,
    askParent: studentEmail && guardianEnabled && !waitingForConfig,
    waitingForConfig,
  };
}

/**
 * A refusal that means the app's copy of the server's parent-approval switch is out of date: the app thought
 * it was off and the server wants a parent's email, or the other way round. The screen drops its cached
 * answer and asks again.
 */
export function guardianConfigStale(code: string | undefined): boolean {
  return code === 'parent_email_required' || code === 'age_confirmation_required';
}

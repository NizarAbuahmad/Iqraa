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
 */
export function switchNeedsAgeConfirmation(from: string | null | undefined, to: string): boolean {
  return to === 'student' && from !== 'student';
}

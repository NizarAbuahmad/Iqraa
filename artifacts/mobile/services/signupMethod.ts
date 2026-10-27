export type SignupRole = 'teacher' | 'parent' | 'student';
export type StudentSignupMethod = 'code' | 'email';
export type SignupForm = 'code' | 'email' | 'choose';

/**
 * Which sign-up form the register screen shows for a role.
 *
 * A teacher signs up with an email. A student picks (since 2026-10-23), and so
 * does a parent (since 2026-10-25): with a teacher's code, no email needed; or
 * with an email, no class needed — the code is only for linking to a child
 * later, on the screen the routing gate sends an unlinked account to.
 * Until they have picked, `'choose'`: no default, so nobody is sent down a
 * path they were not asked about. With no role picked yet the email form
 * stays up (its submit is disabled), as the screen always did.
 *
 * Kept out of the screen because `node --test` cannot load a React Native file.
 */
export function signupForm(role: SignupRole | null, method: StudentSignupMethod | null): SignupForm {
  if (role === 'parent' || role === 'student') return method ?? 'choose';
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

export type SignupMissing = 'terms' | 'parent' | 'age';

export type SignupReadiness = {
  /** «متابعة عبر Google» may be tapped. Never waits for the server's switch, see below. */
  google: boolean;
  /** The create-account button may be tapped. */
  submit: boolean;
  /** What Google still needs from the person, in the order the form asks for it; null when nothing. */
  googleMissing: SignupMissing | null;
  /** What holds the create-account button: `googleMissing`, else `'config'` while something is still being read. */
  submitMissing: SignupMissing | 'config' | null;
};

/**
 * Who may tap what on the register screen: the boxes the person has to fill in, in the order the form asks for
 * them (terms, then a parent's address, then the age tick), and whether anything is still loading.
 *
 * Google does NOT wait for the loading. The switch (`plan.waitingForConfig`) only decides which box a student with
 * an email is shown, and the server refuses a sign-up that lacks it with a code `guardianConfigStale` knows, after
 * which the screen re-reads the switch. Holding Google for it left the button dim and unexplained for as long as a
 * slow API took: up to ~49 s, three tries of 15 s with 1 s and 3 s between. The password form still waits (it
 * would send a payload the server then refuses after the person typed a password), and says so (`'config'`).
 *
 * `optionsLoading` is the roles request (`/healthz/features`): until it answers the role is not known to be the
 * teacher's, so the password form holds. It never holds Google, whose button is not drawn until then anyway.
 */
export function signupReadiness(input: {
  termsAccepted: boolean;
  ageConfirmed: boolean;
  parentOk: boolean;
  plan: SignupPlan;
  optionsLoading: boolean;
}): SignupReadiness {
  const { termsAccepted, ageConfirmed, parentOk, plan, optionsLoading } = input;
  const googleMissing: SignupMissing | null = !termsAccepted
    ? 'terms'
    : plan.askParent && !parentOk
      ? 'parent'
      : plan.askAge && !ageConfirmed
        ? 'age'
        : null;
  const loading = plan.waitingForConfig || optionsLoading;
  return {
    google: googleMissing === null,
    submit: googleMissing === null && !loading,
    googleMissing,
    submitMissing: googleMissing ?? (loading ? 'config' : null),
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

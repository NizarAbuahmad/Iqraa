import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearTokens,
  apiJson,
  ApiError,
  isNetworkError,
  setOnRefreshFailed,
  getApiBaseUrl,
  awaitPendingRefresh,
} from '@/services/apiClient';
import { LEGAL_VERSION } from '@/constants/legal';
import { trackEvent } from '@/services/analytics';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import { setActiveLessonContextUser } from '@/services/lessonContext';
import { setActiveMediaUser } from '@/services/lessonMedia';
import { setActiveWorkspaceUser } from '@/services/workspace';
import { readUserSnapshot, saveUserSnapshot } from '@/services/userSnapshot';
import { queryClient } from '@/services/queryClient';
import { isTokenRemovedByOtherTab } from '@/services/sessionLoss';
import { isSavedFull, sortSavedAccounts, type SavedAccountMeta } from '@/services/accountList';
import {
  getSavedRefreshToken,
  loadSavedAccounts,
  removeSavedAccount,
  saveAccount,
  setLastGoogleEmail,
} from '@/services/savedAccounts';
import { warmUpVerifier } from '@/services/ai/verifyMath';
import { registerNotificationTapHandler, registerPushToken, unregisterPushToken } from '@/services/pushTokens';
// Same package GoogleSignInButton uses — safe to import on web too, it ships
// a `.web.js` stub so Metro never fails to resolve a native-only module.
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export type UserRole = 'teacher' | 'school_admin' | 'system_admin' | 'student' | 'parent';

/**
 * The roles the teacher-facing product is for. Mirrors TEACHER_ROLES in the
 * server's middlewares/auth.ts — the server is what actually enforces this
 * (every generation and roster route rejects the others); the client uses it
 * to avoid offering a door that only leads to a 403.
 */
export const TEACHER_ROLES: UserRole[] = ['teacher', 'school_admin', 'system_admin'];

export function isTeacherRole(role: UserRole | null | undefined): boolean {
  return !!role && TEACHER_ROLES.includes(role);
}

/**
 * A student specifically, which is not the same as "not a teacher".
 *
 * `!isTeacherRole(...)` covers parents too, and the two want different things:
 * a parent opens this app for messages about their child, a student opens it to
 * study. Every student check used to be a hand-written `role === 'student'`
 * literal in four files, which is how the landing screen ended up treating both
 * roles alike.
 */
export function isStudentRole(role: UserRole | null | undefined): boolean {
  return role === 'student';
}

/** A grade this teacher teaches, paired with which subjects they teach in it. */
export interface TeachingAssignment {
  gradeId: string;
  subjectIds: string[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  /** Convenience computed field: firstName + lastName */
  name: string;
  email: string;
  role: UserRole;
  preferredLanguage: 'en' | 'ar';
  /** A public, stable R2 URL, or null to show initials. */
  avatarUrl: string | null;
  createdAt: string;
  /**
   * Whether a parent/student account has claimed any roster row yet. Absent
   * for a teacher (never applicable) — see `needsRosterClaim` in
   * services/routeGating.ts, the gate this field exists for.
   */
  hasRosterLink?: boolean;
  /**
   * Grade/subject catalog ids (`@workspace/curriculum`'s GRADES/SUBJECTS)
   * this teacher picked at signup, editable later from the profile screen.
   * Both empty is what `needsTeacherSetup` (routeGating.ts) reads to send a
   * brand-new teacher to `/setup-subjects`; absent/empty for every other
   * role, where the field does not apply. Kept as the union across
   * `teachingAssignments` — narrowing to a specific grade's own subjects
   * needs that field instead, not these two.
   */
  gradeIds?: string[];
  subjectIds?: string[];
  /**
   * Which subjects this teacher teaches in each grade — the pairing
   * `gradeIds`/`subjectIds` can't express on their own. Possibly empty even
   * when those two are not, for an account set up before this field existed;
   * treat that the same as "one assignment per grade, covering every picked
   * subject" (see `setup-subjects.tsx`'s initial state).
   */
  teachingAssignments?: TeachingAssignment[];
  // Legacy optional fields kept for profile screen compatibility
  phone?: string;
  school?: string;
  language?: 'en' | 'ar';
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  /** Defaults to 'teacher' server-side when omitted. */
  role?: 'teacher' | 'student' | 'parent';
  /**
   * The person ticked «أوافق على شروط الاستخدام وسياسة الخصوصية». The server
   * refuses a new account without it and records the version shown
   * (`LEGAL_VERSION`) — see `api-server/src/lib/termsAcceptance.ts`.
   */
  acceptedTerms?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /**
   * `signup` is only consulted if this credential mints a brand-new account
   * (an existing user's role never changes here) — see the register screen's
   * "Continue with Google" button, which used to ignore the role pill
   * entirely and silently create a teacher.
   */
  loginWithGoogle: (credential: string, signup?: Pick<RegisterData, 'role' | 'acceptedTerms'>) => Promise<void>;
  /**
   * Creates the account but does NOT sign in — a password account starts
   * unverified and the server refuses login until `verifyEmail` succeeds.
   * Returns the email the code was sent to, for the caller to carry to the
   * verify screen (the trimmed/lowercased form the server actually used).
   */
  register: (data: RegisterData) => Promise<{ email: string; emailSent?: boolean }>;
  /** Submits the 6-digit code from the verification email. Signs the user in on success, same as login. */
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** Requests a fresh code for an unverified account. Always resolves — the server never confirms whether the email exists. */
  resendVerification: (email: string) => Promise<void>;
  /**
   * Repoints a pending signup at a different address when the one typed at
   * signup was wrong. Needs the password: the account has no session yet, so
   * that is the only proof it belongs to whoever is asking. Returns the
   * address the new code went to.
   */
  changeUnverifiedEmail: (email: string, password: string, newEmail: string) => Promise<{ email: string; emailSent?: boolean }>;
  /**
   * Always resolves when the request was accepted, whether or not that address
   * has an account — the server refuses to say, so the UI must not imply it
   * either (see the subtitle on the reset screen).
   */
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    preferredLanguage?: string;
    firstName?: string;
    lastName?: string;
    gradeIds?: string[];
    subjectIds?: string[];
    teachingAssignments?: TeachingAssignment[];
  }) => Promise<void>;
  /** Throws with the server's own message (e.g. "too large", "not set up yet") on failure. */
  uploadAvatar: (dataUrl: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  /**
   * Irreversible. Pass `password` for an ordinary account, or a fresh Google
   * ID token as `googleCredential` for a Google-only one — the server picks
   * which it will accept based on whether the account has a password hash at
   * all, and refuses 401 otherwise.
   */
  deleteAccount: (proof: { password?: string; googleCredential?: string }) => Promise<void>;
  /**
   * Flips `hasRosterLink` to true locally right after a successful
   * `POST /auth/claim`, so the routing gate clears without a round trip to
   * `/auth/me` just to learn something this call already knows.
   */
  markRosterClaimed: () => void;
  /**
   * Changes the role picked at signup. The server (POST /auth/role) allows it
   * only while this account has claimed no roster row — i.e. exactly while the
   * gate is holding it on `/claim-required`, which is the only screen that
   * offers it. Throws with the server's own `code` in `message` otherwise.
   */
  switchRole: (role: 'teacher' | 'parent' | 'student') => Promise<void>;
  /**
   * The other accounts signed in on this device, most recently used first.
   * Never includes the open one, and carries no credentials.
   */
  savedAccounts: SavedAccountMeta[];
  /**
   * Makes a saved account the open one. Works signed out too (from the login
   * screen). Throws an ApiError with code `session_expired` when that account's
   * saved session is no longer valid — the entry is removed — and
   * `switch_failed` for anything transient, where the entry is kept.
   */
  switchAccount: (userId: string) => Promise<void>;
  /**
   * Sets the open account aside, still signed in, and goes to the login screen
   * to sign in as another. Throws `too_many_accounts` at the cap.
   */
  addAccount: () => Promise<void>;
  /** Signs a saved account out of this device and ends its session on the server. */
  forgetAccount: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type ApiUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  preferredLanguage: string;
  avatarUrl?: string | null;
  createdAt: string;
  lastLogin?: string;
  hasRosterLink?: boolean;
  gradeIds?: string[];
  subjectIds?: string[];
  teachingAssignments?: TeachingAssignment[];
};

function toUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    firstName: apiUser.firstName,
    lastName: apiUser.lastName,
    name: `${apiUser.firstName} ${apiUser.lastName}`,
    email: apiUser.email,
    role: apiUser.role as UserRole,
    preferredLanguage: (apiUser.preferredLanguage as 'en' | 'ar') ?? 'en',
    language: (apiUser.preferredLanguage as 'en' | 'ar') ?? 'en',
    avatarUrl: apiUser.avatarUrl ?? null,
    createdAt: apiUser.createdAt,
    hasRosterLink: apiUser.hasRosterLink,
    gradeIds: apiUser.gradeIds ?? [],
    subjectIds: apiUser.subjectIds ?? [],
    teachingAssignments: apiUser.teachingAssignments ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const redirectToLogin = useRef<(() => void) | null>(null);

  // Scope the lesson-context storage to the signed-in user. Covers every
  // transition (login, register, session restore, logout) in one place —
  // without it a second account on the same device inherited the previous
  // teacher's lesson pick and skipped first-run onboarding.
  //
  // Set during render, not in an effect: React runs child effects before
  // parent ones, so the tab layout's `loadLessonPick()` ran in the same commit
  // as sign-in but *before* this scope was set, read the unscoped key, got
  // nothing, and never retried. The sidebar said «اختر الدرس الحالي» while
  // the chat — reading later — showed the teacher's real lesson. Both setters
  // are plain assignments, so repeating them on every render is harmless.
  setActiveLessonContextUser(user?.id ?? null);
  setActiveMediaUser(user?.id ?? null);
  setActiveWorkspaceUser(user?.id ?? null);
  useEffect(() => {
    // Signed in → the teacher will likely generate materials shortly. Wake
    // the sleeping verifier now so the symbolic badge is available when they
    // do, instead of silently degrading to the bank label. The route needs a
    // token, so this cannot run any earlier than here.
    if (user?.id) {
      warmUpVerifier();
      void registerPushToken();
    }
  }, [user?.id]);

  /**
   * Tapping a push opens the thread it names.
   *
   * Registered here, keyed on the signed-in user, rather than in the root
   * layout: `/messaging/*` is not a public route, so a tap handled while
   * signed out is one that route gating turns into a trip to the login
   * screen, and the thread the notification named is gone. Keying it on
   * `user?.id` also means a tap that cold-starts the app while signed out is
   * still honoured — it lands once sign-in completes, rather than being
   * swallowed by a handler that ran too early.
   *
   * The cleanup matters: without it, signing in and out repeatedly stacks
   * listeners, and one tap would navigate once per accumulated listener.
   */
  useEffect(() => {
    if (!user?.id) return;
    return registerNotificationTapHandler();
  }, [user?.id]);

  // Register redirect callback so token-refresh failures can navigate to login
  const setRedirectToLogin = useCallback((fn: () => void) => {
    redirectToLogin.current = fn;
  }, []);

  useEffect(() => {
    setOnRefreshFailed(() => {
      setUser(null);
      redirectToLogin.current?.();
    });
  }, []);

  // Web only: tokens live in localStorage, which every tab on the origin
  // shares. Signing out (or adding an account) in one tab clears them under
  // the others, which would keep showing a user whose requests all 401.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (!isTokenRemovedByOtherTab(e)) return;
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // On mount: try to restore session from stored access token
  useEffect(() => {
    (async () => {
      try {
        const [accessToken, snapshot] = await Promise.all([
          getAccessToken(),
          readUserSnapshot<User>(),
        ]);
        if (!accessToken) {
          setIsLoading(false);
          return;
        }

        // The access token lives 15 minutes, so nearly every cold start is
        // /auth/me -> 401 -> /auth/refresh -> /auth/me: three round trips with
        // the splash held behind them. A token plus a saved profile is enough to
        // open the app now; the checks below still run and replace or clear it.
        if (snapshot) {
          setUser(snapshot);
          setIsLoading(false);
        }

        // Verify token is still valid by fetching /auth/me
        try {
          const apiUser = await apiJson<ApiUser>('/auth/me');
          setUser(toUser(apiUser));
        } catch (err) {
          // Unreachable, not refused: a timeout, an offline device, or a
          // 5xx says nothing about the token. Keep it, open on the last
          // known user if there is one, and let the next request refresh.
          // Clearing here is what sent a teacher back to the login screen
          // from a basement, with credentials nothing could check.
          const serverAnswered = err instanceof ApiError && err.status !== undefined && err.status < 500;
          if (!serverAnswered) {
            // Already shown above; this covers a snapshot that was unreadable then.
            if (!snapshot) setUser(await readUserSnapshot<User>());
            return;
          }
          // Token invalid — try refresh
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            await clearTokens();
            setUser(null);
            setIsLoading(false);
            return;
          }

          try {
            // Needs the deadline more than anywhere else: `setIsLoading(false)`
            // happens in this block's `finally`, and the splash now stays up
            // until that flips.
            const res = await fetchWithTimeout(`${getApiBaseUrl()}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            if (res.ok) {
              const data = await res.json() as { accessToken: string; refreshToken: string };
              await storeTokens(data.accessToken, data.refreshToken);
              const apiUser = await apiJson<ApiUser>('/auth/me');
              setUser(toUser(apiUser));
            } else if (res.status === 400 || res.status === 401 || res.status === 403) {
              await clearTokens();
              setUser(null);
            }
          } catch (refreshErr) {
            if (!isNetworkError(refreshErr)) {
              await clearTokens();
              setUser(null);
            }
          }
        }
      } catch {
        // Storage itself failed; there is no session to keep.
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Whatever the signed-in user is now is what an offline boot opens on;
  // null (sign-out, account deletion) removes it.
  // Not while booting: the first render's null user would delete the snapshot
  // before the boot effect above has read it.
  useEffect(() => {
    if (!isLoading) void saveUserSnapshot(user);
  }, [user, isLoading]);

  // Other accounts on this device. Loaded once; every change below re-reads it.
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountMeta[]>([]);
  const refreshSavedAccounts = useCallback(async () => {
    setSavedAccounts(sortSavedAccounts(await loadSavedAccounts()));
  }, []);
  useEffect(() => {
    void refreshSavedAccounts();
  }, [refreshSavedAccounts]);

  // An account is never both open and saved: its refresh token would exist in
  // two places, and the copy left behind is revoked-on-reuse the first time the
  // open session rotates. This also repairs the one way it could happen — a
  // crash between the two writes of a switch — on the next launch.
  useEffect(() => {
    if (!user?.id) return;
    void removeSavedAccount(user.id).then(had => { if (had) void refreshSavedAccounts(); });
  }, [user?.id, refreshSavedAccounts]);

  // The one place a session is adopted. Everything that signs someone in —
  // password, Google, e-mail verification, a switch — comes through here, so the
  // previous account's cached screens can never be shown to the next one.
  const adoptSession = useCallback(async (accessToken: string, refreshToken: string, apiUser: ApiUser) => {
    await storeTokens(accessToken, refreshToken);
    queryClient.clear();
    setUser(toUser(apiUser));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) throw new ApiError('Email and password are required', 'missing_fields');
    if (!email.includes('@')) throw new ApiError('Invalid email address', 'invalid_email');

    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      },
    );

    await adoptSession(data.accessToken, data.refreshToken, data.user);
  }, [adoptSession]);

  const loginWithGoogle = useCallback(async (
    credential: string,
    signup?: Pick<RegisterData, 'role' | 'acceptedTerms'>,
  ) => {
    // `isNewAccount` is optional on purpose: an app build can outlive the API
    // revision that answers it (and predates it during a rollout). Absent is
    // read as "not a signup", so the count under-reports for a few minutes
    // rather than inventing signups for every returning teacher.
    const data = await apiJson<{
      accessToken: string;
      refreshToken: string;
      user: ApiUser;
      isNewAccount?: boolean;
    }>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({
          credential,
          role: signup?.role,
          // Read only when this credential creates an account; someone
          // signing back in is not asked again.
          acceptedTerms: signup?.acceptedTerms === true,
          termsVersion: LEGAL_VERSION,
        }),
      },
    );

    await adoptSession(data.accessToken, data.refreshToken, data.user);
    // The hint the login screen shows beside the Google button next time.
    void setLastGoogleEmail(data.user.email);
    if (data.isNewAccount) {
      trackEvent('signup_completed', { method: 'google', role: data.user.role });
    }
  }, [adoptSession]);

  const register = useCallback(async (payload: RegisterData) => {
    if (!payload.firstName?.trim()) throw new ApiError('First name is required', 'missing_fields');
    if (!payload.lastName?.trim()) throw new ApiError('Last name is required', 'missing_fields');
    if (!payload.email?.includes('@')) throw new ApiError('Valid email is required', 'invalid_email');
    if (!payload.password || payload.password.length < 8)
      throw new ApiError('Password must be at least 8 characters', 'password_policy');
    if (payload.confirmPassword && payload.confirmPassword !== payload.password)
      throw new ApiError('Passwords do not match', 'passwords_mismatch');

    const data = await apiJson<{ email: string; message: string; emailSent?: boolean }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          email: payload.email.trim(),
          password: payload.password,
          confirmPassword: payload.confirmPassword,
          role: payload.role,
          acceptedTerms: payload.acceptedTerms === true,
          termsVersion: LEGAL_VERSION,
        }),
      },
    );

    trackEvent('signup_started', { method: 'email', role: payload.role ?? 'unspecified' });
    return { email: data.email, emailSent: data.emailSent };
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      },
    );

    await adoptSession(data.accessToken, data.refreshToken, data.user);
    // The account only becomes usable here — /auth/register returns no session.
    // Pairing this with signup_started is what makes the verification drop-off
    // visible at all.
    trackEvent('signup_completed', { method: 'email', role: data.user.role });
  }, [adoptSession]);

  const resendVerification = useCallback(async (email: string) => {
    await apiJson('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  const changeUnverifiedEmail = useCallback(
    async (email: string, password: string, newEmail: string) => {
      const data = await apiJson<{ email: string; message: string; emailSent?: boolean }>(
        '/auth/change-unverified-email',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
            newEmail: newEmail.trim(),
          }),
        },
      );
      return { email: data.email, emailSent: data.emailSent };
    },
    [],
  );

  const forgotPassword = useCallback(async (email: string) => {
    await apiJson('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  /**
   * Deliberately does not sign the user in on success, unlike verifyEmail.
   * The server ends every session the account had — including any an attacker
   * held — and handing back a fresh one here would undo half of that.
   */
  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    await apiJson('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
    });
  }, []);

  const logout = useCallback(async () => {
    await unregisterPushToken();
    try {
      const refreshToken = await getRefreshToken();
      await apiJson('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore errors — clear local state regardless
    }
    try {
      // The native SDK caches the last Google account and `signIn()` silently
      // returns it on the next call, with no account picker — without this, a
      // teacher can never sign up/in with a different Google account from the
      // same device. Throws if Google was never configured on this device
      // (password-only session), which is fine to ignore.
      await GoogleSignin.signOut();
    } catch {
      // Ignore — device may never have used Google sign-in.
    }
    await clearTokens();
    queryClient.clear();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: {
    preferredLanguage?: string;
    firstName?: string;
    lastName?: string;
    gradeIds?: string[];
    subjectIds?: string[];
    teachingAssignments?: TeachingAssignment[];
  }) => {
    const updated = await apiJson<ApiUser>('/auth/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // PATCH /users/profile does not echo hasRosterLink; dropping it would turn
    // a linked student's `true` into "not answered" until the next /auth/me.
    setUser(prev => ({ ...toUser(updated), hasRosterLink: updated.hasRosterLink ?? prev?.hasRosterLink }));
  }, []);

  const uploadAvatar = useCallback(async (dataUrl: string) => {
    const { avatarUrl } = await apiJson<{ avatarUrl: string | null }>('/auth/users/avatar', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
    setUser(prev => (prev ? { ...prev, avatarUrl } : prev));
  }, []);

  const removeAvatar = useCallback(async () => {
    await apiJson<{ avatarUrl: string | null }>('/auth/users/avatar', { method: 'DELETE' });
    setUser(prev => (prev ? { ...prev, avatarUrl: null } : prev));
  }, []);

  const deleteAccount = useCallback(
    async (proof: { password?: string; googleCredential?: string }) => {
      // Push token first, for the same reason logout does it first: after the
      // account is gone the server would refuse the unregister call, and the
      // device would keep a token pointed at a user that no longer exists.
      await unregisterPushToken();
      // No try/catch — unlike logout, a failure here must reach the caller.
      // Clearing local state on a server error would show a signed-out app
      // whose account still exists, which is the one outcome worse than an
      // error message.
      await apiJson('/auth/users/me', {
        method: 'DELETE',
        body: JSON.stringify(proof),
      });
      try {
        // Same reason logout() does this — without it the native SDK still
        // hands back the deleted account's session on the next sign-in.
        await GoogleSignin.signOut();
      } catch {
        // Ignore — device may never have used Google sign-in.
      }
      await clearTokens();
      setUser(null);
    },
    [],
  );

  const markRosterClaimed = useCallback(() => {
    setUser(u => (u ? { ...u, hasRosterLink: true } : u));
  }, []);

  const switchRole = useCallback(async (role: 'teacher' | 'parent' | 'student') => {
    const updated = await apiJson<{ role: UserRole; hasRosterLink?: boolean }>('/auth/role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    // No token refresh: the API re-reads users.role on every request, so the
    // role inside the access token decides nothing (middlewares/auth.ts).
    // `hasRosterLink` is absent for a teacher, where the field is not
    // applicable — dropping it is what clears the routing gate.
    setUser(u => {
      if (!u) return u;
      const { hasRosterLink: _drop, ...rest } = u;
      return updated.hasRosterLink === undefined
        ? { ...rest, role: updated.role }
        : { ...rest, role: updated.role, hasRosterLink: updated.hasRosterLink };
    });
  }, []);

  // A switch or an add runs one at a time: two taps would each read the open
  // session's refresh token and each try to set it aside.
  const accountOpBusy = useRef(false);

  /** The open account, as the list shows it, stamped as having just been used. */
  const metaForOpenAccount = (u: User): SavedAccountMeta => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    lastUsedAt: Date.now(),
  });

  const switchAccount = useCallback(async (targetId: string) => {
    if (user && targetId === user.id) return;
    if (accountOpBusy.current) return;
    accountOpBusy.current = true;
    try {
      const meta = (await loadSavedAccounts()).find(a => a.userId === targetId);
      const savedRefresh = await getSavedRefreshToken(targetId);
      if (!meta || !savedRefresh) {
        await removeSavedAccount(targetId);
        await refreshSavedAccounts();
        throw new ApiError('This account is no longer saved on this device', 'session_expired');
      }

      // 1. Trade the saved refresh token for a live session. This retires the
      //    saved token, so from here on that account's only credential is the
      //    pair in `pair` — it must be stored somewhere before this function
      //    ends, whichever way it ends.
      const res = await fetchWithTimeout(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefresh }),
      });
      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          await removeSavedAccount(targetId);
          await refreshSavedAccounts();
          throw new ApiError("This account's session has expired", 'session_expired');
        }
        throw new ApiError('Could not switch accounts', 'switch_failed');
      }
      const pair = await res.json() as { accessToken: string; refreshToken: string };

      // 2. Read the profile with the new token before committing anything, so a
      //    dropped connection here leaves the open account exactly as it was.
      let apiUser: ApiUser;
      try {
        const me = await fetchWithTimeout(`${getApiBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${pair.accessToken}` },
        });
        if (!me.ok) throw new ApiError('Could not switch accounts', 'switch_failed');
        apiUser = await me.json() as ApiUser;
      } catch (err) {
        // The saved token is spent; keep the new one so the account survives.
        await saveAccount(meta, pair.refreshToken).catch(() => {});
        await refreshSavedAccounts();
        throw err instanceof ApiError ? err : new ApiError('Could not switch accounts', 'switch_failed');
      }

      // 3. Commit, new session first. Between the two writes the old session's
      //    token is in the active slot and nowhere else, or the new one's is —
      //    never one token in both places.
      // After any refresh in flight settles: read mid-rotation, this is the
      // token the server is retiring, and replaying it later revokes the family.
      await awaitPendingRefresh();
      const leavingRefresh = user ? await getRefreshToken() : null;
      await adoptSession(pair.accessToken, pair.refreshToken, apiUser);
      await removeSavedAccount(targetId);
      if (user && leavingRefresh) {
        await saveAccount(metaForOpenAccount(user), leavingRefresh).catch(() => {});
      }
      await refreshSavedAccounts();
    } finally {
      accountOpBusy.current = false;
    }
  }, [user, adoptSession, refreshSavedAccounts]);

  const addAccount = useCallback(async () => {
    if (!user || accountOpBusy.current) return;
    accountOpBusy.current = true;
    try {
      if (isSavedFull(await loadSavedAccounts(), user.id)) throw new Error('too_many_accounts');
      await awaitPendingRefresh();
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('no_session');
      // No server sign-out: that would end the very session being kept.
      await saveAccount(metaForOpenAccount(user), refreshToken);
      await clearTokens();
      try {
        // So the Google chooser appears for the next sign-in instead of the
        // native SDK silently handing back this account again.
        await GoogleSignin.signOut();
      } catch {
        // Google was never configured on this device.
      }
      queryClient.clear();
      setUser(null);
      await refreshSavedAccounts();
    } finally {
      accountOpBusy.current = false;
    }
  }, [user, refreshSavedAccounts]);

  const forgetAccount = useCallback(async (targetId: string) => {
    const savedRefresh = await getSavedRefreshToken(targetId);
    await removeSavedAccount(targetId);
    await refreshSavedAccounts();
    if (!savedRefresh) return;
    // Ending the session on the server is best effort: the device has already
    // let go of it, which is the part the person asked for.
    try {
      const res = await fetchWithTimeout(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefresh }),
      });
      if (!res.ok) return;
      const pair = await res.json() as { accessToken: string; refreshToken: string };
      await fetchWithTimeout(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pair.accessToken}` },
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
      });
    } catch {
      // Offline: the session simply expires on its own.
    }
  }, [refreshSavedAccounts]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        verifyEmail,
        resendVerification,
        changeUnverifiedEmail,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        deleteAccount,
        markRosterClaimed,
        switchRole,
        savedAccounts,
        switchAccount,
        addAccount,
        forgetAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearTokens,
  apiJson,
  setOnRefreshFailed,
  getApiBaseUrl,
} from '@/services/apiClient';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import { setActiveLessonContextUser } from '@/services/lessonContext';
import { setActiveMediaUser } from '@/services/lessonMedia';
import { warmUpVerifier } from '@/services/ai/verifyMath';
import { registerPushToken, unregisterPushToken } from '@/services/pushTokens';
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

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  /** Convenience computed field: firstName + lastName */
  name: string;
  email: string;
  role: UserRole;
  preferredLanguage: 'en' | 'ar';
  createdAt: string;
  /**
   * Whether a parent/student account has claimed any roster row yet. Absent
   * for a teacher (never applicable) — see `needsRosterClaim` in
   * services/routeGating.ts, the gate this field exists for.
   */
  hasRosterLink?: boolean;
  // Legacy optional fields kept for profile screen compatibility
  phone?: string;
  school?: string;
  subjects?: string[];
  grades?: string[];
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
  loginWithGoogle: (credential: string, signup?: Pick<RegisterData, 'role'>) => Promise<void>;
  /**
   * Creates the account but does NOT sign in — a password account starts
   * unverified and the server refuses login until `verifyEmail` succeeds.
   * Returns the email the code was sent to, for the caller to carry to the
   * verify screen (the trimmed/lowercased form the server actually used).
   */
  register: (data: RegisterData) => Promise<{ email: string }>;
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
  changeUnverifiedEmail: (email: string, password: string, newEmail: string) => Promise<{ email: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { preferredLanguage?: string; firstName?: string; lastName?: string }) => Promise<void>;
  /**
   * Irreversible. Pass `password` for an ordinary account, or `confirmEmail`
   * for a Google-only one — the server picks which it will accept based on
   * whether the account has a password hash at all, and refuses 401 otherwise.
   */
  deleteAccount: (proof: { password?: string; confirmEmail?: string }) => Promise<void>;
  /**
   * Flips `hasRosterLink` to true locally right after a successful
   * `POST /auth/claim`, so the routing gate clears without a round trip to
   * `/auth/me` just to learn something this call already knows.
   */
  markRosterClaimed: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

type ApiUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  preferredLanguage: string;
  createdAt: string;
  lastLogin?: string;
  hasRosterLink?: boolean;
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
    createdAt: apiUser.createdAt,
    hasRosterLink: apiUser.hasRosterLink,
    subjects: [],
    grades: [],
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
  useEffect(() => {
    setActiveLessonContextUser(user?.id ?? null);
    setActiveMediaUser(user?.id ?? null);
    // Signed in → the teacher will likely generate materials shortly. Wake
    // the sleeping verifier now so the symbolic badge is available when they
    // do, instead of silently degrading to the bank label. The route needs a
    // token, so this cannot run any earlier than here.
    if (user?.id) {
      warmUpVerifier();
      void registerPushToken();
    }
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

  // On mount: try to restore session from stored access token
  useEffect(() => {
    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setIsLoading(false);
          return;
        }

        // Verify token is still valid by fetching /auth/me
        try {
          const apiUser = await apiJson<ApiUser>('/auth/me');
          setUser(toUser(apiUser));
        } catch {
          // Token invalid — try refresh
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            await clearTokens();
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
            } else {
              await clearTokens();
            }
          } catch {
            await clearTokens();
          }
        }
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) throw new Error('Email and password are required');
    if (!email.includes('@')) throw new Error('Invalid email address');

    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      },
    );

    await storeTokens(data.accessToken, data.refreshToken);
    setUser(toUser(data.user));
  }, []);

  const loginWithGoogle = useCallback(async (
    credential: string,
    signup?: Pick<RegisterData, 'role'>,
  ) => {
    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({
          credential,
          role: signup?.role,
        }),
      },
    );

    await storeTokens(data.accessToken, data.refreshToken);
    setUser(toUser(data.user));
  }, []);

  const register = useCallback(async (payload: RegisterData) => {
    if (!payload.firstName?.trim()) throw new Error('First name is required');
    if (!payload.lastName?.trim()) throw new Error('Last name is required');
    if (!payload.email?.includes('@')) throw new Error('Valid email is required');
    if (!payload.password || payload.password.length < 8)
      throw new Error('Password must be at least 8 characters');
    if (payload.confirmPassword && payload.confirmPassword !== payload.password)
      throw new Error('Passwords do not match');

    const data = await apiJson<{ email: string; message: string }>(
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
        }),
      },
    );

    return { email: data.email };
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      },
    );

    await storeTokens(data.accessToken, data.refreshToken);
    setUser(toUser(data.user));
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await apiJson('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  const changeUnverifiedEmail = useCallback(
    async (email: string, password: string, newEmail: string) => {
      const data = await apiJson<{ email: string; message: string }>(
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
      return { email: data.email };
    },
    [],
  );

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
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: {
    preferredLanguage?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    const updated = await apiJson<ApiUser>('/auth/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    setUser(toUser(updated));
  }, []);

  const deleteAccount = useCallback(
    async (proof: { password?: string; confirmEmail?: string }) => {
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
        logout,
        updateProfile,
        deleteAccount,
        markRosterClaimed,
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

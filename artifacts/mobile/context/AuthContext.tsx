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
import { setActiveLessonContextUser } from '@/services/lessonContext';
import { setActiveMediaUser } from '@/services/lessonMedia';
import { warmUpVerifier } from '@/services/ai/verifyMath';
import { registerPushToken, unregisterPushToken } from '@/services/pushTokens';

export type UserRole = 'teacher' | 'school_admin' | 'system_admin' | 'student' | 'parent';

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
  /** Required when role is 'student' or 'parent' — see services/messaging.ts. */
  claimCode?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>;
  updateProfile: (data: { preferredLanguage?: string; firstName?: string; lastName?: string }) => Promise<void>;
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
            const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
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

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ credential }),
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
    if (payload.role && payload.role !== 'teacher' && !payload.claimCode?.trim())
      throw new Error('A class code is required');

    const data = await apiJson<{ accessToken: string; refreshToken: string; user: ApiUser }>(
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
          claimCode: payload.claimCode?.trim(),
        }),
      },
    );

    await storeTokens(data.accessToken, data.refreshToken);
    setUser(toUser(data.user));
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
    await clearTokens();
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    if (!email?.includes('@')) throw new Error('Valid email is required');
    await apiJson('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }, []);

  const resetPassword = useCallback(async (
    token: string,
    password: string,
    confirmPassword: string,
  ) => {
    await apiJson('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    });
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
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

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'teacher' | 'school_admin' | 'system_admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  subjects: string[];
  grades: string[];
  language: 'en' | 'ar';
  role: UserRole;
  profilePhoto?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  school?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = '@iqra_user';
const TOKEN_KEY = '@iqra_token';

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_KEY);
        if (stored) setUser(JSON.parse(stored));
      } catch (e) {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) throw new Error('Email and password are required');
    if (!email.includes('@')) throw new Error('Invalid email address');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');

    // Mock login - simulate network delay
    await new Promise(r => setTimeout(r, 800));

    const mockUser: User = {
      id: generateId(),
      name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email,
      school: 'Al-Hashimiyya Secondary School',
      subjects: ['Mathematics', 'Science'],
      grades: ['Grade 9', 'Grade 10', 'Grade 11'],
      language: 'en',
      role: 'teacher',
    };

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(mockUser));
    await AsyncStorage.setItem(TOKEN_KEY, 'mock-jwt-token-' + generateId());
    setUser(mockUser);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    if (!data.name) throw new Error('Name is required');
    if (!data.email || !data.email.includes('@')) throw new Error('Valid email is required');
    if (!data.password || data.password.length < 6) throw new Error('Password must be at least 6 characters');

    await new Promise(r => setTimeout(r, 1000));

    const newUser: User = {
      id: generateId(),
      name: data.name,
      email: data.email,
      school: data.school ?? '',
      subjects: [],
      grades: [],
      language: 'en',
      role: 'teacher',
    };

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem(TOKEN_KEY, 'mock-jwt-token-' + generateId());
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUser(updated);
  }, [user]);

  const forgotPassword = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) throw new Error('Valid email is required');
    await new Promise(r => setTimeout(r, 800));
    // Mock - just succeeds
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

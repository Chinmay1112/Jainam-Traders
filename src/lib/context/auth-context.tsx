'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { UserProfile, UserRole } from '@/lib/types';
import { StaffRole } from '@/lib/auth/staff-roles';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

interface AuthContextType {
  user: UserProfile | null;
  staffUser: StaffUser | null;
  role: UserRole;
  isAuthenticated: boolean;
  isStaffAuthenticated: boolean;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; isStaff?: boolean; role?: string; error?: string; redirectTo?: string }>;
  signup: (data: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithVerifiedProfile: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  logoutStaff: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  checkStaffSession: () => Promise<StaffUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUserToProfile(sbUser: User): UserProfile {
  return {
    id: sbUser.id,
    fullName:
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.email?.split('@')[0] ||
      'Valued Customer',
    email: sbUser.email,
    phone: sbUser.phone || sbUser.user_metadata?.phone || undefined,
    role: 'customer',
    avatarUrl: sbUser.user_metadata?.avatar_url || undefined,
    savedAddress: sbUser.user_metadata?.saved_address || undefined,
    createdAt: sbUser.created_at || new Date().toISOString(),
    updatedAt: sbUser.updated_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize browser Supabase client
  const supabase = useMemo(() => createClient(), []);

  // Listen to Supabase Auth state changes (Google OAuth, Email OTP)
  useEffect(() => {
    let isMounted = true;

    // 1. Initial check
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (!error && session?.user) {
          setUser(mapSupabaseUserToProfile(session.user));
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // 2. Subscribe to live auth events (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(mapSupabaseUserToProfile(session.user));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Check verified staff session from server cookie (STAFF ONLY)
  const checkStaffSession = async (): Promise<StaffUser | null> => {
    try {
      const res = await fetch('/api/auth/staff/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.staff) {
          setStaffUser(data.staff);
          return data.staff;
        }
      }
    } catch {
      // ignore
    }
    setStaffUser(null);
    return null;
  };

  useEffect(() => {
    checkStaffSession();
  }, []);

  const login = async (identifier: string, passwordPlain: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password: passwordPlain }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid email or password.' };
      }

      if (data.isStaff) {
        // Staff authenticated - update staff session immediately
        await checkStaffSession();
        return { success: true, isStaff: true, role: data.role, redirectTo: data.redirectTo || '/admin' };
      }

      // Customer authenticated
      if (data.user) {
        setUser({
          id: data.user.id,
          fullName: data.user.fullName,
          email: data.user.email,
          phone: data.user.phone,
          role: 'customer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return { success: true, isStaff: false, role: 'customer', redirectTo: data.redirectTo || '/' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: msg };
    }
  };

  const signup = async (data: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    password: string;
  }) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || 'Failed to create account.' };
      }

      if (resData.user) {
        setUser({
          id: resData.user.id,
          fullName: resData.user.fullName,
          email: resData.user.email,
          phone: resData.user.phone,
          role: 'customer',
          savedAddress: data.address,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      return { success: false, error: msg };
    }
  };

  const loginWithVerifiedProfile = (profile: UserProfile) => {
    setUser({ ...profile, role: 'customer' });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof document !== 'undefined') {
        document.cookie = 'jt_customer_token=; path=/; max-age=0;';
      }
    } catch {
      // ignore
    }
    setUser(null);
  };

  const logoutStaff = async () => {
    try {
      await fetch('/api/auth/staff/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStaffUser(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: data.fullName,
          phone: data.phone,
          saved_address: data.savedAddress,
        },
      });
    } catch {
      // ignore
    }
    setUser((prev) => (prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staffUser,
        role: staffUser ? (staffUser.role as UserRole) : 'customer',
        isAuthenticated: !!user,
        isStaffAuthenticated: !!staffUser,
        isLoading,
        login,
        signup,
        loginWithVerifiedProfile,
        logout,
        logoutStaff,
        updateProfile,
        checkStaffSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

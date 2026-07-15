'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isChecking: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsAuthenticated(true);
            setUsername(session.user.email?.split('@')[0] || 'admin');
          } else {
            // Check if there is a local session backup (for offline recovery)
            const localSession = localStorage.getItem('bhawani_local_session');
            if (localSession) {
              setIsAuthenticated(true);
              setUsername(localSession);
            }
          }
        } else {
          // Local Mode session restore
          const localSession = localStorage.getItem('bhawani_local_session');
          if (localSession) {
            setIsAuthenticated(true);
            setUsername(localSession);
          }
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (!isChecking) {
      if (!isAuthenticated && pathname !== '/login') {
        router.replace('/login');
      } else if (isAuthenticated && pathname === '/login') {
        router.replace('/');
      }
    }
  }, [isAuthenticated, isChecking, pathname, router]);

  // Login handler
  const login = async (userVal: string, passVal: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured() && supabase) {
        // Map username to virtual email for Supabase Auth
        const virtualEmail = `${userVal.trim().toLowerCase()}@bhawani.com`;
        const { error, data } = await supabase.auth.signInWithPassword({
          email: virtualEmail,
          password: passVal
        });

        if (error) {
          // If network is offline, check if we can log in with the last cached session
          const cachedPass = localStorage.getItem('bhawani_cached_password');
          const cachedUser = localStorage.getItem('bhawani_local_session');
          if (cachedUser === userVal && cachedPass === passVal) {
            setIsAuthenticated(true);
            setUsername(userVal);
            return true;
          }
          console.error('Supabase Login Error:', error.message);
          return false;
        }

        if (data.session) {
          setIsAuthenticated(true);
          setUsername(userVal);
          localStorage.setItem('bhawani_local_session', userVal);
          localStorage.setItem('bhawani_cached_password', passVal); // Store hash/password for offline verification
          return true;
        }
      } else {
        // Local-Only Mode authentication
        // Default username 'admin', password 'password'
        // Allow customize later in settings
        const localUser = 'admin';
        const localPass = 'password';

        if (userVal.trim().toLowerCase() === localUser && passVal === localPass) {
          setIsAuthenticated(true);
          setUsername(userVal);
          localStorage.setItem('bhawani_local_session', userVal);
          localStorage.setItem('bhawani_cached_password', passVal);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Login process encountered error:', err);
      return false;
    }
  };

  // Logout handler
  const logout = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setUsername('');
    localStorage.removeItem('bhawani_local_session');
    localStorage.removeItem('bhawani_cached_password');
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout, isChecking }}>
      {children}
    </AuthContext.Provider>
  );
};

// context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { login as apiLogin, register as apiRegister, getCurrentUser, setUnauthorizedHandler, warmupServer } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthService } from '../services/healthService';
import { healthLinkService } from '../services/healthLinkService';
import { healthImportService } from '../services/healthImportService';

interface User {
  _id: string;
  username?: string;
  email: string;
  totalDiamonds?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (username: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authInFlightRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Best-effort: keep storage consistent even if the interceptor behavior changes.
      // (We intentionally don't await here.)
      AsyncStorage.removeItem('userToken').catch(() => {});
      setToken(null);
      setUser(null);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        // Warmup in background (does not block UI)
        warmupServer();

        const storedToken = await AsyncStorage.getItem('userToken');
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('🔎 [Auth] stored token', storedToken ? 'present' : 'absent');
        }
        if (storedToken) {
          setToken(storedToken);
          const currentUser = await getCurrentUser();
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log('✅ [Auth] user loaded from storage', currentUser?._id);
          }
          setUser(currentUser);
        }
      } catch (e) {
        console.error("Failed to load user from storage", e);
        await AsyncStorage.removeItem('userToken');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);

  const login = async (email: string, pass: string) => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;

    const previousToken = tokenRef.current;
    setIsLoading(true);
    try {
      const response = await apiLogin(email, pass);
      await AsyncStorage.setItem('userToken', response.token);
      setToken(response.token);
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Best-effort: finalize a pending health link prepared on the auth screen.
      const pending = await healthService.getPendingLink();
      if (pending) {
        await healthLinkService.updateHealthStatus({
          provider: pending.provider,
          linked: true,
          autoImport: pending.autoImport,
          permissions: pending.permissions,
        });
        await healthService.clearPendingLink();
      }

      // Best-effort: background auto-import if enabled.
      setTimeout(() => {
        healthImportService.autoImportIfEnabled().catch(() => {});
      }, 0);
    } catch (error) {
      console.error('Login failed', error);

      // If there was no prior session, clean up storage/state.
      // If there was a prior session (user already logged in), don't wipe it because a re-login attempt failed.
      if (!previousToken) {
        await AsyncStorage.removeItem('userToken');
        setToken(null);
        setUser(null);
      }

      throw error;
    } finally {
      setIsLoading(false);
      authInFlightRef.current = false;
    }
  };

  const register = async (username: string, email: string, pass: string) => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;

    const previousToken = tokenRef.current;
    setIsLoading(true);
    try {
      const response = await apiRegister(email, pass, username);
      await AsyncStorage.setItem('userToken', response.token);
      setToken(response.token);
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Best-effort: finalize a pending health link prepared on the auth screen.
      const pending = await healthService.getPendingLink();
      if (pending) {
        await healthLinkService.updateHealthStatus({
          provider: pending.provider,
          linked: true,
          autoImport: pending.autoImport,
          permissions: pending.permissions,
        });
        await healthService.clearPendingLink();
      }

      // Best-effort: background auto-import if enabled.
      setTimeout(() => {
        healthImportService.autoImportIfEnabled().catch(() => {});
      }, 0);
    } catch (error) {
      console.error('Registration failed', error);

      if (!previousToken) {
        await AsyncStorage.removeItem('userToken');
        setToken(null);
        setUser(null);
      }

      throw error;
    } finally {
      setIsLoading(false);
      authInFlightRef.current = false;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('userToken');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ AJOUTÉ : Recharger le profil utilisateur (pour les diamants)
  const reloadUser = async () => {
    if (!token) return;
    
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ Profil rechargé, diamants:', currentUser.totalDiamonds);
      }
    } catch (error) {
      console.error('Erreur reload user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isAuthenticated: !!token, 
      isLoading, 
      login, 
      register, 
      logout,
      reloadUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
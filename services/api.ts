import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

// --- Type Definitions ---
interface User {
  _id: string;
  username?: string;
  email: string;
  createdAt: string;
  totalDiamonds?: number;
}

interface AuthResponse {
  _id: string;
  username?: string;
  email: string;
  token: string;
}

let unauthorizedHandler: (() => void) | null = null;

// Allows AuthContext to stay in sync when the API detects an invalid/expired token.
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

const extractApiErrorMessage = (error: any): string => {
  // Network / DNS / CORS / offline / backend sleeping
  if (!error?.response) {
    const code = error?.code;
    if (code === 'ECONNABORTED') {
      return "Délai dépassé. Le serveur ne répond pas (vérifie ta connexion / l'URL API).";
    }

    // axios network error message is often just 'Network Error'
    return "Impossible de joindre le serveur (vérifie ta connexion / l'URL API).";
  }

  const data = error?.response?.data;

  if (typeof data === 'string') return data;

  const message = data?.message;
  if (typeof message === 'string' && message.trim()) return message;

  // express-validator style: { message: 'Invalid input', errors: [{ field, message }] }
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    const msg = first?.message || first?.msg;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  // Fallback axios
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;

  return "Une erreur est survenue.";
};

// Create an Axios instance
const api = axios.create({
  baseURL: API_URL,
  // Avoid infinite spinners when the backend is down/sleeping.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getServerBaseUrl = (): string => {
  // Our API_URL is normalized to end with /api in this app.
  return API_URL.replace(/\/api\/?$/, '');
};

// Wake up free-tier hosts (Render) in the background.
// Hits /health (note: not under /api).
export const warmupServer = async (): Promise<void> => {
  try {
    const base = getServerBaseUrl();
    const url = `${base}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
  } catch {
    // Ignore warmup failures
  }
};

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('🔗 [api] baseURL =', API_URL);
}

// Dev-only: log request timings (do NOT log bodies/credentials)
type RequestMeta = { start: number };

const shouldLogRequest = (url?: string) => {
  if (!url) return false;
  return (
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/register') ||
    url.startsWith('/users/profile')
  );
};

// ✅ INTERCEPTEUR DE REQUÊTE - Ajoute automatiquement le token à chaque requête
api.interceptors.request.use(
  async (config) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (config as any).metadata = { start: Date.now() } as RequestMeta;
      if (shouldLogRequest(config.url)) {
        const method = (config.method || 'GET').toUpperCase();
        console.log(`➡️ [api] ${method} ${config.baseURL || ''}${config.url || ''}`);
      }
    }

    const url = config.url || '';

    // Never attach a potentially stale Bearer token to auth endpoints.
    if (url.startsWith('/auth/')) {
      return config;
    }

    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      // Axios headers can be undefined depending on runtime.
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ INTERCEPTEUR DE RÉPONSE - Gère les erreurs 401 (token invalide/expiré)
api.interceptors.response.use(
  (response) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const cfg: any = response.config;
      const meta: RequestMeta | undefined = cfg?.metadata;
      if (shouldLogRequest(cfg?.url)) {
        const method = (cfg?.method || 'GET').toUpperCase();
        const ms = meta?.start ? Date.now() - meta.start : undefined;
        console.log(`⬅️ [api] ${method} ${cfg?.url} ${response.status}${ms != null ? ` (${ms}ms)` : ''}`);
      }
    }
    return response;
  },
  async (error) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const cfg: any = error?.config;
      const meta: RequestMeta | undefined = cfg?.metadata;
      if (shouldLogRequest(cfg?.url)) {
        const method = (cfg?.method || 'GET').toUpperCase();
        const status = error?.response?.status;
        const code = error?.code;
        const ms = meta?.start ? Date.now() - meta.start : undefined;
        console.log(
          `⬅️ [api] ${method} ${cfg?.url} ERROR ${status ?? code ?? 'unknown'}${ms != null ? ` (${ms}ms)` : ''}`
        );
      }
    }

    const status = error.response?.status;
    const url: string = error?.config?.url || '';

    // 401 during login/register is a normal auth failure; don't wipe an existing session.
    const isAuthEndpoint = url.startsWith('/auth/');

    if (status === 401 && !isAuthEndpoint) {
      // Token invalide ou expiré : on nettoie le storage
      await AsyncStorage.removeItem('userToken');
      console.warn('Token invalide ou expiré. Déconnexion nécessaire.');

      // Keep in-memory auth state consistent (AuthContext)
      try {
        unauthorizedHandler?.();
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Register a new user
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<AuthResponse>} The response data
 */
export const register = async (email: string, password: string, username: string): Promise<AuthResponse> => {
  try {
    // Best-effort warmup for cold-start hosts (Render/free tier)
    await warmupServer();
    // Render/free instances may cold-start; give auth a longer timeout.
    const response = await api.post<AuthResponse>(
      '/auth/register',
      { email, password, username },
      { timeout: 60000 }
    );
    if (response.data.token) {
      await AsyncStorage.setItem('userToken', response.data.token);
    }
    return response.data;
  } catch (error: any) {
    // Retry once on pure network errors (no HTTP response)
    if (!error?.response) {
      try {
        await warmupServer();
        const response = await api.post<AuthResponse>(
          '/auth/register',
          { email, password, username },
          { timeout: 60000 }
        );
        if (response.data.token) {
          await AsyncStorage.setItem('userToken', response.data.token);
        }
        return response.data;
      } catch (e: any) {
        throw new Error(extractApiErrorMessage(e));
      }
    }
    throw new Error(extractApiErrorMessage(error));
  }
};

/**
 * Login a user
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<AuthResponse>} The response data
 */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    // Best-effort warmup for cold-start hosts (Render/free tier)
    await warmupServer();
    // Render/free instances may cold-start; give auth a longer timeout.
    const response = await api.post<AuthResponse>(
      '/auth/login',
      { email, password },
      { timeout: 60000 }
    );
    if (response.data.token) {
      await AsyncStorage.setItem('userToken', response.data.token);
    }
    return response.data;
  } catch (error: any) {
    // Retry once on pure network errors (no HTTP response)
    if (!error?.response) {
      try {
        await warmupServer();
        const response = await api.post<AuthResponse>(
          '/auth/login',
          { email, password },
          { timeout: 60000 }
        );
        if (response.data.token) {
          await AsyncStorage.setItem('userToken', response.data.token);
        }
        return response.data;
      } catch (e: any) {
        throw new Error(extractApiErrorMessage(e));
      }
    }
    throw new Error(extractApiErrorMessage(error));
  }
};

/**
 * Get the current user's profile
 * @returns {Promise<User>} The user's profile data
 */
export const getCurrentUser = async (): Promise<User> => {
  try {
    // ✅ Plus besoin d'ajouter manuellement le token, l'intercepteur s'en charge
    const response = await api.get<User>('/users/profile', { timeout: 60000 });
    return response.data;
  } catch (error: any) {
    throw new Error(extractApiErrorMessage(error));
  }
};

export default api;
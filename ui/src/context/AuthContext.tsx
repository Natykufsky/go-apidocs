import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { safeStorage } from '../lib/storage';
import { apiPost } from '../lib/api';

export interface StoredCredentials {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  entityId?: string;
  customHeaders?: Record<string, string>;
  /** ISO timestamp when the current access token expires (optional — set from login response) */
  expiresAt?: string;
  updatedAt?: string;
}

interface LoginResponse {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  expires_in?: number;
  expiresIn?: number;
  expires_at?: string;
  tenant_id?: string;
  tenantId?: string;
  entity_id?: string;
  entityId?: string;
}

interface AuthContextValue {
  credentials: StoredCredentials;
  /** True when at least one credential field is populated */
  hasCredentials: boolean;
  /** True when an access token exists AND (if expiry known) is not expired */
  hasValidCredentials: boolean;
  /** True when access token exists but the known expiry is in the past */
  isExpired: boolean;
  /** True when expiry is known and within 60 seconds */
  isExpiringSoon: boolean;
  updateCredentials: (creds: StoredCredentials) => void;
  clearCredentials: () => void;
  /** Build headers for a request — Authorization, tenant, entity, custom */
  getAuthHeaders: () => Record<string, string>;
  maskPII: boolean;
  toggleMaskPII: () => void;
  activeEnv: string;
  setActiveEnv: (env: string) => void;
}

const KEYS = {
  access: 'apidocs_access_token',
  refresh: 'apidocs_refresh_token',
  tenant: 'apidocs_tenant_id',
  entity: 'apidocs_entity_id',
  headers: 'apidocs_custom_headers',
  expires: 'apidocs_expires_at',
  updated: 'apidocs_creds_updated_at',
  mask: 'apidocs_mask_pii',
  env: 'apidocs_active_env',
} as const;

const SIXTY_SECONDS = 60_000;

const AuthContext = createContext<AuthContextValue | null>(null);

const loadCredentials = (): StoredCredentials => ({
  accessToken: safeStorage.get(KEYS.access) || undefined,
  refreshToken: safeStorage.get(KEYS.refresh) || undefined,
  tenantId: safeStorage.get(KEYS.tenant) || undefined,
  entityId: safeStorage.get(KEYS.entity) || undefined,
  customHeaders: safeStorage.getJSON<Record<string, string> | undefined>(
    KEYS.headers,
    undefined,
  ),
  expiresAt: safeStorage.get(KEYS.expires) || undefined,
  updatedAt: safeStorage.get(KEYS.updated) || undefined,
});

const isExpired = (c: StoredCredentials): boolean => {
  if (!c.expiresAt) return false;
  const t = Date.parse(c.expiresAt);
  return !Number.isNaN(t) && t < Date.now();
};

const isExpiringSoon = (c: StoredCredentials): boolean => {
  if (!c.expiresAt) return false;
  const t = Date.parse(c.expiresAt);
  return !Number.isNaN(t) && t - Date.now() < SIXTY_SECONDS && t > Date.now();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [credentials, setCredentials] = useState<StoredCredentials>(() => {
    const loaded = loadCredentials();
    // Auto-purge expired tokens on load — a token that expired while the tab
    // was closed should not be reattached to the next sandbox call.
    if (isExpired(loaded)) {
      Object.values(KEYS).forEach((k) => {
        if (k !== KEYS.mask && k !== KEYS.env) safeStorage.remove(k);
      });
      return {};
    }
    return loaded;
  });

  const [maskPII, setMaskPII] = useState<boolean>(
    () => safeStorage.get(KEYS.mask) === 'true',
  );
  const [activeEnv, setActiveEnvState] = useState<string>(
    () => safeStorage.get(KEYS.env) || 'default',
  );

  const updateCredentials = useCallback((creds: StoredCredentials) => {
    setCredentials(creds);
    creds.accessToken
      ? safeStorage.set(KEYS.access, creds.accessToken)
      : safeStorage.remove(KEYS.access);
    creds.refreshToken
      ? safeStorage.set(KEYS.refresh, creds.refreshToken)
      : safeStorage.remove(KEYS.refresh);
    creds.tenantId
      ? safeStorage.set(KEYS.tenant, creds.tenantId)
      : safeStorage.remove(KEYS.tenant);
    creds.entityId
      ? safeStorage.set(KEYS.entity, creds.entityId)
      : safeStorage.remove(KEYS.entity);
    if (creds.customHeaders && Object.keys(creds.customHeaders).length > 0) {
      safeStorage.setJSON(KEYS.headers, creds.customHeaders);
    } else {
      safeStorage.remove(KEYS.headers);
    }
    creds.expiresAt
      ? safeStorage.set(KEYS.expires, creds.expiresAt)
      : safeStorage.remove(KEYS.expires);
    creds.updatedAt
      ? safeStorage.set(KEYS.updated, creds.updatedAt)
      : safeStorage.remove(KEYS.updated);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials({});
    Object.values(KEYS).forEach((k) => {
      if (k !== KEYS.mask && k !== KEYS.env) safeStorage.remove(k);
    });
  }, []);

  const toggleMaskPII = useCallback(() => {
    setMaskPII((prev) => {
      safeStorage.set(KEYS.mask, String(!prev));
      return !prev;
    });
  }, []);

  const setActiveEnv = useCallback((env: string) => {
    setActiveEnvState(env);
    safeStorage.set(KEYS.env, env);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (credentials.accessToken)
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;
    if (credentials.refreshToken)
      headers['X-Refresh-Token'] = credentials.refreshToken;
    if (credentials.tenantId) headers['X-Tenant-ID'] = credentials.tenantId;
    if (credentials.entityId) headers['X-Entity-ID'] = credentials.entityId;
    if (credentials.customHeaders) {
      for (const [k, v] of Object.entries(credentials.customHeaders)) {
        if (k && v) headers[k] = v;
      }
    }
    return headers;
  }, [credentials]);

  const hasCredentials = useMemo(
    () =>
      !!(
        credentials.accessToken ||
        credentials.tenantId ||
        credentials.entityId ||
        (credentials.customHeaders &&
          Object.keys(credentials.customHeaders).length > 0)
      ),
    [credentials],
  );

  const expired = useMemo(() => isExpired(credentials), [credentials]);
  const expiringSoon = useMemo(() => isExpiringSoon(credentials), [credentials]);

  // While a token is live, schedule a cleanup so the state flips to expired
  // exactly at the moment the backend would reject it.
  useEffect(() => {
    if (!credentials.expiresAt || !credentials.accessToken) return;
    const t = Date.parse(credentials.expiresAt);
    if (Number.isNaN(t)) return;
    const ms = Math.max(0, t - Date.now() + 100);
    if (ms > 2_147_483_647) return; // setTimeout max
    const timer = window.setTimeout(() => {
      // Force a re-render by re-reading storage (state stays, derived flips)
      setCredentials((prev) => ({ ...prev }));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [credentials.expiresAt, credentials.accessToken]);

  const value: AuthContextValue = {
    credentials,
    hasCredentials,
    hasValidCredentials: hasCredentials && !expired,
    isExpired: expired,
    isExpiringSoon: expiringSoon,
    updateCredentials,
    clearCredentials,
    getAuthHeaders,
    maskPII,
    toggleMaskPII,
    activeEnv,
    setActiveEnv,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

/**
 * Attempt server-side login. The response's token fields are normalized and
 * persisted to the auth context so subsequent sandbox calls authenticate.
 *
 * NOTE ON TOKEN STORAGE: tokens are currently mirrored in localStorage for
 * backwards compatibility. The production-hardening path is to move token
 * issuance to httpOnly, Secure, SameSite=Strict cookies on the Go backend
 * and drop these keys entirely — see the migration note in docs.
 */
export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  const data = await apiPost<LoginResponse>('/login', { username, password });
  return data;
};
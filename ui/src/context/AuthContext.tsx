import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { safeStorage } from '../lib/storage';
import { apiPost } from '../lib/api';
import {
  decodeJwtExpiry,
  extractTokensFromPayload,
  mergeExtractedCredentials,
} from '../lib/tokenUtils';

export interface StoredCredentials {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  entityId?: string;
  customHeaders?: Record<string, string>;
  /** ISO timestamp when the current access token expires (optional — set from login response or JWT exp) */
  expiresAt?: string;
  /** Optional custom or auto-detected endpoint path to exchange refresh_token for a new access_token */
  refreshEndpoint?: string;
  /** Whether silent background / 401 auto-refresh is enabled (defaults to true) */
  autoRefresh?: boolean;
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
  /** True while a silent token refresh request is in flight */
  isRefreshing: boolean;
  updateCredentials: (creds: StoredCredentials) => void;
  clearCredentials: () => void;
  /** Exchange the stored refresh token for a fresh access token */
  refreshAccessToken: (overrideEndpoint?: string) => Promise<StoredCredentials | null>;
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
  refreshEndpoint: 'apidocs_refresh_endpoint',
  autoRefresh: 'apidocs_auto_refresh',
  updated: 'apidocs_creds_updated_at',
  mask: 'apidocs_mask_pii',
  env: 'apidocs_active_env',
} as const;

const SIXTY_SECONDS = 60_000;

const DEFAULT_REFRESH_CANDIDATES = [
  '/api/v1/auth/refresh',
  '/auth/refresh',
  '/api/auth/refresh',
  '/oauth/token',
];

const AuthContext = createContext<AuthContextValue | null>(null);

const loadCredentials = (): StoredCredentials => {
  const accessToken = safeStorage.get(KEYS.access) || undefined;
  const storedExpires = safeStorage.get(KEYS.expires) || undefined;
  const autoRefreshRaw = safeStorage.get(KEYS.autoRefresh);
  return {
    accessToken,
    refreshToken: safeStorage.get(KEYS.refresh) || undefined,
    tenantId: safeStorage.get(KEYS.tenant) || undefined,
    entityId: safeStorage.get(KEYS.entity) || undefined,
    customHeaders: safeStorage.getJSON<Record<string, string> | undefined>(
      KEYS.headers,
      undefined,
    ),
    expiresAt: storedExpires || (accessToken ? decodeJwtExpiry(accessToken) : undefined),
    refreshEndpoint: safeStorage.get(KEYS.refreshEndpoint) || undefined,
    autoRefresh: autoRefreshRaw === null ? true : autoRefreshRaw !== 'false',
    updatedAt: safeStorage.get(KEYS.updated) || undefined,
  };
};

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
    // If the access token expired while the tab was closed and there is NO
    // refresh token to recover it, purge the stale access token. If a refresh
    // token is present, keep it so auto-refresh can silently renew the session!
    if (isExpired(loaded) && !loaded.refreshToken) {
      safeStorage.remove(KEYS.access);
      safeStorage.remove(KEYS.expires);
      return {
        ...loaded,
        accessToken: undefined,
        expiresAt: undefined,
      };
    }
    return loaded;
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const inFlightRefreshRef = useRef<Promise<StoredCredentials | null> | null>(null);
  const credentialsRef = useRef<StoredCredentials>(credentials);
  useEffect(() => {
    credentialsRef.current = credentials;
  }, [credentials]);

  const [maskPII, setMaskPII] = useState<boolean>(
    () => safeStorage.get(KEYS.mask) === 'true',
  );
  const [activeEnv, setActiveEnvState] = useState<string>(
    () => safeStorage.get(KEYS.env) || 'default',
  );

  const updateCredentials = useCallback((creds: StoredCredentials) => {
    const resolvedExpires =
      creds.expiresAt ||
      (creds.accessToken ? decodeJwtExpiry(creds.accessToken) : undefined);
    const normalized: StoredCredentials = {
      ...creds,
      expiresAt: resolvedExpires,
      autoRefresh: creds.autoRefresh ?? true,
    };

    setCredentials(normalized);
    credentialsRef.current = normalized;

    normalized.accessToken
      ? safeStorage.set(KEYS.access, normalized.accessToken)
      : safeStorage.remove(KEYS.access);
    normalized.refreshToken
      ? safeStorage.set(KEYS.refresh, normalized.refreshToken)
      : safeStorage.remove(KEYS.refresh);
    normalized.tenantId
      ? safeStorage.set(KEYS.tenant, normalized.tenantId)
      : safeStorage.remove(KEYS.tenant);
    normalized.entityId
      ? safeStorage.set(KEYS.entity, normalized.entityId)
      : safeStorage.remove(KEYS.entity);
    if (normalized.customHeaders && Object.keys(normalized.customHeaders).length > 0) {
      safeStorage.setJSON(KEYS.headers, normalized.customHeaders);
    } else {
      safeStorage.remove(KEYS.headers);
    }
    normalized.expiresAt
      ? safeStorage.set(KEYS.expires, normalized.expiresAt)
      : safeStorage.remove(KEYS.expires);
    normalized.refreshEndpoint
      ? safeStorage.set(KEYS.refreshEndpoint, normalized.refreshEndpoint)
      : safeStorage.remove(KEYS.refreshEndpoint);
    safeStorage.set(KEYS.autoRefresh, String(normalized.autoRefresh !== false));
    normalized.updatedAt
      ? safeStorage.set(KEYS.updated, normalized.updatedAt)
      : safeStorage.remove(KEYS.updated);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials({});
    credentialsRef.current = {};
    Object.values(KEYS).forEach((k) => {
      if (k !== KEYS.mask && k !== KEYS.env) safeStorage.remove(k);
    });
  }, []);

  /**
   * Exchange the stored `refreshToken` for a new `accessToken`.
   * Deduplicates concurrent calls so multiple 401s or timers only trigger one network request.
   */
  const refreshAccessToken = useCallback(
    async (overrideEndpoint?: string): Promise<StoredCredentials | null> => {
      if (inFlightRefreshRef.current) {
        return inFlightRefreshRef.current;
      }

      const current = credentialsRef.current;
      if (!current.refreshToken) {
        return null;
      }

      const run = async (): Promise<StoredCredentials | null> => {
        setIsRefreshing(true);
        try {
          const candidates = overrideEndpoint
            ? [overrideEndpoint]
            : current.refreshEndpoint
              ? [current.refreshEndpoint]
              : DEFAULT_REFRESH_CANDIDATES;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Refresh-Token': current.refreshToken!,
          };
          if (current.tenantId) headers['X-Tenant-ID'] = current.tenantId;
          if (current.entityId) headers['X-Entity-ID'] = current.entityId;
          if (current.accessToken) {
            headers['Authorization'] = `Bearer ${current.accessToken}`;
          }
          if (current.customHeaders) {
            for (const [k, v] of Object.entries(current.customHeaders)) {
              if (k && v && !headers[k]) headers[k] = v;
            }
          }

          for (const endpoint of candidates) {
            try {
              const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  refresh_token: current.refreshToken,
                  refreshToken: current.refreshToken,
                  grant_type: 'refresh_token',
                }),
              });

              if (!res.ok) continue;
              const data = await res.json().catch(() => null);
              const extracted = extractTokensFromPayload(data);
              if (extracted && extracted.accessToken) {
                const updated = mergeExtractedCredentials(
                  {
                    ...current,
                    refreshEndpoint: current.refreshEndpoint || endpoint,
                  },
                  extracted,
                );
                updateCredentials(updated);
                return updated;
              }
            } catch {
              // Try next candidate if network/404 fails
            }
          }
          return null;
        } finally {
          setIsRefreshing(false);
          inFlightRefreshRef.current = null;
        }
      };

      const promise = run();
      inFlightRefreshRef.current = promise;
      return promise;
    },
    [updateCredentials],
  );

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
        credentials.refreshToken ||
        credentials.tenantId ||
        credentials.entityId ||
        (credentials.customHeaders &&
          Object.keys(credentials.customHeaders).length > 0)
      ),
    [credentials],
  );

  const expired = useMemo(() => isExpired(credentials), [credentials]);
  const expiringSoon = useMemo(() => isExpiringSoon(credentials), [credentials]);

  // Proactive background refresh: schedule silent renewal 60 seconds before
  // expiry (or immediately if already expired/expiringSoon) when autoRefresh is active.
  useEffect(() => {
    if (credentials.autoRefresh === false || !credentials.refreshToken) return;

    if (expired || expiringSoon) {
      refreshAccessToken();
      return;
    }

    if (!credentials.expiresAt) return;
    const t = Date.parse(credentials.expiresAt);
    if (Number.isNaN(t)) return;

    // Trigger 60s before expiry
    const delayMs = Math.max(0, t - Date.now() - SIXTY_SECONDS);
    if (delayMs > 2_147_483_647) return;
    const timer = window.setTimeout(() => {
      refreshAccessToken();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    credentials.expiresAt,
    credentials.refreshToken,
    credentials.autoRefresh,
    expired,
    expiringSoon,
    refreshAccessToken,
  ]);

  // While a token is live, schedule a cleanup so the state flips to expired
  // at the exact moment the backend would reject it (if no refresh succeeded).
  useEffect(() => {
    if (!credentials.expiresAt || !credentials.accessToken) return;
    const t = Date.parse(credentials.expiresAt);
    if (Number.isNaN(t)) return;
    const ms = Math.max(0, t - Date.now() + 100);
    if (ms > 2_147_483_647) return; // setTimeout max
    const timer = window.setTimeout(() => {
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
    isRefreshing,
    updateCredentials,
    clearCredentials,
    refreshAccessToken,
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
 */
export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  const data = await apiPost<LoginResponse>('/login', { username, password });
  return data;
};

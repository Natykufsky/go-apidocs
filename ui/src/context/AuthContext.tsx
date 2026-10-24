import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { safeStorage } from "../lib/storage";
import { apiPost } from "../lib/api";

export interface StoredCredentials {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  entityId?: string;
  customHeaders?: Record<string, string>;
  updatedAt?: string;
}

interface AuthContextValue {
  credentials: StoredCredentials;
  hasCredentials: boolean;
  updateCredentials: (creds: StoredCredentials) => void;
  clearCredentials: () => void;
  maskPII: boolean;
  toggleMaskPII: () => void;
  activeEnv: string;
  setActiveEnv: (env: string) => void;
}

const KEYS = {
  access: "apidocs_access_token",
  refresh: "apidocs_refresh_token",
  tenant: "apidocs_tenant_id",
  entity: "apidocs_entity_id",
  headers: "apidocs_custom_headers",
  updated: "apidocs_creds_updated_at",
  mask: "apidocs_mask_pii",
} as const;

/**
 * Auth/credentials context.
 *
 * NOTE ON TOKEN STORAGE: tokens are currently mirrored in localStorage for
 * backwards compatibility. The production-hardening path is to move token
 * issuance to httpOnly, Secure, SameSite=Strict cookies on the Go backend
 * and drop these keys entirely — see the migration note in docs.
 */
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
  updatedAt: safeStorage.get(KEYS.updated) || undefined,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [credentials, setCredentials] =
    useState<StoredCredentials>(loadCredentials);
  const [maskPII, setMaskPII] = useState<boolean>(
    () => safeStorage.get(KEYS.mask) === "true",
  );
  const [activeEnv, setActiveEnv] = useState<string>("default");

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
    creds.updatedAt
      ? safeStorage.set(KEYS.updated, creds.updatedAt)
      : safeStorage.remove(KEYS.updated);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials({});
    Object.values(KEYS).forEach((k) => {
      if (k !== KEYS.mask) safeStorage.remove(k);
    });
  }, []);

  const toggleMaskPII = useCallback(() => {
    setMaskPII((prev) => {
      safeStorage.set(KEYS.mask, String(!prev));
      return !prev;
    });
  }, []);

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

  return (
    <AuthContext.Provider
      value={{
        credentials,
        hasCredentials,
        updateCredentials,
        clearCredentials,
        maskPII,
        toggleMaskPII,
        activeEnv,
        setActiveEnv,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

/** Attempt server-side login (kept here so the eventual httpOnly-cookie
 *  migration only touches this module). */
export const login = async (
  username: string,
  password: string,
): Promise<void> => {
  await apiPost("/login", { username, password });
};

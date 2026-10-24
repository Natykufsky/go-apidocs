import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { safeStorage } from "../lib/storage";
import { apiGet } from "../lib/api";
import type { Workspace } from "../components/WorkspaceSwitcher";

export interface Capabilities {
  workspaces_enabled: boolean;
  workspace_writes_enabled: boolean;
  security_audit_enabled: boolean;
  live_spec_editing_enabled: boolean;
  remote_fetch_enabled: boolean;
  max_spec_bytes: number;
}

const DEFAULT_CAPABILITIES: Capabilities = {
  workspaces_enabled: true,
  workspace_writes_enabled: false,
  security_audit_enabled: false,
  live_spec_editing_enabled: false,
  remote_fetch_enabled: false,
  max_spec_bytes: 5 * 1024 * 1024,
};

interface WorkspaceContextValue {
  capabilities: Capabilities;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeServiceId: string;
  activeModule: string;
  specUrl: string;
  setActiveModule: (mod: string) => void;
  selectService: (wsId: string, svcId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  /** True while the initial workspaces/capabilities load is in flight */
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const buildSpecUrl = (ws: string, svc: string, mod: string): string => {
  let url = `/docs/swagger.json?ws=${encodeURIComponent(ws)}&svc=${encodeURIComponent(svc)}`;
  if (mod && mod !== "all" && mod !== "imported") {
    url += `&module=${encodeURIComponent(mod)}`;
  }
  return url;
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [capabilities, setCapabilities] =
    useState<Capabilities>(DEFAULT_CAPABILITIES);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("ws") || safeStorage.get("apidocs_active_ws") || "default";
  });
  const [activeServiceId, setActiveServiceId] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("svc") || safeStorage.get("apidocs_active_svc") || "default";
  });
  const [activeModule, setActiveModuleState] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("module") || p.get("tag") || "all";
  });

  // Always-current ids for use inside stable callbacks (avoids stale closures
  // and prevents refreshWorkspaces from re-firing on every selection change).
  const activeIdsRef = useRef({
    ws: activeWorkspaceId,
    svc: activeServiceId,
  });
  useEffect(() => {
    activeIdsRef.current = { ws: activeWorkspaceId, svc: activeServiceId };
  }, [activeWorkspaceId, activeServiceId]);

  const specUrl = useMemo(
    () => buildSpecUrl(activeWorkspaceId, activeServiceId, activeModule),
    [activeWorkspaceId, activeServiceId, activeModule],
  );

  // Load capabilities
  useEffect(() => {
    apiGet<Capabilities>("/docs/capabilities")
      .then(setCapabilities)
      .catch(() => {});
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await apiGet<Workspace[]>("/docs/workspaces");
      if (Array.isArray(data) && data.length > 0) {
        setWorkspaces(data);
        const { ws, svc } = activeIdsRef.current;
        // Auto-select the first workspace if the active one vanished
        if (!data.some((w) => w.id === ws)) {
          const first = data[0];
          setActiveWorkspaceId(first.id);
          activeIdsRef.current.ws = first.id;
          const firstSvc = first.services?.[0]?.id || "default";
          setActiveServiceId(firstSvc);
          activeIdsRef.current.svc = firstSvc;
        } else if (!data.find((w) => w.id === ws)?.services?.some((s) => s.id === svc)) {
          // Workspace still exists but the service was removed
          const fallbackSvc = data.find((w) => w.id === ws)?.services?.[0]?.id || "default";
          setActiveServiceId(fallbackSvc);
          activeIdsRef.current.svc = fallbackSvc;
        }
      }
    } catch {
      /* offline / not provisioned — fall back to default workspace */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const selectService = useCallback(
    (wsId: string, svcId: string) => {
      const target = workspaces.find((w) => w.id === wsId);
      // Server-authoritative lock check — see backend notes. The caller (App)
      // handles opening the unlock modal when needed; we surface via callback.
      if (target?.is_locked && target.is_unlocked === false) {
        // Handled by App via onLockedSelect hook — skip silent switch.
        return;
      }
      setActiveWorkspaceId(wsId);
      setActiveServiceId(svcId);
      safeStorage.set("apidocs_active_ws", wsId);
      safeStorage.set("apidocs_active_svc", svcId);
      const url = new URL(window.location.href);
      url.searchParams.set("ws", wsId);
      url.searchParams.set("svc", svcId);
      window.history.pushState(null, "", url.toString());
    },
    [workspaces],
  );

  const setActiveModule = useCallback((mod: string) => {
    setActiveModuleState(mod);
  }, []);

  // Sync module param into URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeModule && activeModule !== "all")
      url.searchParams.set("module", activeModule);
    else url.searchParams.delete("module");
    window.history.replaceState(null, "", url.toString());
  }, [activeModule]);

  return (
    <WorkspaceContext.Provider
      value={{
        capabilities,
        workspaces,
        activeWorkspaceId,
        activeServiceId,
        activeModule,
        specUrl,
        setActiveModule,
        selectService,
        refreshWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
};

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
import { apiGet } from '../lib/api';
import type { Workspace } from '../components/WorkspaceSwitcher';

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

/** A workspace the user attempted to select but couldn't (locked / not unlocked). */
export interface LockedSelection {
  workspaceId: string;
  workspaceName: string;
  at: number;
}

interface WorkspaceContextValue {
  capabilities: Capabilities;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeServiceId: string;
  activeModule: string;
  specUrl: string;
  setActiveModule: (mod: string) => void;
  /**
   * Switch to a workspace + service. If the target workspace is server-locked
   * and not yet unlocked, this returns `false` and sets `lastLockedSelection`
   * so callers (App) can open the unlock modal.
   */
  selectService: (wsId: string, svcId: string) => boolean;
  refreshWorkspaces: () => Promise<void>;
  /** True while the initial workspaces/capabilities load is in flight */
  loading: boolean;
  /** Set when a locked workspace was selected; consumers can react + clear it */
  lastLockedSelection: LockedSelection | null;
  clearLockedSelection: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const WORKSPACES_TIMEOUT_MS = 8_000;

export const buildSpecUrl = (ws: string, svc: string, mod: string): string => {
  let url = `/docs/swagger.json?ws=${encodeURIComponent(ws)}&svc=${encodeURIComponent(svc)}`;
  if (mod && mod !== 'all' && mod !== 'imported') {
    url += `&module=${encodeURIComponent(mod)}`;
  }
  return url;
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
};

const readInitialIds = () => {
  const p = new URLSearchParams(window.location.search);
  return {
    ws: p.get('ws') || safeStorage.get('apidocs_active_ws') || 'default',
    svc: p.get('svc') || safeStorage.get('apidocs_active_svc') || 'default',
    mod: p.get('module') || p.get('tag') || 'all',
  };
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initial = readInitialIds();

  const [capabilities, setCapabilities] =
    useState<Capabilities>(DEFAULT_CAPABILITIES);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(initial.ws);
  const [activeServiceId, setActiveServiceId] = useState<string>(initial.svc);
  const [activeModule, setActiveModuleState] = useState<string>(initial.mod);
  const [lastLockedSelection, setLastLockedSelection] =
    useState<LockedSelection | null>(null);

  // Always-current ids for use inside stable callbacks
  const activeIdsRef = useRef({ ws: initial.ws, svc: initial.svc });
  useEffect(() => {
    activeIdsRef.current = { ws: activeWorkspaceId, svc: activeServiceId };
  }, [activeWorkspaceId, activeServiceId]);

  const specUrl = useMemo(
    () => buildSpecUrl(activeWorkspaceId, activeServiceId, activeModule),
    [activeWorkspaceId, activeServiceId, activeModule],
  );

  // Load capabilities once. Non-fatal on failure — defaults are conservative.
  useEffect(() => {
    let cancelled = false;
    withTimeout(apiGet<Capabilities>('/docs/capabilities'), 5_000, 'capabilities')
      .then((caps) => {
        if (!cancelled && caps) setCapabilities({ ...DEFAULT_CAPABILITIES, ...caps });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await withTimeout(
        apiGet<Workspace[]>('/docs/workspaces'),
        WORKSPACES_TIMEOUT_MS,
        'workspaces',
      );
      if (Array.isArray(data) && data.length > 0) {
        setWorkspaces(data);
        const { ws, svc } = activeIdsRef.current;
        // Auto-select first workspace if the active one vanished
        if (!data.some((w) => w.id === ws)) {
          const first = data[0];
          setActiveWorkspaceId(first.id);
          activeIdsRef.current.ws = first.id;
          const firstSvc = first.services?.[0]?.id || 'default';
          setActiveServiceId(firstSvc);
          activeIdsRef.current.svc = firstSvc;
        } else {
          // Workspace still exists — validate the selected service
          const targetWs = data.find((w) => w.id === ws);
          if (!targetWs?.services?.some((s) => s.id === svc)) {
            const fallbackSvc = targetWs?.services?.[0]?.id || 'default';
            setActiveServiceId(fallbackSvc);
            activeIdsRef.current.svc = fallbackSvc;
          }
        }
      }
    } catch {
      /* Offline / not provisioned — fall back to default workspace. */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const selectService = useCallback(
    (wsId: string, svcId: string): boolean => {
      const target = workspaces.find((w) => w.id === wsId);
      // Server-authoritative lock: refuse silently, surface to caller
      if (target?.is_locked && target.is_unlocked === false) {
        setLastLockedSelection({
          workspaceId: wsId,
          workspaceName: target.name,
          at: Date.now(),
        });
        return false;
      }
      setActiveWorkspaceId(wsId);
      setActiveServiceId(svcId);
      safeStorage.set('apidocs_active_ws', wsId);
      safeStorage.set('apidocs_active_svc', svcId);
      const url = new URL(window.location.href);
      url.searchParams.set('ws', wsId);
      url.searchParams.set('svc', svcId);
      window.history.pushState(null, '', url.toString());
      setLastLockedSelection(null);
      return true;
    },
    [workspaces],
  );

  const setActiveModule = useCallback((mod: string) => {
    setActiveModuleState(mod);
  }, []);

  const clearLockedSelection = useCallback(() => {
    setLastLockedSelection(null);
  }, []);

  // Sync module param into URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeModule && activeModule !== 'all')
      url.searchParams.set('module', activeModule);
    else url.searchParams.delete('module');
    window.history.replaceState(null, '', url.toString());
  }, [activeModule]);

  const value: WorkspaceContextValue = {
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
    lastLockedSelection,
    clearLockedSelection,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
};
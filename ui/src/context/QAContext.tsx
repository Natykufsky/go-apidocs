import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useWorkspace } from './WorkspaceContext';
import type { QARecord } from '../components/QAReportModal';
import type { QAStats } from '../components/QABar';

/* ============================================================
   TYPES
   ============================================================ */

interface QAContextValue {
  qaData: Record<string, QARecord>;
  stats: QAStats;
  endpoints: string[];
  modules: string[];
  /** True while initial QA records are loading */
  loading: boolean;
  /** Last error from any QA operation; cleared on next successful call */
  lastError: string | null;
  /**
   * Persist a QA record with optimistic update + rollback.
   *
   * Errors are captured in `lastError` and the promise always resolves —
   * existing fire-and-forget callers (`saveRecord(...)` without await) will
   * no longer trigger unhandled promise rejections.
   */
  saveRecord: (
    endpoint: string,
    status: 'passed' | 'retest' | 'failed' | 'untested',
    comment: string,
  ) => Promise<void>;
  resetQA: () => Promise<void>;
  setQAData: React.Dispatch<React.SetStateAction<Record<string, QARecord>>>;
}

const QAContext = createContext<QAContextValue | null>(null);

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
];

const EMPTY_STATS: QAStats = {
  passed: 0,
  retest: 0,
  failed: 0,
  untested: 0,
  total: 0,
};

/* ============================================================
   SPEC PARSING
   ============================================================ */

/** Extract declared tags (in order) + endpoint keys from a swagger document. */
export const parseSpecMeta = (
  swagger: any,
): { modules: string[]; endpoints: string[] } => {
  const declaredTags: string[] = Array.isArray(swagger?.tags)
    ? swagger.tags
        .map((t: any) => (typeof t === 'string' ? t : t?.name))
        .filter(Boolean)
    : [];

  const tagOrderMap = new Map<string, number>();
  declaredTags.forEach((name, idx) => tagOrderMap.set(name, idx));

  const endpointsWithTag: { key: string; tag: string; path: string }[] = [];
  const extraTagsSet = new Set<string>();

  if (swagger?.paths && typeof swagger.paths === 'object') {
    for (const path in swagger.paths) {
      const methods = swagger.paths[path];
      for (const method in methods) {
        if (HTTP_METHODS.includes(method.toLowerCase())) {
          const op = methods[method];
          const primaryTag = op?.tags?.length > 0 ? op.tags[0] : 'General';
          op?.tags?.forEach((t: string) => {
            if (!tagOrderMap.has(t)) extraTagsSet.add(t);
          });
          endpointsWithTag.push({
            key: `${method.toUpperCase()} ${path}`,
            tag: primaryTag,
            path,
          });
        }
      }
    }
  }

  const extraTags = Array.from(extraTagsSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const allModules = [...declaredTags, ...extraTags];
  allModules.forEach((name, idx) => tagOrderMap.set(name, idx));

  endpointsWithTag.sort((a, b) => {
    const oa = tagOrderMap.get(a.tag) ?? 9999;
    const ob = tagOrderMap.get(b.tag) ?? 9999;
    return oa !== ob ? oa - ob : a.path.localeCompare(b.path);
  });

  return {
    modules: allModules,
    endpoints: endpointsWithTag.map((e) => e.key),
  };
};

/* ============================================================
   PROVIDER
   ============================================================ */

export const QAProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeWorkspaceId, activeServiceId, specUrl } = useWorkspace();

  const [qaData, setQAData] = useState<Record<string, QARecord>>({});
  const [modules, setModules] = useState<string[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  /** Ref mirror so `saveRecord` can read the latest map without being recreated. */
  const qaDataRef = useRef<Record<string, QARecord>>(qaData);
  useEffect(() => {
    qaDataRef.current = qaData;
  }, [qaData]);

  /** In-flight saves keyed by endpoint — dedupes rapid clicks. */
  const inFlightSaves = useRef<Map<string, Promise<void>>>(new Map());

  /* ----- Fetch spec meta (modules + endpoint keys) ----- */
  useEffect(() => {
    const controller = new AbortController();
    apiGet<any>(specUrl, { signal: controller.signal })
      .then((swagger) => {
        if (controller.signal.aborted) return;
        if (!swagger) return;
        const meta = parseSpecMeta(swagger);
        setModules(meta.modules);
        setEndpoints(meta.endpoints);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // Spec meta failure is non-fatal — QA list still renders from saved records.
      });
    return () => controller.abort();
  }, [specUrl]);

  /* ----- Fetch persisted QA records ----- */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLastError(null);

    apiGet<Record<string, QARecord>>(
      `/docs/qa/data?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setQAData(data);
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // Non-fatal — allow new QA entries anyway
        setLastError('Failed to load QA records');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeWorkspaceId, activeServiceId]);

  /* ----- Save a QA record ----- */
  const saveRecord = useCallback(
    (
      endpoint: string,
      status: 'passed' | 'retest' | 'failed' | 'untested',
      comment: string,
    ): Promise<void> => {
      // Dedupe: if a save for this endpoint is already in flight, return it.
      const existing = inFlightSaves.current.get(endpoint);
      if (existing) return existing;

      const timeStr = new Date().toLocaleString();
      const previous = qaDataRef.current[endpoint];
      const optimistic: QARecord = { status, comment, tested_at: timeStr };

      // Optimistic update — UI reflects the click immediately.
      setQAData((prev) => ({ ...prev, [endpoint]: optimistic }));

      const promise = apiPost(
        `/docs/qa/record?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
        { endpoint, endpoint_key: endpoint, status, comment },
      )
        .then(() => {
          setLastError(null);
        })
        .catch((err: unknown) => {
          // Rollback to the previous record (or remove if it was new).
          setQAData((prev) => {
            const next = { ...prev };
            if (previous) next[endpoint] = previous;
            else delete next[endpoint];
            return next;
          });

          setLastError(
            err instanceof Error
              ? err.message
              : `Failed to save QA record for ${endpoint}`,
          );

          // Do NOT rethrow — callers rely on fire-and-forget semantics.
          // The error is surfaced via `lastError` for consumers that care.
        })
        .finally(() => {
          inFlightSaves.current.delete(endpoint);
        });

      inFlightSaves.current.set(endpoint, promise);
      return promise;
    },
    // qaData is intentionally NOT a dependency — read via qaDataRef.
    [activeWorkspaceId, activeServiceId],
  );

  /* ----- Reset all QA records ----- */
  const resetQA = useCallback(async () => {
    try {
      await apiPost(
        `/docs/qa/reset?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
      );
      setQAData({});
      setLastError(null);
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : 'Failed to reset QA records',
      );
      throw err;
    }
  }, [activeWorkspaceId, activeServiceId]);

  /* ----- Derived stats ----- */
  const stats = useMemo<QAStats>(() => {
    if (endpoints.length === 0 && Object.keys(qaData).length === 0) {
      return EMPTY_STATS;
    }

    let passed = 0;
    let retest = 0;
    let failed = 0;

    for (const key in qaData) {
      const item = qaData[key];
      if (item?.status === 'passed') passed++;
      else if (item?.status === 'retest') retest++;
      else if (item?.status === 'failed') failed++;
    }

    const tested = passed + retest + failed;
    const total = Math.max(
      endpoints.length,
      Object.keys(qaData).length,
      tested,
    );

    return {
      passed,
      retest,
      failed,
      untested: Math.max(0, total - tested),
      total,
    };
  }, [qaData, endpoints]);

  /* ----- Context value ----- */
  const value = useMemo<QAContextValue>(
    () => ({
      qaData,
      stats,
      endpoints,
      modules,
      loading,
      lastError,
      saveRecord,
      resetQA,
      setQAData,
    }),
    [qaData, stats, endpoints, modules, loading, lastError, saveRecord, resetQA],
  );

  return <QAContext.Provider value={value}>{children}</QAContext.Provider>;
};

export const useQA = (): QAContextValue => {
  const ctx = useContext(QAContext);
  if (!ctx) throw new Error('useQA must be used inside <QAProvider>');
  return ctx;
};
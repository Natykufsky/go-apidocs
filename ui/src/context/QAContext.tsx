import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet, apiPost } from "../lib/api";
import { useWorkspace } from "./WorkspaceContext";
import type { QARecord } from "../components/QAReportModal";
import type { QAStats } from "../components/QABar";

interface QAContextValue {
  qaData: Record<string, QARecord>;
  stats: QAStats;
  endpoints: string[];
  modules: string[];
  saveRecord: (
    endpoint: string,
    status: "passed" | "retest" | "failed" | "untested",
    comment: string,
  ) => void;
  resetQA: () => Promise<void>;
  setQAData: React.Dispatch<React.SetStateAction<Record<string, QARecord>>>;
}

const QAContext = createContext<QAContextValue | null>(null);

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
];

/** Extract declared tags (in order) + endpoint keys from a swagger document. */
export const parseSpecMeta = (
  swagger: any,
): { modules: string[]; endpoints: string[] } => {
  const declaredTags: string[] = Array.isArray(swagger?.tags)
    ? swagger.tags
        .map((t: any) => (typeof t === "string" ? t : t?.name))
        .filter(Boolean)
    : [];

  const tagOrderMap = new Map<string, number>();
  declaredTags.forEach((name, idx) => tagOrderMap.set(name, idx));

  const endpointsWithTag: { key: string; tag: string; path: string }[] = [];
  const extraTagsSet = new Set<string>();

  if (swagger?.paths && typeof swagger.paths === "object") {
    for (const path in swagger.paths) {
      const methods = swagger.paths[path];
      for (const method in methods) {
        if (HTTP_METHODS.includes(method.toLowerCase())) {
          const op = methods[method];
          const primaryTag = op?.tags?.length > 0 ? op.tags[0] : "General";
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

  return { modules: allModules, endpoints: endpointsWithTag.map((e) => e.key) };
};

export const QAProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeWorkspaceId, activeServiceId, specUrl } = useWorkspace();
  const [qaData, setQAData] = useState<Record<string, QARecord>>({});
  const [modules, setModules] = useState<string[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);

  // Fetch spec meta (modules + endpoint keys)
  useEffect(() => {
    apiGet<any>(specUrl)
      .then((swagger) => {
        if (!swagger) return;
        const meta = parseSpecMeta(swagger);
        setModules(meta.modules);
        setEndpoints(meta.endpoints);
      })
      .catch(() => {});
  }, [specUrl]);

  // Fetch persisted QA records
  useEffect(() => {
    apiGet<Record<string, QARecord>>(
      `/docs/qa/data?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
    )
      .then((data) => {
        if (data && typeof data === "object") setQAData(data);
      })
      .catch(() => {});
  }, [activeWorkspaceId, activeServiceId]);

  const saveRecord = useCallback(
    (
      endpoint: string,
      status: "passed" | "retest" | "failed" | "untested",
      comment: string,
    ) => {
      const timeStr = new Date().toLocaleString();
      setQAData((prev) => ({
        ...prev,
        [endpoint]: { status, comment, tested_at: timeStr },
      }));
      apiPost(
        `/docs/qa/record?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
        { endpoint, endpoint_key: endpoint, status, comment },
      ).catch(() => {});
    },
    [activeWorkspaceId, activeServiceId],
  );

  const resetQA = useCallback(async () => {
    await apiPost(
      `/docs/qa/reset?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`,
    );
    setQAData({});
  }, [activeWorkspaceId, activeServiceId]);

  const stats = useMemo<QAStats>(() => {
    let passed = 0,
      retest = 0,
      failed = 0;
    for (const key in qaData) {
      const item = qaData[key];
      if (item?.status === "passed") passed++;
      else if (item?.status === "retest") retest++;
      else if (item?.status === "failed") failed++;
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

  return (
    <QAContext.Provider
      value={{
        qaData,
        stats,
        endpoints,
        modules,
        saveRecord,
        resetQA,
        setQAData,
      }}
    >
      {children}
    </QAContext.Provider>
  );
};

export const useQA = (): QAContextValue => {
  const ctx = useContext(QAContext);
  if (!ctx) throw new Error("useQA must be used inside <QAProvider>");
  return ctx;
};

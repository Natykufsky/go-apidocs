import { useEffect, useMemo, useRef, useState } from "react";

export interface SpecDiff {
  added: string[];
  removed: string[];
}

const STORAGE_KEY_PREFIX = "apidocs_endpoint_snapshot";

const loadSnapshot = (ws: string, svc: string): string[] | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${ws}:${svc}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};

/**
 * Tracks added/removed endpoints for a workspace/service relative to the last
 * recorded snapshot (persisted in localStorage). Call `commitSnapshot()` after
 * a QA run to establish a new baseline.
 */
export function useEndpointDiff(ws: string, svc: string, endpoints: string[]) {
  const [diff, setDiff] = useState<SpecDiff>({ added: [], removed: [] });
  const lastKey = useRef("");

  useEffect(() => {
    const key = `${ws}:${svc}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      const prev = loadSnapshot(ws, svc);
      if (prev) {
        const prevSet = new Set(prev);
        const currSet = new Set(endpoints);
        setDiff({
          added: endpoints.filter((e) => !prevSet.has(e)),
          removed: prev.filter((e) => !currSet.has(e)),
        });
      } else {
        setDiff({ added: [], removed: [] });
      }
    }
  }, [ws, svc, endpoints]);

  const commitSnapshot = useMemo(
    () => () => {
      try {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}:${ws}:${svc}`,
          JSON.stringify(endpoints),
        );
      } catch {
        /* ignore */
      }
      setDiff({ added: [], removed: [] });
    },
    [ws, svc, endpoints],
  );

  return { diff, commitSnapshot, hasSnapshot: !!loadSnapshot(ws, svc) };
}

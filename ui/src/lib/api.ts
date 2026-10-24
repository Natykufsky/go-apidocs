/**
 * Typed fetch wrapper for the go-apidocs backend.
 *
 * - Normalizes errors into `ApiError` (message + status).
 * - Checks res.ok before parsing (a 500 returning HTML no longer throws
 *   a confusing "Unexpected token <" JSON error).
 * - Supports AbortSignal for cancellation.
 * - Centralizes the `/docs` API base so it can be overridden per deployment.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const API_BASE = "/docs";

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Default: true — parse response as JSON. Set false for blob/text. */
  json?: boolean;
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const { body, json = true, headers, ...rest } = opts;

  let res: Response;
  try {
    res = await fetch(
      path.startsWith("http") || path.startsWith(API_BASE)
        ? path
        : API_BASE + path,
      {
        ...rest,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(headers as Record<string, string>),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    );
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Network error — check your connection", 0);
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) msg = String(errBody.error);
      else if (errBody?.message) msg = String(errBody.message);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(msg, res.status);
  }

  if (!json) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET helper */
export const apiGet = <T = unknown>(path: string, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: "GET" });

/** POST helper */
export const apiPost = <T = unknown>(
  path: string,
  body?: unknown,
  opts?: ApiOptions,
) => api<T>(path, { ...opts, method: "POST", body });

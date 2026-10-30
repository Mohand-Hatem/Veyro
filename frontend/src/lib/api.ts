// Browser-side API client. Calls go to /api/v1 on this origin; next.config.ts rewrites them to the backend,
// so the httpOnly auth cookies stay first-party and no CORS is involved.

const BASE = "/api/v1";

// Public auth endpoints: a 401 here means "wrong credentials", not "session expired".
const NO_REFRESH = /^\/auth\/(login|register|refresh|otp|forgot-password|reset-password)/;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Renews the session cookies. Parallel callers share one request (single-flight). */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const send = (path: string, init: RequestInit) =>
  fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

// A 401 that names a wrong password (change password, delete my account) is the person's mistake, not an expired session: retrying would only spend a second rate-limit attempt.
const wrongPassword = async (res: Response) => (await res.clone().json().catch(() => null))?.error?.code === "INVALID_CURRENT_PASSWORD";

/** Calls the backend and returns `data` from the `{ success, data, meta }` envelope, or throws ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && !NO_REFRESH.test(path) && !(await wrongPassword(res)) && (await refreshSession())) {
    res = await send(path, init);
  }
  if (res.status === 204) return undefined as T; // DELETE answers with no body
  const body = await res.json().catch(() => null);
  if (!body?.success) {
    throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? res.statusText, body?.error?.details);
  }
  return body.data as T;
}

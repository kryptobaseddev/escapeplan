import { env } from '$env/dynamic/public';

const DEFAULT_API_BASE = 'http://localhost:4000/api';

const apiBase = (env.PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

type FetchLike = typeof fetch;

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface ApiFetchOptions extends RequestInit {}

export async function apiFetch<T>(fetchImpl: FetchLike, path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { headers, credentials, ...rest } = options;

  const mergedHeaders = new Headers(headers ?? {});
  mergedHeaders.set('Accept', 'application/json');
  if (rest.body && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetchImpl(`${apiBase}${path}`, {
    credentials: credentials ?? 'include',
    ...rest,
    headers: mergedHeaders
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }
    throw new ApiError(`API request to ${path} failed with ${response.status}`, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { apiBase };

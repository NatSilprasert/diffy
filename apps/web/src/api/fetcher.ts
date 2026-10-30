// The one place every generated API call goes through (see orval.config.ts).

// In production the web app is served by the API itself, so a relative URL is right. During
// development the web app runs on its own port; .env.development points it at the API.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// Thrown for every failed call, so React Query hooks end up in their error state with a message
// that can be shown to the user as it is.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Orval looks for this name to type the `error` of every generated hook.
export type ErrorType<_Error> = ApiError;

// NestJS errors look like { message: 'Repository not found.' }; a body that failed validation looks like
// { message: 'Validation failed', errors: [{ path: ['token'], message: '...' }] }.
function messageFrom(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const { message, errors } = body as { message?: unknown; errors?: unknown };
    if (Array.isArray(errors) && errors.length > 0) {
      const details = errors
        .map((e: { path?: unknown[]; message?: unknown }) => `${(e.path ?? []).join('.') || 'request'}: ${String(e.message)}`)
        .join('; ');
      return `${typeof message === 'string' ? message : 'Invalid request'} (${details})`;
    }
    if (typeof message === 'string') return message;
  }
  return `The server answered with an error (HTTP ${status}).`;
}

export async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    // The session cookie goes with every call, also to the API's own port during development.
    response = await fetch(`${BASE_URL}${url}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Could not reach the diffy server. Is it running?');
  }

  // Empty bodies (204 No Content) and non-JSON answers (a proxy's error page) must not crash the parser.
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) throw new ApiError(response.status, messageFrom(response.status, body), body);
  return body as T;
}

import { API_URL } from './env';

/**
 * Error codes the API returns. Stable — the API is free to reword `message`,
 * so UI copy switches on the code, never on the text.
 */
export type ApiErrorCode = 'CONFLICT' | 'INTERNAL_ERROR' | 'INVALID_INPUT' | 'NETWORK' | 'NOT_FOUND' | 'REQUEST_ERROR' | 'UNSAFE_CONTENT';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, readonly string[]> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** User-facing Spanish copy per code. The API's own message is a fallback, not the source. */
const MESSAGES: Record<ApiErrorCode, string> = {
  CONFLICT: 'Ese dato ya está en uso.',
  INTERNAL_ERROR: 'Algo ha ido mal por nuestra parte. Inténtalo de nuevo en un momento.',
  INVALID_INPUT: 'Revisa los datos marcados.',
  NETWORK: 'No hemos podido conectar. Comprueba tu conexión.',
  NOT_FOUND: 'No hemos encontrado lo que buscabas.',
  REQUEST_ERROR: 'No hemos podido completar la acción.',
  UNSAFE_CONTENT: 'Ese contenido no cumple tus restricciones alimentarias.'
};

export function messageFor(error: unknown): string {
  return error instanceof ApiError ? MESSAGES[error.code] : MESSAGES.INTERNAL_ERROR;
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * The single way this app talks to the API.
 *
 * `credentials: 'include'` is what carries the session cookie; the cookie is
 * httpOnly, so the token is never readable from JavaScript. Nothing here ever
 * sends a user id — the API takes it from the session.
 */
export async function api<T>(path: string, { body, headers, ...options }: Options = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }
    });
  } catch {
    throw new ApiError('NETWORK', MESSAGES.NETWORK, 0);
  }

  if (response.status === 204) {return undefined as T;}

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { code, fieldErrors, message } = payload as { code?: ApiErrorCode; fieldErrors?: Record<string, string[]>; message?: string };

    throw new ApiError(code ?? 'REQUEST_ERROR', message ?? MESSAGES.REQUEST_ERROR, response.status, fieldErrors ?? {});
  }

  return payload as T;
}

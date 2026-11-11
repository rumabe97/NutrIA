/** A code, not prose: lower-case words and underscores, short. Anything else is not kept. */
const CODE = /^[a-z][a-z_]{0,47}$/;

function codeIn(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  // Anthropic's shape, as a response body and as a stream's error event: `{ type: 'error', error: { type } }`.
  const inner = (value as { error?: unknown }).error;
  const type = typeof inner === 'object' && inner !== null ? (inner as { type?: unknown }).type : undefined;

  return typeof type === 'string' && CODE.test(type) ? type : null;
}

/**
 * The provider's own name for what went wrong — `overloaded_error`,
 * `authentication_error`, `not_found_error` — read from the response body or
 * the error a stream reported. Only the code: the message beside it is the
 * provider's prose and can echo the request, so it is never kept. Null when
 * the provider said nothing in that shape.
 */
export function providerErrorType(error: unknown, body?: string | null): string | null {
  if (body) {
    try {
      const code = codeIn(JSON.parse(body));

      if (code) {
        return code;
      }
    } catch {
      // Not JSON: a gateway's HTML page, an empty body. Nothing to read.
    }
  }

  // A stream reports its error event as the chunk itself, or as an Error carrying it as its cause.
  return codeIn(error) ?? (error instanceof Error ? codeIn(error.cause) : null);
}

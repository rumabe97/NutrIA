/**
 * Strips anything key-shaped from a provider's error message.
 *
 * Provider SDKs sometimes echo the failing request, and these messages are
 * surfaced to the operator and stored on the job row. A credential must not
 * travel with them.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /AIza[A-Za-z0-9_-]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  /\b(api[-_]?key|authorization)["'\s:=]+[A-Za-z0-9._-]{8,}/gi
];

const MAX_LENGTH = 300;

export function redactSecrets(message: string): string {
  const redacted = SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), message);

  return redacted.length > MAX_LENGTH ? `${redacted.slice(0, MAX_LENGTH)}…` : redacted;
}

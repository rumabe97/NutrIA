import type { Env } from '../../../config/index.js';

/**
 * Strips anything key-shaped from a provider's error message.
 *
 * Provider SDKs sometimes echo the failing request, and these messages are
 * surfaced to the operator and stored on the job row. A credential must not
 * travel with them.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /AIza[A-Za-z0-9_-]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  /\b(api[-_]?key|authorization)["'\s:=]+[A-Za-z0-9._-]{8,}/gi
];

const REDACTED = '[redacted]';

const MAX_LENGTH = 300;

/**
 * Shorter than this, a configured value is a placeholder rather than a
 * credential, and matching it would blank out ordinary words wherever the same
 * letters happened to fall.
 */
const MIN_CREDENTIAL_LENGTH = 12;

/**
 * The provider credentials this process holds, for `redactSecrets` to match
 * literally.
 *
 * The shapes above only recognise the vendors that announce themselves —
 * Anthropic's `sk-ant-`, Google's `AIza`, a `Bearer` header, a written-out
 * assignment. A gateway's key has no shape any of them can be trusted to cover,
 * so the configured value itself is matched: however an upstream chooses to echo
 * the credential back, the one string worth stealing is gone before the message
 * reaches a log, Sentry, or a generation's job row.
 */
export function providerCredentials(env: Env): readonly string[] {
  // Trimmed at the source, not only checked trimmed: a key pasted into a
  // dashboard field with a stray leading or trailing space is stored with
  // it, but HTTP strips that whitespace from the outgoing header, so a
  // provider echoes the trimmed key back. Scrubbing for the untrimmed value
  // would search for a string the error text never contains — the key would
  // still be here to steal, unredacted, in the one case (a pasted production
  // credential) this function exists for.
  const configured = [env.ANTHROPIC_API_KEY, env.GOOGLE_API_KEY, env.OMNIROUTE_API_KEY].map(value => value?.trim());

  return [...new Set(configured.filter((value): value is string => (value?.length ?? 0) >= MIN_CREDENTIAL_LENGTH))];
}

type Range = { readonly end: number; readonly start: number };

/**
 * Every span the patterns or the credentials would redact, against the
 * message as it arrived — never against a copy something has already cut.
 *
 * A pattern's own class can stop short of the end of a credential (neither
 * `[A-Za-z0-9._-]` nor `[A-Za-z0-9_-]` includes `/`, `+` or `=`, all valid in
 * base64), and a credential run before the patterns can insert `[`/`]`,
 * characters no pattern's class allows either. Either order, run as two
 * passes over each other's output, can leave a fragment of a real credential
 * standing next to `[redacted]` — sometimes the tail of the very key this
 * function exists to protect. Finding every span first and cutting once
 * removes the interaction: nothing here can ever see the other's markers.
 */
function secretRanges(message: string, credentials: readonly string[]): readonly Range[] {
  const ranges: Range[] = [];

  for (const pattern of SECRET_PATTERNS) {
    for (const match of message.matchAll(pattern)) {
      if (match.index !== undefined) {
        ranges.push({ end: match.index + match[0].length, start: match.index });
      }
    }
  }

  for (const credential of credentials) {
    if (credential.length === 0) {
      continue;
    }

    for (let at = message.indexOf(credential); at !== -1; at = message.indexOf(credential, at + credential.length)) {
      ranges.push({ end: at + credential.length, start: at });
    }
  }

  return ranges;
}

/** Adjacent or overlapping spans collapse to one, so two matches sharing a byte become a single `[redacted]`. */
function mergeRanges(ranges: readonly Range[]): readonly Range[] {
  const merged: Range[] = [];

  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);

    if (last && range.start <= last.end) {
      merged[merged.length - 1] = { end: Math.max(last.end, range.end), start: last.start };
    } else {
      merged.push(range);
    }
  }

  return merged;
}

/**
 * `credentials` is required rather than defaulted so that a new sink for
 * provider text has to say what it holds — an omission would be shape-only
 * redaction again, which is what let a gateway key through.
 */
export function redactSecrets(message: string, credentials: readonly string[]): string {
  const ranges = mergeRanges(secretRanges(message, credentials));
  // One left-to-right pass: each byte of `message` is copied at most once,
  // into `pieces`, rather than the whole string being re-sliced per range —
  // an echoed body with thousands of matches stays linear instead of blowing
  // up the event loop.
  const pieces: string[] = [];
  let at = 0;

  for (const { end, start } of ranges) {
    pieces.push(message.slice(at, start), REDACTED);
    at = end;
  }

  pieces.push(message.slice(at));
  const redacted = pieces.join('');

  return redacted.length > MAX_LENGTH ? `${redacted.slice(0, MAX_LENGTH)}…` : redacted;
}

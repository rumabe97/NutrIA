/**
 * No run ever sends a mail, a push or a paid model call, whatever `.env` says.
 *
 * `ConfigModule` loads `apps/api/.env` with dotenv's default `override: false`: a
 * variable already in `process.env` — an empty string included — wins over the
 * file. So blanking these here, before any suite builds its app, makes the file's
 * real SMTP login, VAPID keys and provider keys unreachable. Installed for every
 * suite by `setup-e2e.ts`; the README's long command line is now only a second
 * belt. `env-guard.e2e-spec.ts` proves the precedence rather than trusting it.
 *
 * A suite that needs one of them (`owner-alerts` sets its own mail configuration
 * after this runs) assigns it itself, in the test, and puts it back.
 */
export const BLANKED_ENV = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'OWNER_EMAIL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'OMNIROUTE_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_IMAGE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'STRIPE_YEARLY_PRICE_ID',
  'STRIPE_PRACTICE_PRICES',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'APPLE_OAUTH_CLIENT_ID',
  'APPLE_OAUTH_TEAM_ID',
  'APPLE_OAUTH_KEY_ID',
  'APPLE_OAUTH_PRIVATE_KEY',
  'SENTRY_DSN',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_CANDIDATES_READ_WRITE_TOKEN'
] as const;

export function forceOffline(): void {
  for (const key of BLANKED_ENV) {
    process.env[key] = '';
  }

  process.env.AI_PROVIDER = 'stub';

  // The stub has no use for provider routing; a leftover would only be read by a real one.
  for (const key of ['AI_MODEL', 'AI_REWRITE_MODEL', 'OMNIROUTE_MODEL', 'AI_PROVIDER_ONLY', 'AI_PROVIDER_IGNORE', 'AI_FALLBACK_MODELS']) {
    process.env[key] = '';
  }
}

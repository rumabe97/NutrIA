import { z } from 'zod';

/**
 * Boot-time environment contract.
 *
 * The process refuses to start when this fails, and prints every problem at
 * once. A server that boots with a missing secret and only discovers it on the
 * first request that needs it is a server that fails in production, at night,
 * on one endpoint.
 */
const SECRET_MIN_LENGTH = 32;

/**
 * Model names are provider-specific, so a single global default is a trap: setting
 * `AI_PROVIDER=google` and leaving `AI_MODEL` alone asks Google for a Claude model,
 * which fails at the first call rather than at boot. Defaulting per provider means
 * choosing a provider is enough to get a working pair.
 */
const DEFAULT_MODEL = {
  anthropic: 'claude-sonnet-5',
  // Google retired 2.5-flash for new API keys; existing keys still work, which is
  // why the change is invisible until someone signs up fresh. A stale default here
  // fails at the first generation, not at boot — so when this drifts again, the
  // provider's own message is carried through to the failure screen and says which
  // model to move to.
  google: 'gemini-3.6-flash',
  ollama: 'llama3.1',
  stub: 'none'
} as const;

/** Cheap sanity check on a hand-edited pairing; substrings, not an allowlist. */
const MODEL_PREFIX: Partial<Record<keyof typeof DEFAULT_MODEL, readonly string[]>> = {
  anthropic: ['claude'],
  google: ['gemini', 'gemma']
};

/**
 * Treats an empty string as absent.
 *
 * `.env.example` ships every variable with an empty value, so copying it to `.env`
 * — the documented first step — gives `EMAIL_FROM=''`. Without this, an optional
 * variable with a format check rejects that as *present and malformed* and the
 * process refuses to boot, which makes the setup instructions wrong.
 */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(value => (value === '' ? undefined : value), schema.optional());
}

/**
 * The declared surface, before the cross-field rules below.
 *
 * Split out so the key list is readable as data: `turbo.json`'s `globalEnv` has
 * to name every one of these, and a variable it omits is silently absent from
 * every task it runs. A spec asserts the two agree.
 */
const envObject = z
  .object({
    AI_BASE_URL: optional(z.url()),
    /*
     * Off by default: the configured provider's free tier allows zero image
     * generations, so this is the switch the owner throws once billing is on.
     * When off, no image model is resolved and the sweeps do nothing (0010).
     */
    AI_ILLUSTRATIONS: z
      .enum(['true', 'false'])
      .default('false')
      .transform(value => value === 'true'),
    AI_MODEL: optional(z.string()),
    AI_PROVIDER: z.enum(['anthropic', 'google', 'ollama', 'stub']).default('stub'),
    /*
     * Off by default, like illustrations, and for the same reason: the provider's
     * free tier caps requests per day and generation draws on the same cap. The
     * rewrite sweep alone would spend a day's allowance in about two hours. Turn
     * it on with billing, or deliberately, for a while, on a project you can spare.
     */
    AI_REWRITE_STEPS: z
      .enum(['true', 'false'])
      .default('false')
      .transform(value => value === 'true'),
    ALLOWED_ORIGINS: optional(z.string()),
    ANTHROPIC_API_KEY: optional(z.string()),
    API_PREFIX: z.string().default('api/v1'),
    APP_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(SECRET_MIN_LENGTH, `must be at least ${SECRET_MIN_LENGTH} characters`),
    BETTER_AUTH_URL: z.url(),
    /*
     * The parent domain the session cookie is written for, with the leading dot
     * (`.nutria.app`). Unset for local development, where API and web share an
     * origin's site by both being localhost.
     *
     * This is not a nicety. `proxy.ts` and `server-api.ts` in the web app both
     * read the session cookie from the *web* domain, so a cookie scoped to the
     * API's host alone means every protected route redirects to sign-in and every
     * server-side read comes back empty. Sign-in appears to work and nothing else
     * does.
     */
    COOKIE_DOMAIN: optional(z.string().startsWith('.', 'must start with a dot, e.g. .example.com')),
    /** The platform sends it as a bearer on cron calls; unset means the cron route does not exist. */
    CRON_SECRET: optional(z.string().min(16, 'must be at least 16 characters')),
    DATABASE_URL: z.string().startsWith('postgres'),
    DIRECT_DATABASE_URL: optional(z.string().startsWith('postgres')),
    EMAIL_FROM: optional(z.email()),
    GOOGLE_API_KEY: optional(z.string()),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    /**
     * Where the "an account is waiting" notice goes (`0029`). Unset means it is
     * not sent; nobody else is ever told about a sign-up.
     */
    OWNER_EMAIL: optional(z.email()),
    PORT: z.coerce.number().int().positive().default(3001),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    /** Unset means no error reporting at all — nothing is sent, and the log is the only record. */
    SENTRY_DSN: optional(z.url()),
    SMTP_HOST: optional(z.string()),
    SMTP_PASS: optional(z.string()),
    SMTP_PORT: optional(z.coerce.number().int().positive()),
    SMTP_USER: optional(z.string()),
    /*
     * No fixed default. Unset means "on in development, off everywhere else",
     * resolved below once NODE_ENV is known. It used to default to `true`, which
     * production then refused — so the first production deploy failed on a
     * variable nobody had set, to say that not publishing the schema must be
     * asked for. The safe thing has to be what happens when nothing is said.
     */
    SWAGGER_ENABLED: optional(z.enum(['true', 'false'])),
    /*
     * Set by the platform on every deployment, never by hand. It exists in this
     * schema for one cross-check below: a production deployment running with a
     * development `NODE_ENV` has every production-only rule switched off, and the
     * first sign of it was the function crashing on a pretty-printer.
     */
    VERCEL_ENV: optional(z.enum(['development', 'preview', 'production'])),
    /** Set by the platform; used as the release a report is filed against. */
    VERCEL_GIT_COMMIT_SHA: optional(z.string())
  });

export const ENV_KEYS = Object.keys(envObject.shape);

const envSchema = envObject
  // Production has stricter requirements than development, and the difference is
  // exactly the set of things that are harmless locally and dangerous live.
  // The selected provider decides which key is required. `stub` needs none, which
  // is what makes running with no account a supported state rather than a broken
  // one — see docs/decisions/0006-reuse-before-generating.md.
  // Fill the provider's own default before anything reads AI_MODEL.
  .transform(env => ({
    ...env,
    AI_MODEL: env.AI_MODEL ?? DEFAULT_MODEL[env.AI_PROVIDER],
    SWAGGER_ENABLED: env.SWAGGER_ENABLED === undefined ? env.NODE_ENV === 'development' : env.SWAGGER_ENABLED === 'true'
  }))
  .superRefine((env, ctx) => {
    const expected = MODEL_PREFIX[env.AI_PROVIDER];

    if (expected && !expected.some(prefix => env.AI_MODEL.toLowerCase().includes(prefix))) {
      ctx.addIssue({
        code: 'custom',
        message: `"${env.AI_MODEL}" does not look like a ${env.AI_PROVIDER} model (expected one containing ${expected.join(' or ')}). Leave AI_MODEL empty to use the provider's default, "${DEFAULT_MODEL[env.AI_PROVIDER]}".`,
        path: ['AI_MODEL']
      });
    }

    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "anthropic"', path: ['ANTHROPIC_API_KEY'] });
    }

    if (env.AI_PROVIDER === 'google' && !env.GOOGLE_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "google"', path: ['GOOGLE_API_KEY'] });
    }
  })
  .superRefine((env, ctx) => {
    // Mail is all or nothing. A host with no credentials, or credentials with no
    // sender, would boot, accept every reset request, and deliver none of them —
    // and the form on the other side says "we have sent you a link".
    if (!env.SMTP_HOST) {return;}

    for (const key of ['SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const) {
      if (!env[key]) {ctx.addIssue({ code: 'custom', message: 'is required when SMTP_HOST is set', path: [key] });}
    }
  })
  .superRefine((env, ctx) => {
    // The platform says this is production; the process must agree, or every
    // rule below is skipped, cookies are not `secure`, and Swagger is one flag
    // from public. This is the only place the two are compared, so it fails
    // loudly and names the fix.
    if (env.VERCEL_ENV === 'production' && env.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        message: `must be "production" on a production deployment (VERCEL_ENV is "production", NODE_ENV is "${env.NODE_ENV}") — set it in the project's environment`,
        path: ['NODE_ENV']
      });
    }
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {return;}

    if (!env.ALLOWED_ORIGINS) {
      ctx.addIssue({ code: 'custom', message: 'is required in production — CORS must not fall back to a permissive default', path: ['ALLOWED_ORIGINS'] });
    }

    if (env.ALLOWED_ORIGINS?.includes('localhost')) {
      ctx.addIssue({ code: 'custom', message: 'must not include localhost in production', path: ['ALLOWED_ORIGINS'] });
    }

    if (env.SWAGGER_ENABLED) {
      ctx.addIssue({ code: 'custom', message: 'must be false in production — the schema is a map of the attack surface', path: ['SWAGGER_ENABLED'] });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (result.success) {return result.data;}

  // Values are never echoed — some of these are secrets, and a startup crash is
  // frequently the most widely-read log line a service ever produces.
  const report = result.error.issues.map(issue => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');

  throw new Error(`Invalid environment configuration:\n${report}\n\nSee apps/api/.env.example for the full inventory.`);
}

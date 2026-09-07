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

const envSchema = z
  .object({
    AI_BASE_URL: optional(z.url()),
    AI_MODEL: optional(z.string()),
    AI_PROVIDER: z.enum(['anthropic', 'google', 'ollama', 'stub']).default('stub'),
    ALLOWED_ORIGINS: optional(z.string()),
    ANTHROPIC_API_KEY: optional(z.string()),
    API_PREFIX: z.string().default('api/v1'),
    APP_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(SECRET_MIN_LENGTH, `must be at least ${SECRET_MIN_LENGTH} characters`),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.string().startsWith('postgres'),
    DIRECT_DATABASE_URL: optional(z.string().startsWith('postgres')),
    EMAIL_FROM: optional(z.email()),
    GOOGLE_API_KEY: optional(z.string()),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    SMTP_HOST: optional(z.string()),
    SMTP_PASS: optional(z.string()),
    SMTP_PORT: optional(z.coerce.number().int().positive()),
    SMTP_USER: optional(z.string()),
    SWAGGER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform(value => value === 'true')
  })
  // Production has stricter requirements than development, and the difference is
  // exactly the set of things that are harmless locally and dangerous live.
  // The selected provider decides which key is required. `stub` needs none, which
  // is what makes running with no account a supported state rather than a broken
  // one — see docs/decisions/0006-reuse-before-generating.md.
  // Fill the provider's own default before anything reads AI_MODEL.
  .transform(env => ({ ...env, AI_MODEL: env.AI_MODEL ?? DEFAULT_MODEL[env.AI_PROVIDER] }))
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

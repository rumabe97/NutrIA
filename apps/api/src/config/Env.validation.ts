import { createPrivateKey } from 'node:crypto';

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
  // An OpenAI-compatible gateway (OmniRoute) that holds the vendor keys itself
  // and routes each request by model name. Which account a call spends against
  // — a paid one, a free tier, a community model — is decided by the model the
  // gateway is asked for, not here. The default is an alias the gateway defines,
  // not a vendor name, so there is nothing to sanity-check it against (see
  // `MODEL_PREFIX` below). `OMNIROUTE_MODEL` picks another.
  omniroute: 'NutrIA-Fallback',
  // `0064`: the primary its measurements chose, at low reasoning
  // (`AI_REASONING_EFFORT`), with `minimax/minimax-m3` as the fallback
  // (`AI_FALLBACK_MODELS`) — both set in the deployment, not defaulted here.
  openrouter: 'deepseek/deepseek-v4.1-flash',
  stub: 'none'
} as const;

/** Cheap sanity check on a hand-edited pairing; substrings, not an allowlist. */
const MODEL_PREFIX: Partial<Record<keyof typeof DEFAULT_MODEL, readonly string[]>> = { anthropic: ['claude'], google: ['gemini', 'gemma'] };

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
 * An OpenRouter model id, `vendor/model`, that is not a free endpoint.
 *
 * OpenRouter's `:free` variants are served by providers that may train on
 * what they are sent, which is exactly what `0064` rules out; the `provider`
 * block on every request would already keep them from being routed to, so a
 * `:free` id here is a request that can only fail — said at boot instead.
 */
function openRouterModelIssue(id: string): string | null {
  if (!/^[\w.-]+\/[\w.:-]+$/.test(id)) {
    return 'must be an OpenRouter model id, vendor/model';
  }

  return id.endsWith(':free') ? 'must not be a :free model — they may train on what they are sent (0064)' : null;
}

/**
 * `a/b, c/d` into a list, or an issue naming what is wrong — never the value.
 * Each model once; an empty entry is a typo, not "no fallback".
 */
function modelList(raw: string, ctx: z.RefinementCtx): readonly string[] {
  const models = raw.split(',').map(model => model.trim());

  if (models.some(model => model === '')) {
    ctx.addIssue({ code: 'custom', message: 'must be model ids, comma-separated, with no empty entry' });

    return z.NEVER;
  }

  if (new Set(models).size !== models.length) {
    ctx.addIssue({ code: 'custom', message: 'names one model twice' });

    return z.NEVER;
  }

  return models;
}

/** A practice plan (`0061`): the Stripe price, and how many active clients it includes. */
export type PracticePrice = { readonly includedClients: number; readonly priceId: string };

/** More clients than any practice plan could honestly include; a typo's extra zero, refused at boot. */
const MAX_INCLUDED_CLIENTS = 10_000;

/**
 * `price_a=30,price_b=60` into a list, or an issue naming what is wrong —
 * never the value itself. Each price once, each number a whole number of
 * clients above zero: a plan that includes nobody is a checkout that sells
 * nothing.
 */
function practicePrices(raw: string, ctx: z.RefinementCtx): readonly PracticePrice[] {
  const prices: PracticePrice[] = [];

  for (const pair of raw.split(',')) {
    const [priceId = '', count = '', ...rest] = pair.split('=').map(part => part.trim());
    const includedClients = /^\d+$/.test(count) ? Number(count) : Number.NaN;

    if (rest.length > 0 || !/^price_\w+$/.test(priceId) || !(includedClients >= 1 && includedClients <= MAX_INCLUDED_CLIENTS)) {
      ctx.addIssue({ code: 'custom', message: `must be price_…=N pairs, comma-separated, N from 1 to ${MAX_INCLUDED_CLIENTS}` });

      return z.NEVER;
    }

    if (prices.some(price => price.priceId === priceId)) {
      ctx.addIssue({ code: 'custom', message: 'names one price twice' });

      return z.NEVER;
    }

    prices.push({ includedClients, priceId });
  }

  return prices;
}

/**
 * A PEM pasted into a dashboard arrives one of two ways: with its line breaks,
 * or on one line with `\n` written out. Both are the same key, so both are
 * accepted and only the real one travels further.
 */
function isEcPrivateKey(pem: string): boolean {
  try {
    return createPrivateKey(pem).asymmetricKeyType === 'ec';
  } catch {
    return false;
  }
}

/**
 * The declared surface, before the cross-field rules below.
 *
 * Split out so the key list is readable as data: `turbo.json`'s `globalEnv` has
 * to name every one of these, and a variable it omits is silently absent from
 * every task it runs. A spec asserts the two agree.
 */
const envObject = z.object({
  AI_BASE_URL: optional(z.url()),
  /*
   * How long the model half of a generation may take in all — every round of
   * calls together (`0050`). The default is what fits inside the 300-second
   * function `vercel.json` gives a generation, with room left to schedule and
   * save the plan in the same invocation; when it runs out, the library covers
   * what the model did not bring. A host with no function limit raises it.
   */
  AI_BUDGET_SECONDS: z.preprocess(value => (value === '' ? undefined : value), z.coerce.number().int().min(30).max(3600).default(170)),
  /*
   * OpenRouter only (`0064`): the models it moves a request to, in order, when
   * `AI_MODEL` is down, rate-limited or refuses — its own fallback, inside one
   * request. Comma-separated; empty means the one model. Ignored by every other
   * provider.
   */
  AI_FALLBACK_MODELS: optional(z.string().transform(modelList)),
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
  AI_PROVIDER: z.enum(['anthropic', 'google', 'ollama', 'omniroute', 'openrouter', 'stub']).default('stub'),
  /*
   * OpenRouter only (`0064`): how much the model thinks before it answers.
   * `low` is what was measured and chosen — `none` answered in seven seconds
   * with nine points of split error, against 1.5 at `low`. Empty leaves the
   * model's own default. Ignored by every other provider.
   */
  AI_REASONING_EFFORT: optional(z.enum(['none', 'minimal', 'low', 'medium', 'high'])),
  /*
   * The provider's own allowances, as the console reports them, so `/admin` can
   * say how close today is to the wall.
   *
   * Configured rather than hard-coded because they belong to an account and a
   * model, not to this codebase — Gemini's free tier gives one model twenty
   * requests a day and another five hundred. Unset means the screen shows the
   * count and no bar, which is honest: a limit nobody stated is not a limit
   * this product may invent.
   *
   * They are also **our** count against **their** number. Google publishes no
   * endpoint for what is left, so a difference between this and the console is
   * calls that did not come through here.
   */
  AI_REQUESTS_PER_DAY: optional(z.coerce.number().int().positive()),
  /*
   * The model the rewrite sweep asks, when it should not be the generation's.
   * Through the gateway, a combo of free models without the Gemini step, so
   * the sweep cannot spend the twenty daily requests a plan may need. Empty:
   * the generation's model.
   */
  AI_REWRITE_MODEL: optional(z.string()),
  /*
   * Off by default, like illustrations. On Google's free tier directly, the
   * rewrite sweep would spend the daily cap generation draws on in about two
   * hours. Through the gateway (`AI_PROVIDER=omniroute`) its free models carry
   * it — unless its combo falls to a Gemini step, which `AI_REWRITE_MODEL` can
   * leave out. Turn it on deliberately; the cron is what runs it.
   */
  AI_REWRITE_STEPS: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  AI_TOKENS_PER_MINUTE: optional(z.coerce.number().int().positive()),
  ALLOWED_ORIGINS: optional(z.string()),
  ANTHROPIC_API_KEY: optional(z.string()),
  API_PREFIX: z.string().default('api/v1'),
  /*
   * Where the web app answers, and only its origin: the web app serves each
   * language on its own path, so the rest of a link is `webUrl`'s to decide
   * (`core/domain/WebUrl`). Never concatenate a path onto this by hand — that
   * is how an English reader gets a Spanish page.
   */
  APP_URL: z.url(),
  /**
   * Sign in with Apple (`0058`). All four or none, and none is the shipped
   * default. The client id is the *Services ID*, not the app's bundle id; the
   * key is the `.p8` downloaded once from the developer account, as it is or
   * with its line breaks written `\n`. The client secret Apple wants is a JWT
   * signed from these at boot (`SocialProviders.ts`), so nothing here expires.
   */
  APPLE_OAUTH_CLIENT_ID: optional(z.string()),
  APPLE_OAUTH_KEY_ID: optional(z.string().length(10, 'must be the ten-character key id')),
  APPLE_OAUTH_PRIVATE_KEY: optional(
    z
      .string()
      .transform(value => value.replaceAll('\\n', '\n'))
      .refine(isEcPrivateKey, 'must be the EC private key from the .p8 file, in PEM')
  ),
  APPLE_OAUTH_TEAM_ID: optional(z.string().length(10, 'must be the ten-character team id')),
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
  /**
   * Sign in with Google (`0058`). Both or none. Nothing to do with
   * `GOOGLE_API_KEY`, which is the AI provider's: this pair is an OAuth client
   * from the Google Cloud console, whose one authorised redirect is
   * `{BETTER_AUTH_URL}/{API_PREFIX}/auth/callback/google`.
   */
  GOOGLE_OAUTH_CLIENT_ID: optional(
    z.string().endsWith('.apps.googleusercontent.com', 'must be an OAuth client id, ending .apps.googleusercontent.com')
  ),
  GOOGLE_OAUTH_CLIENT_SECRET: optional(z.string()),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  /** The gateway's own bearer key, required only when `AI_PROVIDER` is `omniroute`. */
  OMNIROUTE_API_KEY: optional(z.string()),
  /**
   * The model the gateway is asked for when `AI_PROVIDER` is `omniroute` — one of
   * its aliases (`NutrIA-Fallback`) or a routed model (`gemini/gemini-3.6-flash`).
   * Kept beside the gateway's key so switching gateway or model is two lines
   * next to each other; it wins over `AI_MODEL` for this provider, and is
   * ignored by every other.
   */
  OMNIROUTE_MODEL: optional(z.string()),
  /** OpenRouter's key, required only when `AI_PROVIDER` is `openrouter` (`0064`). */
  OPENROUTER_API_KEY: optional(z.string()),
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
  /**
   * Payments (`0042`, `docs/reference/payments.md`). All three unset — the
   * shipped default — means payments do not exist and nothing about them is
   * reachable; the tier is then whatever the owner granted by hand.
   *
   * The prefix is checked rather than the whole shape because it is the half
   * that goes wrong: a publishable key (`pk_`) pasted where the secret belongs
   * fails every call at Stripe with a message about the wrong key type, and a
   * live key (`sk_live_`) reaching a preview deployment is the mistake that
   * charges somebody real money from a test.
   */
  /**
   * The practice plans (`0061`): `price_…=N` pairs, comma-separated, each a
   * Stripe price and the number of active clients it includes. Read into a
   * list here, once, so nothing downstream parses it again. A price not in the
   * list opens no practice, whatever it charges: the number a practice gets is
   * this list's, never a request's.
   */
  STRIPE_PRACTICE_PRICES: optional(z.string().transform(practicePrices)),
  STRIPE_PRICE_ID: optional(z.string().startsWith('price_', 'must be a Stripe price id')),
  STRIPE_SECRET_KEY: optional(z.string().startsWith('sk_', 'must be a Stripe secret key, never a publishable one')),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_', 'must be a Stripe webhook signing secret')),
  /** A second, yearly price (`0056`, amended). Optional: without it, checkout offers the monthly price alone. */
  STRIPE_YEARLY_PRICE_ID: optional(z.string().startsWith('price_', 'must be a Stripe price id')),
  /*
   * No fixed default. Unset means "on in development, off everywhere else",
   * resolved below once NODE_ENV is known. It used to default to `true`, which
   * production then refused — so the first production deploy failed on a
   * variable nobody had set, to say that not publishing the schema must be
   * asked for. The safe thing has to be what happens when nothing is said.
   */
  SWAGGER_ENABLED: optional(z.enum(['true', 'false'])),
  /**
   * Web Push (`0054`). All three or none. None — the shipped default — means
   * the check-in reminder goes by mail only, and the profile offers no switch
   * for phones. Generate the pair once with `npx web-push generate-vapid-keys`;
   * the subject is how a push service reaches the sender, a `mailto:` or an
   * `https:` URL.
   */
  VAPID_PRIVATE_KEY: optional(z.string()),
  VAPID_PUBLIC_KEY: optional(z.string()),
  VAPID_SUBJECT: optional(z.string().regex(/^(mailto:|https:\/\/)/, 'must be a mailto: address or an https: URL')),
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

/**
 * Every name this service reads from the environment.
 *
 * @knipignore Its only consumer is the spec that asserts `turbo.json`'s
 * `globalEnv` lists all of them — a test, so a production-only dead-code run
 * cannot see the use, and dropping it would silently stop guarding the two
 * lists against drifting apart.
 */
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
    AI_MODEL: (env.AI_PROVIDER === 'omniroute' ? env.OMNIROUTE_MODEL : undefined) ?? env.AI_MODEL ?? DEFAULT_MODEL[env.AI_PROVIDER],
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

    // The sweep's model answers to the same provider, so the same check.
    if (expected && env.AI_REWRITE_MODEL && !expected.some(prefix => env.AI_REWRITE_MODEL?.toLowerCase().includes(prefix))) {
      ctx.addIssue({
        code: 'custom',
        message: `"${env.AI_REWRITE_MODEL}" does not look like a ${env.AI_PROVIDER} model (expected one containing ${expected.join(' or ')}). Leave it empty to use the generation's model.`,
        path: ['AI_REWRITE_MODEL']
      });
    }

    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "anthropic"', path: ['ANTHROPIC_API_KEY'] });
    }

    if (env.AI_PROVIDER === 'google' && !env.GOOGLE_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "google"', path: ['GOOGLE_API_KEY'] });
    }

    if (env.AI_PROVIDER === 'omniroute' && !env.OMNIROUTE_API_KEY) {
      ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "omniroute"', path: ['OMNIROUTE_API_KEY'] });
    }

    if (env.AI_PROVIDER === 'openrouter') {
      if (!env.OPENROUTER_API_KEY) {
        ctx.addIssue({ code: 'custom', message: 'is required when AI_PROVIDER is "openrouter"', path: ['OPENROUTER_API_KEY'] });
      }

      // Every model a request may reach: the one asked, the sweep's, and the fallbacks.
      const models = [
        ['AI_MODEL', env.AI_MODEL],
        ['AI_REWRITE_MODEL', env.AI_REWRITE_MODEL],
        ...(env.AI_FALLBACK_MODELS ?? []).map(model => ['AI_FALLBACK_MODELS', model] as const)
      ] as const;

      for (const [key, model] of models) {
        const issue = model === undefined ? null : openRouterModelIssue(model);

        if (issue) {
          ctx.addIssue({ code: 'custom', message: issue, path: [key] });
        }
      }
    }
  })
  .superRefine((env, ctx) => {
    // Mail is all or nothing. A host with no credentials, or credentials with no
    // sender, would boot, accept every reset request, and deliver none of them —
    // and the form on the other side says "we have sent you a link".
    if (!env.SMTP_HOST) {
      return;
    }

    for (const key of ['SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', message: 'is required when SMTP_HOST is set', path: [key] });
      }
    }
  })
  .superRefine((env, ctx) => {
    // Push is all or nothing too. The public key alone lets a browser subscribe
    // to messages this server can never sign, and the profile's switch would
    // promise reminders that never arrive.
    const vapid = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

    if (!vapid.some(key => env[key])) {
      return;
    }

    for (const key of vapid) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', message: 'is required when any VAPID_* is set', path: [key] });
      }
    }
  })
  .superRefine((env, ctx) => {
    // A provider is whole or absent (`0058`). Half of one draws a button that
    // sends somebody to Google or Apple and brings them back to an error.
    const providers = [
      ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      ['APPLE_OAUTH_CLIENT_ID', 'APPLE_OAUTH_KEY_ID', 'APPLE_OAUTH_PRIVATE_KEY', 'APPLE_OAUTH_TEAM_ID']
    ] as const;

    for (const keys of providers) {
      if (keys.some(key => env[key])) {
        for (const key of keys) {
          if (!env[key]) {
            ctx.addIssue({ code: 'custom', message: `is required when any of ${keys.join(', ')} is set`, path: [key] });
          }
        }
      }
    }
  })
  .superRefine((env, ctx) => {
    // Payments are all or nothing as well (`0056`), and here the half-way state
    // costs somebody money: a checkout with no webhook secret takes their card
    // and never grants what they paid for.
    const stripe = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'] as const;

    if (stripe.some(key => env[key])) {
      for (const key of stripe) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', message: 'is required when any STRIPE_* is set', path: [key] });
        }
      }
    }

    // A yearly price is an addition to payments, never a way to have them without the other three.
    if (env.STRIPE_YEARLY_PRICE_ID && !env.STRIPE_SECRET_KEY) {
      ctx.addIssue({ code: 'custom', message: 'needs the other STRIPE_* values set', path: ['STRIPE_YEARLY_PRICE_ID'] });
    }

    // Practices are an addition to payments too: a practice checkout with no webhook secret takes a card and opens nothing.
    if (env.STRIPE_PRACTICE_PRICES && !env.STRIPE_SECRET_KEY) {
      ctx.addIssue({ code: 'custom', message: 'needs the other STRIPE_* values set', path: ['STRIPE_PRACTICE_PRICES'] });
    }

    // One price, one thing it grants: a price that were both premium and a practice would grant whichever was read first.
    const premium = [env.STRIPE_PRICE_ID, env.STRIPE_YEARLY_PRICE_ID];

    if (env.STRIPE_PRACTICE_PRICES?.some(({ priceId }) => premium.includes(priceId))) {
      ctx.addIssue({ code: 'custom', message: 'must not name a premium price', path: ['STRIPE_PRACTICE_PRICES'] });
    }

    // A preview deployment is a test by definition; a live key there charges real cards from one.
    if (env.VERCEL_ENV === 'preview' && env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
      ctx.addIssue({ code: 'custom', message: 'must be a test key (sk_test_) on a preview deployment', path: ['STRIPE_SECRET_KEY'] });
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
    if (env.NODE_ENV !== 'production') {
      return;
    }

    if (!env.ALLOWED_ORIGINS) {
      ctx.addIssue({
        code: 'custom',
        message: 'is required in production — CORS must not fall back to a permissive default',
        path: ['ALLOWED_ORIGINS']
      });
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

  if (result.success) {
    return result.data;
  }

  // Values are never echoed — some of these are secrets, and a startup crash is
  // frequently the most widely-read log line a service ever produces.
  const report = result.error.issues.map(issue => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');

  throw new Error(`Invalid environment configuration:\n${report}\n\nSee apps/api/.env.example for the full inventory.`);
}

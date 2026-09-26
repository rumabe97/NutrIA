import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

import { ENV_KEYS, validateEnv } from './Env.validation.js';

const valid = {
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db'
};

describe('validateEnv', () => {
  it('accepts a minimal development environment and applies defaults', () => {
    const env = validateEnv({ ...valid });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.API_PREFIX).toBe('api/v1');
  });

  it('coerces numeric vars, which always arrive as strings', () => {
    expect(validateEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a short auth secret', () => {
    expect(() => validateEnv({ ...valid, BETTER_AUTH_SECRET: 'too-short' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects a database url that is not postgres', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://host/db' })).toThrow(/DATABASE_URL/);
  });

  it('reports every problem at once rather than the first', () => {
    const run = () => validateEnv({ BETTER_AUTH_SECRET: 'short' });

    expect(run).toThrow(/APP_URL/);
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('never echoes a value back in the error — startup crashes are widely read', () => {
    const secret = 'super-secret-value-that-must-not-leak';

    try {
      validateEnv({ ...valid, DATABASE_URL: secret });
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  describe('in production', () => {
    const production = { ...valid, NODE_ENV: 'production', SWAGGER_ENABLED: 'false' };

    it('requires ALLOWED_ORIGINS', () => {
      expect(() => validateEnv({ ...production })).toThrow(/ALLOWED_ORIGINS/);
    });

    it('rejects localhost in ALLOWED_ORIGINS', () => {
      expect(() => validateEnv({ ...production, ALLOWED_ORIGINS: 'https://nutria.app,http://localhost:3000' })).toThrow(/localhost/);
    });

    it('rejects an exposed Swagger schema', () => {
      expect(() => validateEnv({ ...production, ALLOWED_ORIGINS: 'https://nutria.app', SWAGGER_ENABLED: 'true' })).toThrow(/SWAGGER_ENABLED/);
    });

    it('accepts a correctly locked-down production environment', () => {
      expect(validateEnv({ ...production, ALLOWED_ORIGINS: 'https://nutria.app' }).SWAGGER_ENABLED).toBe(false);
    });
  });
});

describe('empty values from a copied .env.example', () => {
  // `cp .env.example .env` is the documented first step and leaves every unset
  // variable as an empty string. Those must read as absent, not as malformed.
  const copied = {
    ...valid,
    AI_BASE_URL: '',
    ALLOWED_ORIGINS: '',
    ANTHROPIC_API_KEY: '',
    EMAIL_FROM: '',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: ''
  };

  it('boots with every optional variable left empty', () => {
    expect(() => validateEnv({ ...copied })).not.toThrow();
  });

  it('reads an empty optional as undefined rather than an empty string', () => {
    expect(validateEnv({ ...copied }).EMAIL_FROM).toBeUndefined();
  });

  it('still rejects a genuinely malformed value', () => {
    expect(() => validateEnv({ ...copied, EMAIL_FROM: 'not-an-email' })).toThrow(/EMAIL_FROM/);
  });

  it('requires the whole mail configuration once a host is named', () => {
    const run = () => validateEnv({ ...copied, SMTP_HOST: 'smtp.example.com' });

    expect(run).toThrow(/SMTP_USER/);
    expect(run).toThrow(/SMTP_PASS/);
    expect(run).toThrow(/EMAIL_FROM/);
  });

  it('accepts a complete mail configuration', () => {
    const env = validateEnv({
      ...copied,
      EMAIL_FROM: 'hola@example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PASS: 'x',
      SMTP_PORT: '465',
      SMTP_USER: 'hola@example.com'
    });

    expect(env.SMTP_PORT).toBe(465);
  });

  it('treats an empty provider key as missing when that provider is selected', () => {
    expect(() => validateEnv({ ...copied, AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('needs no key at all on the default stub provider', () => {
    expect(validateEnv({ ...copied }).AI_PROVIDER).toBe('stub');
  });

  it('treats an empty gateway key as missing when omniroute is selected', () => {
    expect(() => validateEnv({ ...copied, AI_PROVIDER: 'omniroute' })).toThrow(/OMNIROUTE_API_KEY/);
  });

  it('treats an empty OpenRouter key as missing when openrouter is selected, and its optional settings as unset', () => {
    expect(() => validateEnv({ ...copied, AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: '' })).toThrow(/OPENROUTER_API_KEY/);

    const env = validateEnv({ ...copied, AI_FALLBACK_MODELS: '', AI_PROVIDER: 'openrouter', AI_REASONING_EFFORT: '', OPENROUTER_API_KEY: 'k' });

    expect(env.AI_FALLBACK_MODELS).toBeUndefined();
    expect(env.AI_REASONING_EFFORT).toBeUndefined();
  });
});

describe('AI provider and model pairing', () => {
  it('defaults the model to the provider’s own, not a global one', () => {
    expect(validateEnv({ ...valid, AI_PROVIDER: 'google', GOOGLE_API_KEY: 'k' }).AI_MODEL).toBe('gemini-3.6-flash');
    expect(validateEnv({ ...valid, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }).AI_MODEL).toBe('claude-sonnet-5');
  });

  it('rejects a Claude model on Google, which would otherwise fail at the first call', () => {
    // The trap this exists for: switch AI_PROVIDER to google, leave AI_MODEL alone,
    // and every generation fails with an unrelated-looking "not enough recipes".
    expect(() => validateEnv({ ...valid, AI_MODEL: 'claude-sonnet-5', AI_PROVIDER: 'google', GOOGLE_API_KEY: 'k' })).toThrow(/AI_MODEL/);
  });

  it('rejects a Gemini model on Anthropic', () => {
    expect(() => validateEnv({ ...valid, AI_MODEL: 'gemini-3.6-flash', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' })).toThrow(/AI_MODEL/);
  });

  it('accepts an explicit model that matches its provider', () => {
    expect(validateEnv({ ...valid, AI_MODEL: 'gemini-2.5-pro', AI_PROVIDER: 'google', GOOGLE_API_KEY: 'k' }).AI_MODEL).toBe('gemini-2.5-pro');
  });

  it('does not second-guess a local model name', () => {
    expect(validateEnv({ ...valid, AI_MODEL: 'llama3.1:70b', AI_PROVIDER: 'ollama' }).AI_MODEL).toBe('llama3.1:70b');
  });

  it('takes the gateway’s model from OMNIROUTE_MODEL, beside its key, over AI_MODEL', () => {
    const env = validateEnv({
      ...valid,
      AI_MODEL: 'ignored',
      AI_PROVIDER: 'omniroute',
      OMNIROUTE_API_KEY: 'k',
      OMNIROUTE_MODEL: 'gemini/gemini-3.6-flash'
    });

    expect(env.AI_MODEL).toBe('gemini/gemini-3.6-flash');
  });

  it('ignores OMNIROUTE_MODEL for every other provider', () => {
    expect(validateEnv({ ...valid, AI_PROVIDER: 'google', GOOGLE_API_KEY: 'k', OMNIROUTE_MODEL: 'gemini/gemini-3.6-flash' }).AI_MODEL).toBe(
      'gemini-3.6-flash'
    );
  });

  it('does not second-guess a gateway alias either, and defaults to the gateway’s own', () => {
    // "NutrIA-Fallback" names nothing at Anthropic or Google; there is no vendor
    // substring to check it against, unlike `google` and `anthropic` above.
    expect(validateEnv({ ...valid, AI_PROVIDER: 'omniroute', OMNIROUTE_API_KEY: 'k' }).AI_MODEL).toBe('NutrIA-Fallback');
    expect(validateEnv({ ...valid, AI_MODEL: 'auto/best-coding', AI_PROVIDER: 'omniroute', OMNIROUTE_API_KEY: 'k' }).AI_MODEL).toBe(
      'auto/best-coding'
    );
  });
});

/*
 * `0064`: generation on paid OpenRouter models that never train on what they
 * are sent. The key is required; the model ids are OpenRouter's, and a free
 * one — whose providers may train — is refused at boot.
 */
describe('AI_PROVIDER=openrouter', () => {
  const openrouter = { ...valid, AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' };

  it('requires its key', () => {
    expect(() => validateEnv({ ...valid, AI_PROVIDER: 'openrouter' })).toThrow(/OPENROUTER_API_KEY.*"openrouter"/);
  });

  it('defaults to the model 0064 chose, with no fallback and the model’s own reasoning', () => {
    const env = validateEnv(openrouter);

    expect(env.AI_MODEL).toBe('deepseek/deepseek-v4.1-flash');
    expect(env.AI_FALLBACK_MODELS).toBeUndefined();
    expect(env.AI_REASONING_EFFORT).toBeUndefined();
  });

  it('reads the fallback models into a list, trimmed, and the reasoning effort as given', () => {
    const env = validateEnv({ ...openrouter, AI_FALLBACK_MODELS: ' minimax/minimax-m3 , z-ai/glm-5.3-flash', AI_REASONING_EFFORT: 'low' });

    expect(env.AI_FALLBACK_MODELS).toEqual(['minimax/minimax-m3', 'z-ai/glm-5.3-flash']);
    expect(env.AI_REASONING_EFFORT).toBe('low');
    expect(validateEnv({ ...openrouter, AI_REASONING_EFFORT: 'none' }).AI_REASONING_EFFORT).toBe('none');
  });

  it('refuses a reasoning effort OpenRouter does not know', () => {
    expect(() => validateEnv({ ...openrouter, AI_REASONING_EFFORT: 'extreme' })).toThrow(/AI_REASONING_EFFORT/);
  });

  it('refuses a fallback list with an empty entry or a model twice', () => {
    expect(() => validateEnv({ ...openrouter, AI_FALLBACK_MODELS: 'minimax/minimax-m3,,z-ai/glm-5.3-flash' })).toThrow(/AI_FALLBACK_MODELS/);
    expect(() => validateEnv({ ...openrouter, AI_FALLBACK_MODELS: 'minimax/minimax-m3,minimax/minimax-m3' })).toThrow(/AI_FALLBACK_MODELS.*twice/);
  });

  it('refuses a free model anywhere a request may reach — the one asked, the sweep’s or a fallback', () => {
    expect(() => validateEnv({ ...openrouter, AI_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b:free' })).toThrow(/AI_MODEL.*:free/);
    expect(() => validateEnv({ ...openrouter, AI_REWRITE_MODEL: 'qwen/qwen3.8-27b:free' })).toThrow(/AI_REWRITE_MODEL.*:free/);
    expect(() => validateEnv({ ...openrouter, AI_FALLBACK_MODELS: 'minimax/minimax-m3,qwen/qwen3.8-27b:free' })).toThrow(/AI_FALLBACK_MODELS.*:free/);
  });

  it('refuses a model id that is not vendor/model, such as a gateway alias left over', () => {
    expect(() => validateEnv({ ...openrouter, AI_MODEL: 'NutrIA-Fallback' })).toThrow(/AI_MODEL.*vendor\/model/);
  });

  it('leaves the fallback list alone for every other provider, which ignores it', () => {
    expect(() => validateEnv({ ...valid, AI_FALLBACK_MODELS: 'qwen/qwen3.8-27b:free', AI_PROVIDER: 'google', GOOGLE_API_KEY: 'k' })).not.toThrow();
  });
});

describe('AI_BUDGET_SECONDS', () => {
  it('defaults to what fits inside a 300-second function, including when copied empty', () => {
    expect(validateEnv({ ...valid }).AI_BUDGET_SECONDS).toBe(170);
    expect(validateEnv({ ...valid, AI_BUDGET_SECONDS: '' }).AI_BUDGET_SECONDS).toBe(170);
  });

  it('takes a host’s own figure, and refuses one too short for any model to answer in', () => {
    expect(validateEnv({ ...valid, AI_BUDGET_SECONDS: '600' }).AI_BUDGET_SECONDS).toBe(600);
    expect(() => validateEnv({ ...valid, AI_BUDGET_SECONDS: '5' })).toThrow(/AI_BUDGET_SECONDS/);
  });
});

/*
 * A default that production refuses is a trap, not a default: the first
 * production deploy failed on SWAGGER_ENABLED, which nobody had set. Unset now
 * means the safe thing for wherever the process is.
 */
describe('SWAGGER_ENABLED when nothing is said', () => {
  it('is on in development', () => {
    expect(validateEnv({ ...valid }).SWAGGER_ENABLED).toBe(true);
  });

  it('is off in production', () => {
    expect(validateEnv({ ...valid, ALLOWED_ORIGINS: 'https://nutria.app', NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
  });

  it('is off in staging', () => {
    expect(validateEnv({ ...valid, NODE_ENV: 'staging' }).SWAGGER_ENABLED).toBe(false);
  });

  it('still honours an explicit value outside production', () => {
    expect(validateEnv({ ...valid, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
  });
});

/*
 * The platform sets VERCEL_ENV; the operator sets NODE_ENV. When they disagree
 * on a production deployment, every production-only rule above is silently
 * skipped — the deployed function found this out by crashing on a development
 * pretty-printer, which was the least of what was switched off.
 */
describe('validateEnv on a production deployment', () => {
  it('refuses a development NODE_ENV', () => {
    expect(() => validateEnv({ ...valid, VERCEL_ENV: 'production' })).toThrow(/NODE_ENV.*must be "production"/);
  });

  it('refuses an unset NODE_ENV, which defaults to development', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: '', VERCEL_ENV: 'production' })).toThrow(/NODE_ENV/);
  });

  it('is satisfied by a production NODE_ENV, and then applies the production rules', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production', VERCEL_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('does not constrain a preview deployment', () => {
    expect(() => validateEnv({ ...valid, VERCEL_ENV: 'preview' })).not.toThrow();
  });
});

/*
 * A variable the schema knows about but Turborepo does not is invisible to every
 * task it runs: the build gets a warning it prints once among a thousand lines,
 * and the value is simply absent. `AI_PROVIDER` and `GOOGLE_API_KEY` were set on
 * the host and missing here, so the deploy that first used them would have fallen
 * back to the stub provider and generated nothing, with no error to read.
 *
 * The schema is the contract, so it is also the source of this list.
 */
describe('turbo.json globalEnv', () => {
  it('declares every variable the schema reads', () => {
    const turbo = JSON.parse(readFileSync(new URL('../../../../turbo.json', import.meta.url), 'utf8')) as { globalEnv: string[] };
    const missing = ENV_KEYS.filter(key => !turbo.globalEnv.includes(key));

    expect(missing).toEqual([]);
  });
}); /**
 * `0058`. A provider is whole or absent: half of one draws a button that sends
 * somebody to Google or Apple and brings them back to an error page.
 */
describe('sign-in providers', () => {
  const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const google = { GOOGLE_OAUTH_CLIENT_ID: 'nutria.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'not-a-real-secret' };
  const apple = {
    APPLE_OAUTH_CLIENT_ID: 'app.nutria.web',
    APPLE_OAUTH_KEY_ID: 'ABCDEFGHIJ',
    APPLE_OAUTH_PRIVATE_KEY: pem,
    APPLE_OAUTH_TEAM_ID: 'KLMNOPQRST'
  };

  it('boots with none, which is how it ships, including when copied empty', () => {
    const empty = Object.fromEntries(Object.keys({ ...apple, ...google }).map(key => [key, '']));

    expect(validateEnv({ ...valid, ...empty }).GOOGLE_OAUTH_CLIENT_ID).toBeUndefined();
  });

  it('accepts each provider whole', () => {
    expect(() => validateEnv({ ...valid, ...google })).not.toThrow();
    expect(() => validateEnv({ ...valid, ...apple })).not.toThrow();
  });

  it('refuses half of Google, and names the half that is missing', () => {
    expect(() => validateEnv({ ...valid, GOOGLE_OAUTH_CLIENT_ID: google.GOOGLE_OAUTH_CLIENT_ID })).toThrow(/GOOGLE_OAUTH_CLIENT_SECRET/);
    expect(() => validateEnv({ ...valid, GOOGLE_OAUTH_CLIENT_SECRET: google.GOOGLE_OAUTH_CLIENT_SECRET })).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });

  it('refuses a Google value that is not an OAuth client id — the AI key pasted in the wrong box', () => {
    expect(() => validateEnv({ ...valid, ...google, GOOGLE_OAUTH_CLIENT_ID: 'AIza-not-a-client-id' })).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });

  it('refuses part of Apple', () => {
    expect(() => validateEnv({ ...valid, ...apple, APPLE_OAUTH_TEAM_ID: '' })).toThrow(/APPLE_OAUTH_TEAM_ID/);
  });

  it('reads an Apple key pasted on one line as the same key', () => {
    const oneLine = pem.trim().replaceAll('\n', '\\n');

    expect(validateEnv({ ...valid, ...apple, APPLE_OAUTH_PRIVATE_KEY: oneLine }).APPLE_OAUTH_PRIVATE_KEY).toBe(pem.trim());
  });

  it('refuses an Apple key that is not one, without echoing it', () => {
    const run = () => validateEnv({ ...valid, ...apple, APPLE_OAUTH_PRIVATE_KEY: 'definitely-not-a-pem' });

    expect(run).toThrow(/APPLE_OAUTH_PRIVATE_KEY/);
    expect(run).not.toThrow(/definitely-not-a-pem/);
  });
});

describe('STRIPE_PRACTICE_PRICES (0061)', () => {
  const stripe = { ...valid, STRIPE_PRICE_ID: 'price_premium', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' };

  it('reads the pairs into a list, once, trimming what a dashboard adds', () => {
    expect(validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: 'price_small=30, price_large = 60' }).STRIPE_PRACTICE_PRICES).toEqual([
      { includedClients: 30, priceId: 'price_small' },
      { includedClients: 60, priceId: 'price_large' }
    ]);
  });

  it('is absent when left empty, as copied from the example', () => {
    expect(validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: '' }).STRIPE_PRACTICE_PRICES).toBeUndefined();
  });

  it('needs the other STRIPE_* values: a practice checkout with no webhook secret opens nothing', () => {
    expect(() => validateEnv({ ...valid, STRIPE_PRACTICE_PRICES: 'price_small=30' })).toThrow(/STRIPE_PRACTICE_PRICES: needs the other/);
  });

  it.each([
    ['a missing number', 'price_small'],
    ['a number of nobody', 'price_small=0'],
    ['a number that is not whole', 'price_small=2.5'],
    ['a typo’s extra zeros', 'price_small=300000'],
    ['something that is not a price', 'prod_small=30'],
    ['a pair with two numbers', 'price_small=30=60'],
    ['an empty pair', 'price_small=30,']
  ])('refuses %s', (_case, value) => {
    expect(() => validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: value })).toThrow(/STRIPE_PRACTICE_PRICES: must be price_…=N pairs/);
  });

  it('refuses one price named twice', () => {
    expect(() => validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: 'price_small=30,price_small=60' })).toThrow(/names one price twice/);
  });

  it('refuses a premium price among the practice ones: one price, one grant', () => {
    expect(() => validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: 'price_premium=30' })).toThrow(/must not name a premium price/);
  });

  it('never echoes the value in the error', () => {
    expect(() => validateEnv({ ...stripe, STRIPE_PRACTICE_PRICES: 'price_secretlooking=abc' })).toThrow(/^(?![\s\S]*secretlooking)/);
  });
});

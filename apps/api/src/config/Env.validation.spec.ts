import { describe, expect, it } from '@jest/globals';

import { validateEnv } from './Env.validation.js';

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
  const copied = { ...valid, AI_BASE_URL: '', ALLOWED_ORIGINS: '', ANTHROPIC_API_KEY: '', EMAIL_FROM: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '' };

  it('boots with every optional variable left empty', () => {
    expect(() => validateEnv({ ...copied })).not.toThrow();
  });

  it('reads an empty optional as undefined rather than an empty string', () => {
    expect(validateEnv({ ...copied }).EMAIL_FROM).toBeUndefined();
  });

  it('still rejects a genuinely malformed value', () => {
    expect(() => validateEnv({ ...copied, EMAIL_FROM: 'not-an-email' })).toThrow(/EMAIL_FROM/);
  });

  it('treats an empty provider key as missing when that provider is selected', () => {
    expect(() => validateEnv({ ...copied, AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('needs no key at all on the default stub provider', () => {
    expect(validateEnv({ ...copied }).AI_PROVIDER).toBe('stub');
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
});

import { validateEnv } from './Env.validation.js';

import type { Env } from './Env.validation.js';
import type { Provider } from '@nestjs/common';

export const ENV = Symbol('ENV');

/**
 * The validated environment as one injectable object.
 *
 * Modules previously rebuilt `Env` from `ConfigService` field by field, which meant
 * every new variable silently broke an unrelated module's type-check until each
 * mapping was updated by hand. Validating once and injecting the result removes
 * that whole class of breakage — and `validateEnv` is the same function
 * `ConfigModule` runs at boot, so there is still exactly one contract.
 */
export const envProvider: Provider = { provide: ENV, useFactory: (): Env => validateEnv(process.env) };

/**
 * `ConfigModule`'s `validate`: `validateEnv`, after putting every raw value
 * the `.env` file supplied into `process.env`.
 *
 * `ConfigModule` copies back to `process.env` only what `validate` returns as
 * a string, number or boolean. A variable `validateEnv` turns into a list or an
 * object — `AI_PROVIDER_ONLY`, `AI_FALLBACK_MODELS`, `AI_PROVIDER_IGNORE`,
 * `STRIPE_PRACTICE_PRICES` — was read from `.env`, validated, and then missing
 * when `envProvider` validated `process.env` again: a local boot refused a
 * `.env` that set `AI_PROVIDER_ONLY`, and a fallback list set only there was
 * silently dropped. On Vercel the platform sets `process.env` itself, so it
 * never showed. A variable already in the environment keeps its value, as
 * `ConfigModule` itself does without `override`.
 */
export function validateAndExposeEnv(raw: Record<string, unknown>): Env {
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && !(key in process.env)) {
      process.env[key] = value;
    }
  }

  return validateEnv(raw);
}

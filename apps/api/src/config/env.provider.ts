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

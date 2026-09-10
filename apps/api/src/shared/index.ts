/**
 * What a controller reaches for: the decorators it writes, the DTO helpers its
 * bodies are declared with, and the pipe behind them.
 *
 * Deliberately not the whole of `shared/`. Re-exporting the filter would pull
 * Sentry, and re-exporting the guards would pull Better Auth, into the import
 * graph of every module and every unit spec that touches one — for symmetry
 * nobody asked for, since the filter, the interceptor and the guards have
 * exactly one consumer between them and it is `app.module.ts`.
 *
 * Nothing inside `shared/` imports this barrel. Reaching for it from a sibling
 * folder is how a cycle gets built out of files that each look innocent.
 */
export * from './decorators/index.js';
export * from './dto/index.js';
export * from './pipes/index.js';

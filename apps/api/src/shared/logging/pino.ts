import { createRequire } from 'node:module';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import type { IncomingMessage } from 'node:http';
import type { LevelWithSilent, Logger } from 'pino';
import type { HttpLogger } from 'pino-http';

export const PINO = Symbol('PINO');
export const REQUEST_LOGGER = Symbol('REQUEST_LOGGER');

/**
 * Redaction is not optional here: bodies carry health data and headers carry
 * session cookies.
 *
 * The three health fields are listed even though request logging does not
 * record bodies by default. The list is what survives someone turning body
 * logging on to debug something at 2am — and a medication name in a log file is
 * not a mistake anyone can take back. Extend it in the same change that adds a
 * field, never afterwards.
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.newPassword',
  'req.body.conditions',
  'req.body.medications',
  'req.body.supplements'
] as const;

/**
 * The one logger instance, shared by Nest's own log lines and by request logging.
 *
 * This used to be `nestjs-pino`, which is CommonJS and `require()`s the ESM
 * `@nestjs/common`. Node 22.12+ allows that, so every local run and every test
 * passed — and the function runtime does not, so the deployed process died on its
 * first cold start with `ERR_REQUIRE_ESM` and nothing else to read. `pino` and
 * `pino-http` are plain CommonJS with no Nest dependency, and this file is the
 * whole of what the wrapper did for us.
 */
export function createPino({ level, pretty }: { readonly level: LevelWithSilent; readonly pretty: boolean }): Logger {
  // A pretty-printer is the lowest-stakes feature in the process and must never
  // be able to take it down. pino resolves a transport target at runtime from
  // this file's location, so a traced function bundle does not contain it — and
  // the deployed function once died at boot on exactly that, from a development
  // `NODE_ENV` that should never have reached it. Degrade to JSON and say so.
  const usePretty = pretty && prettyAvailable();
  const logger = pino({
    level,
    redact: { paths: [...REDACTED_PATHS], remove: true },
    transport: usePretty ? { target: 'pino-pretty' } : undefined
  });

  if (pretty && !usePretty) {
    logger.warn('pino-pretty was requested but is not installed here; logging JSON instead');
  }

  return logger;
}

/** Resolved from here, which is where pino would resolve it from too. */
function prettyAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');

    return true;
  } catch {
    return false;
  }
}

/**
 * One line per request, on the shared logger.
 *
 * @param silence a path prefix whose requests are not logged — health checks are
 *   the loudest and least informative lines in any log.
 */
export function createRequestLogger(logger: Logger, { silence }: { readonly silence: string }): HttpLogger {
  return pinoHttp({ autoLogging: { ignore: (request: IncomingMessage) => request.url?.startsWith(silence) ?? false }, logger });
}

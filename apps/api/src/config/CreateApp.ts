import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { HttpStatus, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { PinoLoggerService, REQUEST_LOGGER } from '../shared/logging/index.js';
import { setupSwagger } from './swagger.config.js';

import type { Env } from './Env.validation.js';
import type { Express } from 'express';
import type { HttpLogger } from 'pino-http';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * The one place an application is assembled.
 *
 * There are two entry points — `main.ts` for a long-running process and
 * `api/index.ts` for the serverless function — and they must not each own a copy
 * of this list. Anything added to one and forgotten in the other is a bug that
 * exists in exactly one environment, which is the hardest kind to find: the
 * ordering of `express.json()` against the auth path below is the sort of detail
 * whose absence looks like "sign-in is broken on production only".
 *
 * Pass an Express instance to have Nest mount onto it; the function entry needs a
 * handler it can call, not a server that listens.
 *
 * Deliberately **not** re-exported from `config/index.ts`. This file reaches the
 * whole application graph, and the barrel is imported by specs that want nothing
 * more than the `Env` type — pulling every module in behind them breaks them
 * under Jest's ESM interop with a require cycle that names neither file.
 */
export async function createApp(expressApp?: Express): Promise<NestExpressApplication> {
  // `bufferLogs` holds startup output until pino is wired, so a failure during
  // module init is still formatted and redacted rather than printed raw.
  const options = { bufferLogs: true, rawBody: false };
  const app = expressApp
    ? await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(expressApp), options)
    : await NestFactory.create<NestExpressApplication>(AppModule, options);

  const config = app.get(ConfigService<Env, true>);
  const prefix = config.get('API_PREFIX', { infer: true });
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.useLogger(app.get(PinoLoggerService));
  app.setGlobalPrefix(prefix);

  // Request logging at the Express level, ahead of everything: the auth handler
  // and the 404 fallback below both sit outside Nest's own middleware pipeline
  // and would otherwise never produce a line.
  app.use(app.get<HttpLogger>(REQUEST_LOGGER));

  // Exactly one proxy hop — the platform's edge. `true` would trust the whole
  // client-supplied X-Forwarded-For chain, and `request.ip` is what the rate
  // limiter keys on for anyone signed out. Without this every visitor behind the
  // edge shares one bucket and one attacker exhausts it for everybody.
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(compression());
  app.use(hpp());

  // Better Auth's handler needs the raw request stream. Registering the JSON
  // parser *after* the auth path — rather than globally before it — is the
  // difference between sign-in working and sign-in receiving an empty body.
  app.use(`/${prefix}/auth`, (_request: express.Request, _response: express.Response, next: express.NextFunction) => next());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  app.enableCors({
    credentials: true,
    // Session cookies mean CORS is an authentication control, not a convenience:
    // a wildcard here would let any origin drive an authenticated request.
    origin: (config.get('ALLOWED_ORIGINS', { infer: true }) ?? config.get('APP_URL', { infer: true })).split(',').map(value => value.trim())
  });

  app.enableVersioning({ defaultVersion: false as never, type: VersioningType.URI });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true }) && !isProduction) {
    setupSwagger(app, prefix);
  }

  // Nest mounts its router during init(), and `app.use()` before that would sit
  // *ahead* of every route. Initialising first is what makes the fallback below a
  // fallback rather than a catch-all that swallows the whole API.
  await app.init();

  // Express's finalhandler answers unmatched routes with an HTML error page that
  // names the framework and lacks the { code, message, statusCode } envelope every
  // client switches on.
  app
    .getHttpAdapter()
    .getInstance()
    .use((_request: express.Request, response: express.Response) => {
      response.status(HttpStatus.NOT_FOUND).json({ code: 'NOT_FOUND', message: 'Not found', statusCode: HttpStatus.NOT_FOUND });
    });

  return app;
}

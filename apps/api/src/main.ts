import 'reflect-metadata';

import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, Logger as NestLogger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { closeDatabase } from 'database';

import { AppModule } from './app.module.js';
import { setupSwagger } from './config/index.js';

import type { Env } from './config/index.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  // `bufferLogs` holds startup output until pino is wired, so a failure during
  // module init is still formatted and redacted rather than printed raw.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: false });
  const config = app.get(ConfigService<Env, true>);
  const prefix = config.get('API_PREFIX', { infer: true });
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(prefix);

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

  if (config.get('SWAGGER_ENABLED', { infer: true }) && !isProduction) {setupSwagger(app, prefix);}

  const port = config.get('PORT', { infer: true });

  // Nest mounts its router during init(), and `app.use()` before that would sit
  // *ahead* of every route. Initialising first is what makes this a fallback
  // rather than a catch-all that swallows the whole API.
  await app.init();

  // Express's finalhandler answers unmatched routes with an HTML error page that
  // names the framework and lacks the { code, message, statusCode } envelope every
  // client switches on.
  app.getHttpAdapter()
    .getInstance()
    .use((_request: express.Request, response: express.Response) => {
      response.status(HttpStatus.NOT_FOUND).json({ code: 'NOT_FOUND', message: 'Not found', statusCode: HttpStatus.NOT_FOUND });
    });

  await app.listen(port);

  process.on('beforeExit', () => {
    void closeDatabase();
  });

  new NestLogger('Bootstrap').log(`NutrIA API listening on :${port}/${prefix}`);
}

void bootstrap();

import { ConfigService } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';

import { createPino, createRequestLogger, PINO, REQUEST_LOGGER } from './pino.js';
import { PinoLoggerService } from './PinoLoggerService.js';

import type { Env } from '../../config/index.js';
import type { Logger } from 'pino';

/**
 * Global, because logging is not a feature any module opts into. `CreateApp`
 * installs the two pieces: the service as Nest's logger, and the request logger
 * at the Express level — ahead of the auth handler and the 404 fallback, which
 * Nest middleware would never see.
 */
@Global()
@Module({
  exports: [PINO, PinoLoggerService, REQUEST_LOGGER],
  providers: [
    {
      inject: [ConfigService],
      provide: PINO,
      useFactory: (config: ConfigService<Env, true>): Logger =>
        createPino({ level: config.get('LOG_LEVEL', { infer: true }), pretty: config.get('NODE_ENV', { infer: true }) === 'development' })
    },
    {
      inject: [ConfigService, PINO],
      provide: REQUEST_LOGGER,
      useFactory: (config: ConfigService<Env, true>, logger: Logger) =>
        createRequestLogger(logger, { silence: `/${config.get('API_PREFIX', { infer: true })}/health` })
    },
    PinoLoggerService
  ]
})
export class LoggingModule {}

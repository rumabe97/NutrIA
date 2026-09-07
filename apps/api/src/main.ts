import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { Logger as NestLogger } from '@nestjs/common';

import { closeDatabase } from 'database';

import { createApp } from './config/CreateApp.js';

import type { Env } from './config/index.js';

/**
 * The long-running entry point: a process that owns a port.
 *
 * Everything about how the application is put together lives in `createApp`,
 * shared with the serverless entry. This file is only the part that differs.
 */
async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);

  process.on('beforeExit', () => {
    void closeDatabase();
  });

  new NestLogger('Bootstrap').log(`NutrIA API listening on :${port}/${config.get('API_PREFIX', { infer: true })}`);
}

void bootstrap();

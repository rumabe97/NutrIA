import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { DatabaseHealthIndicator } from './database.health.js';

/**
 * `packages/database` owns the pool and exposes it as a lazily-created
 * singleton, so there is no client to provide here — this module exists to make
 * that ownership explicit and to carry the health indicator.
 *
 * The API is the only process that opens a connection. Nothing in `apps/web`
 * imports `database`.
 */
@Global()
@Module({ exports: [DatabaseHealthIndicator], imports: [TerminusModule], providers: [DatabaseHealthIndicator] })
export class DatabaseModule {}

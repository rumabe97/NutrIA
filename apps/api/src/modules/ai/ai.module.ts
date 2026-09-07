import { Global, Module } from '@nestjs/common';

import { ENV, envProvider } from '../../config/index.js';
import { AI_MODEL, resolveModel } from './ai.config.js';
import { AiClient } from './clients/AiClient.js';
import { PoolBuilder } from './PoolBuilder.service.js';
import { StructuredAiClient } from './clients/StructuredAiClient.js';

import type { Env } from '../../config/index.js';

/**
 * Global so plan generation can inject `PoolBuilder` without re-importing the
 * provider wiring. `AiClient` is bound to the structured implementation; when
 * `AI_PROVIDER=stub` the underlying model is null and the client reports itself
 * unavailable, which the pool builder handles by serving reuse alone.
 */
@Global()
@Module({
  exports: [AiClient, PoolBuilder],
  providers: [
    envProvider,
    { inject: [ENV], provide: AI_MODEL, useFactory: (env: Env) => resolveModel(env) },
    { provide: AiClient, useClass: StructuredAiClient },
    PoolBuilder
  ]
})
export class AiModule {}

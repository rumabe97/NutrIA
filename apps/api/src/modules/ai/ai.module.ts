import { Global, Module } from '@nestjs/common';

import { ENV, envProvider } from '../../config/index.js';
import { AI_CALL_SETTINGS, AI_IMAGE_MODEL, AI_MODEL, AI_MODEL_BUDGET, resolveCallSettings, resolveImageModel, resolveModel } from './ai.config.js';
import { AiClient } from './clients/AiClient.js';
import { ImageClient } from './clients/ImageClient.js';
import { ProviderImageClient } from './clients/ProviderImageClient.js';
import { PoolBuilder, RecipeIllustrator, RecipeRewriter } from './services/index.js';
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
  exports: [AiClient, ImageClient, PoolBuilder, RecipeIllustrator, RecipeRewriter],
  providers: [
    envProvider,
    { inject: [ENV], provide: AI_MODEL, useFactory: (env: Env) => resolveModel(env) },
    { inject: [ENV], provide: AI_CALL_SETTINGS, useFactory: (env: Env) => resolveCallSettings(env) },
    { inject: [ENV], provide: AI_MODEL_BUDGET, useFactory: (env: Env) => env.AI_BUDGET_SECONDS * 1000 },
    { provide: AiClient, useClass: StructuredAiClient },
    { inject: [ENV], provide: AI_IMAGE_MODEL, useFactory: (env: Env) => resolveImageModel(env) },
    { provide: ImageClient, useClass: ProviderImageClient },
    PoolBuilder,
    RecipeIllustrator,
    RecipeRewriter
  ]
})
export class AiModule {}

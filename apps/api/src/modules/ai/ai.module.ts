import { Global, Module } from '@nestjs/common';

import { ENV, envProvider } from '../../config/index.js';
import {
  AI_CALL_SETTINGS,
  AI_IMAGE_MODEL,
  AI_MODEL,
  AI_MODEL_BUDGET,
  AI_OUTPUT_CAP,
  AI_PICTURES,
  AI_REWRITE_CLIENT,
  AI_SECRETS,
  resolveCallSettings,
  resolveImageModel,
  resolveModel,
  resolveOutputCap,
  resolvePictureSettings,
  resolveRewriteModel
} from './ai.config.js';
import { AiClient } from './clients/AiClient.js';
import { ImageClient } from './clients/ImageClient.js';
import { OpenRouterImageClient } from './clients/OpenRouterImageClient.js';
import { OpenRouterVisionJudgeClient } from './clients/OpenRouterVisionJudgeClient.js';
import { PictureImageClient } from './clients/PictureImageClient.js';
import { PictureJudgeClient } from './clients/PictureJudgeClient.js';
import { providerCredentials } from './clients/redact.js';
import { ProviderImageClient } from './clients/ProviderImageClient.js';
import { PoolBuilder, RecipeIllustrator, RecipeRewriter } from './services/index.js';
import { StructuredAiClient } from './clients/StructuredAiClient.js';

import type { AiCallSettings, PictureSettings } from './ai.config.js';
import type { Env } from '../../config/index.js';

/**
 * Global so plan generation can inject `PoolBuilder` without re-importing the
 * provider wiring. `AiClient` is bound to the structured implementation; when
 * `AI_PROVIDER=stub` the underlying model is null and the client reports itself
 * unavailable, which the pool builder handles by serving reuse alone.
 */
@Global()
@Module({
  exports: [AI_PICTURES, AiClient, ImageClient, PictureImageClient, PictureJudgeClient, PoolBuilder, RecipeIllustrator, RecipeRewriter],
  providers: [
    envProvider,
    { inject: [ENV], provide: AI_MODEL, useFactory: (env: Env) => resolveModel(env) },
    { inject: [ENV], provide: AI_CALL_SETTINGS, useFactory: (env: Env) => resolveCallSettings(env) },
    { inject: [ENV], provide: AI_MODEL_BUDGET, useFactory: (env: Env) => env.AI_BUDGET_SECONDS * 1000 },
    { inject: [ENV], provide: AI_OUTPUT_CAP, useFactory: (env: Env) => resolveOutputCap(env) },
    { inject: [ENV], provide: AI_SECRETS, useFactory: (env: Env) => providerCredentials(env) },
    { provide: AiClient, useClass: StructuredAiClient },
    // The rewrite sweep's own client, on `AI_REWRITE_MODEL` where it is set.
    {
      inject: [ENV, AI_CALL_SETTINGS, AI_SECRETS],
      provide: AI_REWRITE_CLIENT,
      useFactory: (env: Env, settings: AiCallSettings, secrets: readonly string[]) =>
        new StructuredAiClient(resolveRewriteModel(env), settings, secrets)
    },
    { inject: [ENV], provide: AI_IMAGE_MODEL, useFactory: (env: Env) => resolveImageModel(env) },
    { provide: ImageClient, useClass: ProviderImageClient },
    // The dish pictures (`0066`): null settings — the stub provider, or no key — draw and judge nothing.
    { inject: [ENV], provide: AI_PICTURES, useFactory: (env: Env) => resolvePictureSettings(env) },
    {
      inject: [AI_PICTURES, AI_SECRETS],
      provide: PictureImageClient,
      useFactory: (settings: PictureSettings | null, secrets: readonly string[]) => new OpenRouterImageClient(settings, secrets)
    },
    {
      inject: [AI_PICTURES, AI_SECRETS],
      provide: PictureJudgeClient,
      useFactory: (settings: PictureSettings | null, secrets: readonly string[]) => new OpenRouterVisionJudgeClient(settings, secrets)
    },
    PoolBuilder,
    RecipeIllustrator,
    RecipeRewriter
  ]
})
export class AiModule {}

import { Global, Module } from '@nestjs/common';

import { ENV, envProvider } from '../../config/index.js';
import {
  AI_CALL_SETTINGS,
  AI_MODEL,
  AI_MODEL_BUDGET,
  AI_OUTPUT_CAP,
  AI_PICTURE_CAP,
  AI_PICTURES,
  AI_REWRITE_CLIENT,
  AI_SECRETS,
  PICTURE_CANDIDATE_CLOCK,
  picturesStubbed,
  resolveCallSettings,
  resolveModel,
  resolveOutputCap,
  resolvePictureSettings,
  resolveRewriteModel
} from './ai.config.js';
import { AiClient } from './clients/AiClient.js';
import { BackgroundTaskService } from '../../shared/services/index.js';
import { DishPictureService, PictureCandidatesService, PoolBuilder, RecipeRewriter } from './services/index.js';
import { OpenRouterImageClient } from './clients/OpenRouterImageClient.js';
import { OpenRouterVisionJudgeClient } from './clients/OpenRouterVisionJudgeClient.js';
import { PictureCandidateStore } from './clients/PictureCandidateStore.js';
import { PictureImageClient } from './clients/PictureImageClient.js';
import { PictureJudgeClient } from './clients/PictureJudgeClient.js';
import { PictureStore } from './clients/PictureStore.js';
import { providerCredentials } from './clients/redact.js';
import { StructuredAiClient } from './clients/StructuredAiClient.js';
import { StubPictureCandidateStore, StubPictureImageClient, StubPictureJudgeClient, StubPictureStore } from './clients/StubPictureClients.js';
import { VercelBlobPictureCandidateStore } from './clients/VercelBlobPictureCandidateStore.js';
import { VercelBlobPictureStore } from './clients/VercelBlobPictureStore.js';

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
  exports: [
    AiClient,
    DishPictureService,
    PictureCandidatesService,
    PictureCandidateStore,
    PictureImageClient,
    PictureJudgeClient,
    PictureStore,
    PoolBuilder,
    RecipeRewriter
  ],
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
    // The dish pictures (`0066`). Null settings — no key — draw and judge nothing;
    // the stub provider draws, judges and keeps with stubs a test can replace.
    { inject: [ENV], provide: AI_PICTURES, useFactory: (env: Env) => resolvePictureSettings(env) },
    { inject: [ENV], provide: AI_PICTURE_CAP, useFactory: (env: Env) => env.AI_IMAGE_MONTHLY_CAP_USD },
    {
      inject: [ENV, AI_PICTURES, AI_SECRETS],
      provide: PictureImageClient,
      useFactory: (env: Env, settings: PictureSettings | null, secrets: readonly string[]) =>
        picturesStubbed(env) ? new StubPictureImageClient() : new OpenRouterImageClient(settings, secrets)
    },
    {
      inject: [ENV, AI_PICTURES, AI_SECRETS],
      provide: PictureJudgeClient,
      useFactory: (env: Env, settings: PictureSettings | null, secrets: readonly string[]) =>
        picturesStubbed(env) ? new StubPictureJudgeClient() : new OpenRouterVisionJudgeClient(settings, secrets)
    },
    {
      inject: [ENV, AI_SECRETS],
      provide: PictureStore,
      useFactory: (env: Env, secrets: readonly string[]) =>
        picturesStubbed(env) ? new StubPictureStore() : new VercelBlobPictureStore(env.BLOB_READ_WRITE_TOKEN?.trim() || null, secrets)
    },
    // The rejected pictures that wait for the owner (`0072`): a private store under its own token.
    // Without it nothing is kept and drawing is as it was; the stub keeps them in memory.
    {
      inject: [ENV, AI_SECRETS],
      provide: PictureCandidateStore,
      useFactory: (env: Env, secrets: readonly string[]) =>
        picturesStubbed(env)
          ? new StubPictureCandidateStore()
          : new VercelBlobPictureCandidateStore(env.BLOB_CANDIDATES_READ_WRITE_TOKEN?.trim() || null, secrets)
    },
    { provide: PICTURE_CANDIDATE_CLOCK, useValue: () => new Date() },
    BackgroundTaskService,
    DishPictureService,
    PictureCandidatesService,
    PoolBuilder,
    RecipeRewriter
  ]
})
export class AiModule {}

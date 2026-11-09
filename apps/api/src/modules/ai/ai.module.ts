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
  ASSISTANT_CALL_SETTINGS,
  ASSISTANT_CAP,
  ASSISTANT_CLIENT,
  ASSISTANT_MODEL,
  ASSISTANT_SETTINGS,
  PICTURE_CANDIDATE_CLOCK,
  picturesStubbed,
  resolveAssistantModel,
  resolveCallSettings,
  resolveModel,
  resolveOutputCap,
  resolvePictureSettings,
  resolveRewriteModel
} from './ai.config.js';
import { AiClient } from './clients/AiClient.js';
import { AnthropicStreamingClient } from './clients/AnthropicStreamingClient.js';
import { BackgroundTaskService } from '../../shared/services/index.js';
import { DishPictureService, PictureCandidatesService, PoolBuilder, RecipeRewriter } from './services/index.js';
import { OpenRouterImageClient } from './clients/OpenRouterImageClient.js';
import { OpenRouterVisionJudgeClient } from './clients/OpenRouterVisionJudgeClient.js';
import { PictureCandidateStore } from './clients/PictureCandidateStore.js';
import { PictureImageClient } from './clients/PictureImageClient.js';
import { PictureJudgeClient } from './clients/PictureJudgeClient.js';
import { PictureStore } from './clients/PictureStore.js';
import { providerCredentials } from './clients/redact.js';
import { StreamingAiClient } from './clients/StreamingAiClient.js';
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
    ASSISTANT_CAP,
    ASSISTANT_CLIENT,
    DishPictureService,
    PictureCandidatesService,
    PictureCandidateStore,
    PictureImageClient,
    PictureJudgeClient,
    PictureStore,
    PoolBuilder,
    RecipeRewriter,
    StreamingAiClient
  ],
  providers: [
    envProvider,
    { inject: [ENV], provide: AI_MODEL, useFactory: (env: Env) => resolveModel(env) },
    { inject: [ENV], provide: AI_CALL_SETTINGS, useFactory: (env: Env) => resolveCallSettings(env) },
    { inject: [ENV], provide: AI_MODEL_BUDGET, useFactory: (env: Env) => env.AI_BUDGET_SECONDS * 1000 },
    { inject: [ENV], provide: AI_OUTPUT_CAP, useFactory: (env: Env) => resolveOutputCap(env) },
    { inject: [ENV], provide: AI_SECRETS, useFactory: (env: Env) => providerCredentials(env) },
    { provide: AiClient, useClass: StructuredAiClient },
    // The assistant (project 023, `0104`): its own Anthropic client, on its own
    // key and its own model, beside whatever provider generation runs on. With no
    // `ANTHROPIC_API_KEY` the model is null and both clients report themselves
    // unavailable, which is how the API boots and generates plans with no
    // assistant rather than refusing to boot.
    { inject: [ENV], provide: ASSISTANT_MODEL, useFactory: (env: Env) => resolveAssistantModel(env) },
    { provide: ASSISTANT_SETTINGS, useValue: ASSISTANT_CALL_SETTINGS },
    { inject: [ENV], provide: ASSISTANT_CAP, useFactory: (env: Env) => env.AI_ASSISTANT_MONTHLY_CAP_USD ?? null },
    { provide: StreamingAiClient, useClass: AnthropicStreamingClient },
    // The label call (`0104` clause 2) goes through the structured client that
    // already exists, on the assistant's model: a question's label is a schema
    // with one field, and nothing about it needs a second implementation.
    {
      inject: [ENV, AI_SECRETS],
      provide: ASSISTANT_CLIENT,
      useFactory: (env: Env, secrets: readonly string[]) => new StructuredAiClient(resolveAssistantModel(env), ASSISTANT_CALL_SETTINGS, secrets)
    },
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

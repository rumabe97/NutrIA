import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider-v2';

import type { Env } from '../../config/index.js';
import type { LanguageModel } from 'ai';

export const AI_MODEL = Symbol('AI_MODEL');

/**
 * Resolves the configured provider to a model.
 *
 * The only place a vendor SDK is named. Feature code depends on `AiClient`, so
 * switching provider is an environment change rather than a code change — which is
 * what makes running on a free tier, a local model, or a paid account the same
 * decision made three different ways.
 * See [`0006`](../../../../docs/decisions/0006-reuse-before-generating.md).
 *
 * `stub` returns null: the pool builder then makes no call at all. That is not a
 * test affordance, it is how the product runs with no account and no spend while
 * reuse covers demand.
 */
export function resolveModel(env: Env): LanguageModel | null {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropic({ apiKey: required(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY') })(env.AI_MODEL);

    case 'google':
      return createGoogleGenerativeAI({ apiKey: required(env.GOOGLE_API_KEY, 'GOOGLE_API_KEY') })(env.AI_MODEL);

    case 'ollama':
      // Local, so no key. `AI_BASE_URL` points at the daemon.
      return createOllama({ baseURL: env.AI_BASE_URL ?? 'http://localhost:11434/api' })(env.AI_MODEL);

    case 'stub':
      return null;
  }
}

function required(value: string | undefined, name: string): string {
  // Env validation enforces this at boot; this guards the case where a provider is
  // switched at runtime in a test.
  if (!value) {throw new Error(`${name} is required when AI_PROVIDER selects it`);}

  return value;
}

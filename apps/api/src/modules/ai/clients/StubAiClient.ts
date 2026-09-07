import { Injectable } from '@nestjs/common';

import { AiClient } from './AiClient.js';

import type { AiRequest, AiResponse } from './AiClient.js';

/**
 * Used when `AI_PROVIDER=stub`.
 *
 * Reports itself unavailable rather than returning invented dishes. The pool
 * builder then serves whatever reuse supplies and fails honestly if that is not
 * enough — which is the correct behaviour for a deployment with no provider
 * configured, and keeps "no key" a supported state rather than a broken one.
 */
@Injectable()
export class StubAiClient extends AiClient {
  get isAvailable(): boolean {
    return false;
  }

  generate<T>(_request: AiRequest<T>): Promise<AiResponse<T>> {
    return Promise.reject(new Error('AI_UNAVAILABLE'));
  }
}

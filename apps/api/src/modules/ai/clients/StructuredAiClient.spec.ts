import { describe, expect, it } from '@jest/globals';
import { jsonSchema } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

import { AiCallError } from './AiClient.js';
import { StructuredAiClient } from './StructuredAiClient.js';

/**
 * A call the generation's time budget ended is not a provider failing: the
 * log says `timeout`, so an operator reads "the model was slow", not "the key
 * or the quota" (`0050`).
 */
describe('StructuredAiClient', () => {
  it('reports a call cut by its time budget as a timeout', async () => {
    // A model that never answers; only the signal ends the call.
    const model = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
        })
    });
    const client = new StructuredAiClient(model, { maxRetries: 0, sessionHeader: null });
    const failure = await client
      .generate({ prompt: 'Diseña platos', schema: jsonSchema({ type: 'object' }), signal: AbortSignal.timeout(20), system: 'Chef' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).failure).toMatchObject({ kind: 'timeout', status: null });
  });
});

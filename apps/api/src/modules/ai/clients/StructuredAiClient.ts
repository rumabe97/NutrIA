import { Inject, Injectable, Logger } from '@nestjs/common';
import { generateObject, NoObjectGeneratedError } from 'ai';

import { AnalyticsController } from 'core/controllers/Analytics';

import { AiClient } from './AiClient.js';
import { isQuotaExhausted } from './quota.js';
import { redactSecrets } from './redact.js';
import { AI_MODEL } from '../ai.config.js';

import type { AiRequest, AiResponse } from './AiClient.js';
import type { LanguageModel } from 'ai';

/**
 * The real client: `generateObject` against whichever model the environment chose.
 *
 * Structured output is the whole point — the schema is enforced by the SDK and
 * re-validated downstream, so free-text parsing never happens
 * (`docs/ARCHITECTURE.md` § Invariants).
 */
@Injectable()
export class StructuredAiClient extends AiClient {
  private readonly logger = new Logger(StructuredAiClient.name);

  constructor(@Inject(AI_MODEL) private readonly model: LanguageModel | null) {
    super();
  }

  get isAvailable(): boolean {
    return this.model !== null;
  }

  async generate<T>({ prompt, schema, system }: AiRequest<T>): Promise<AiResponse<T>> {
    if (!this.model) {throw new Error('No AI model configured; check AI_PROVIDER');}

    const model = typeof this.model === 'string' ? this.model : this.model.modelId;

    try {
      const result = await generateObject({ model: this.model, prompt, schema, system });
      const usage = { calls: 1, inputTokens: result.usage.inputTokens ?? 0, model, outputTokens: result.usage.outputTokens ?? 0 };

      // Counted here rather than at a caller because this is the only place a
      // request actually leaves the building. Never awaited into a failure: the
      // repository swallows its own errors (`0033`).
      await AnalyticsController.record('ai_call', null, { inputTokens: usage.inputTokens, model, ok: true, outputTokens: usage.outputTokens });

      return { object: result.object, usage };
    } catch (error: unknown) {
      // A refused call is the one that matters most on a free tier: it spent the
      // allowance and returned nothing.
      await AnalyticsController.record('ai_call', null, { model, ok: false, quotaExhausted: isQuotaExhausted(error) });

      // The model's raw text can contain anything, including a partial dish. It is
      // never surfaced and never stored — the caller sees a failure and retries.
      if (NoObjectGeneratedError.isInstance(error)) {
        this.logger.warn('Model returned no valid object for the requested schema');

        // The model's raw text never travels further than this.
        throw new Error('AI_INVALID_OUTPUT: el modelo no devolvió un objeto válido para el esquema', { cause: error });
      }

      // A provider's own message ("API key not valid", "quota exceeded", "model not
      // found") is the single most useful thing an operator can be told, and this
      // product is self-hosted — the operator *is* the user. Redacted, then carried
      // rather than replaced with a constant that says nothing.
      // An AI SDK APICallError carries the provider's response body, which is where
      // Gemini names the offending schema field — the message alone is just
      // "Request contains an invalid argument".
      const body = typeof error === 'object' && error !== null && 'responseBody' in error ? String((error as { responseBody?: unknown }).responseBody ?? '') : '';
      const detail = redactSecrets([error instanceof Error ? error.message : 'Unknown AI failure', body].filter(Boolean).join(' — '));

      this.logger.error(`AI provider rejected the request: ${detail}`);
      throw new Error(detail, { cause: error });
    }
  }
}

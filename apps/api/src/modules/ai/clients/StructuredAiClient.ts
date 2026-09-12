import { Inject, Injectable, Logger } from '@nestjs/common';
import { APICallError, generateObject, NoObjectGeneratedError, RetryError } from 'ai';

import { AnalyticsController } from 'core/controllers/Analytics';

import { AiCallError, AiClient } from './AiClient.js';
import { isQuotaExhausted } from './quota.js';
import { readGateway, readQuota } from './gateway.js';
import { redactSecrets } from './redact.js';
import { AI_CALL_SETTINGS, AI_MODEL } from '../ai.config.js';

import type { AiCall, AiFailure, AiRequest, AiResponse } from './AiClient.js';
import type { AiCallSettings } from '../ai.config.js';
import type { LanguageModel } from 'ai';

/**
 * The work, or the signal's abort — whichever settles first. The abandoned
 * work keeps its own handlers, so its late rejection is not an unhandled one.
 */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) {
    return work;
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    };

    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }

    work.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/**
 * The real client: `generateObject` against whichever model the environment chose.
 *
 * Structured output is the whole point — the schema is enforced by the SDK and
 * re-validated downstream, so free-text parsing never happens
 * (`docs/ARCHITECTURE.md` § Invariants).
 *
 * Every call also says how it went — who answered, how long it took, what a
 * gateway in front of the provider reported (`gateway.ts`) — as data on the
 * response, or on the `AiCallError` a failure throws, so a generation can keep
 * a log of its own calls whatever became of them.
 */
@Injectable()
export class StructuredAiClient extends AiClient {
  private readonly logger = new Logger(StructuredAiClient.name);

  constructor(
    @Inject(AI_MODEL) private readonly model: LanguageModel | null,
    // Per provider, from `resolveCallSettings`: behind a gateway, no retries and a session header.
    @Inject(AI_CALL_SETTINGS) private readonly settings: AiCallSettings
  ) {
    super();
  }

  get isAvailable(): boolean {
    return this.model !== null;
  }

  async generate<T>({ prompt, schema, session, signal, system }: AiRequest<T>): Promise<AiResponse<T>> {
    if (!this.model) {
      throw new Error('No AI model configured; check AI_PROVIDER');
    }

    const model = typeof this.model === 'string' ? this.model : this.model.modelId;
    // Only a gateway is told which generation a call belongs to: a direct
    // provider has no use for our job id, and is not sent it.
    const headers = session && this.settings.sessionHeader ? { [this.settings.sessionHeader]: session } : undefined;
    const started = Date.now();

    try {
      // Raced against the signal as well as handed to it. On the platform a call
      // ran on past its aborted signal until the function was killed at 300 s,
      // and the generation waited with it; whatever the transport does with the
      // signal, a call that outlives its budget is abandoned here, not awaited.
      const result = await untilAborted(
        generateObject({ abortSignal: signal, headers, maxRetries: this.settings.maxRetries, model: this.model, prompt, schema, system }),
        signal
      );
      const usage = { calls: 1, inputTokens: result.usage.inputTokens ?? 0, model, outputTokens: result.usage.outputTokens ?? 0 };
      const call: AiCall = {
        answeredModel: result.response.modelId || null,
        cachedInputTokens: result.usage.inputTokenDetails.cacheReadTokens ?? null,
        gateway: readGateway(result.response.headers),
        ms: Date.now() - started,
        reasoningTokens: result.usage.outputTokenDetails.reasoningTokens ?? null
      };

      // Counted here rather than at a caller because this is the only place a
      // request actually leaves the building. Never awaited into a failure: the
      // repository swallows its own errors (`0033`).
      await AnalyticsController.record('ai_call', null, {
        answeredModel: call.answeredModel,
        costUsd: call.gateway?.costUsd ?? null,
        inputTokens: usage.inputTokens,
        model,
        ms: call.ms,
        ok: true,
        outputTokens: usage.outputTokens,
        provider: call.gateway?.provider ?? null,
        reasoningTokens: call.reasoningTokens
      });

      return { call, object: result.object, usage };
    } catch (error: unknown) {
      // A call the SDK retried fails as a RetryError; what the provider said is
      // on its last attempt.
      const last = RetryError.isInstance(error) ? error.lastError : error;
      const api = APICallError.isInstance(last) ? last : null;
      const invalid = NoObjectGeneratedError.isInstance(error) ? error : null;
      // An AI SDK APICallError carries the provider's response body, which is where
      // Gemini names the offending schema field — the message alone is just
      // "Request contains an invalid argument" — and where it writes the quota.
      const body =
        api?.responseBody ??
        (typeof error === 'object' && error !== null && 'responseBody' in error
          ? String((error as { responseBody?: unknown }).responseBody ?? '')
          : '');
      // A provider's own message ("API key not valid", "quota exceeded", "model not
      // found") is the single most useful thing an operator can be told, and this
      // product is self-hosted — the operator *is* the user. Redacted, then carried
      // rather than replaced with a constant that says nothing.
      // Ended by the generation's time budget rather than by the provider: said
      // as such, so the log reads "the model was slow", not "the key or the quota".
      const timedOut = !invalid && signal?.aborted === true;
      const detail = timedOut
        ? `AI_TIMEOUT: no answer within the generation's time budget (${Math.round((Date.now() - started) / 1000)} s)`
        : redactSecrets([error instanceof Error ? error.message : 'Unknown AI failure', body].filter(Boolean).join(' — '));
      const failure: AiFailure = {
        gateway: readGateway(api?.responseHeaders ?? invalid?.response?.headers),
        kind: invalid ? 'invalid_output' : timedOut ? 'timeout' : 'provider',
        model,
        ms: Date.now() - started,
        quota: readQuota(detail),
        status: api?.statusCode ?? null
      };

      // A refused call is the one that matters most on a free tier: it spent the
      // allowance and returned nothing.
      await AnalyticsController.record('ai_call', null, {
        model,
        ms: failure.ms,
        ok: false,
        provider: failure.gateway?.provider ?? null,
        quotaExhausted: isQuotaExhausted(error),
        quotaLimit: failure.quota?.limit ?? null,
        retryAfterSeconds: failure.quota?.retryAfterSeconds ?? null,
        status: failure.status,
        timedOut
      });

      // The model's raw text can contain anything, including a partial dish. It is
      // never surfaced and never stored — the caller sees a failure and retries.
      if (invalid) {
        this.logger.warn('Model returned no valid object for the requested schema');

        // The model's raw text never travels further than this.
        throw new AiCallError('AI_INVALID_OUTPUT: el modelo no devolvió un objeto válido para el esquema', failure, { cause: error });
      }

      if (timedOut) {
        this.logger.warn(detail);
      } else {
        this.logger.error(`AI provider rejected the request: ${detail}`);
      }

      throw new AiCallError(detail, failure, { cause: error });
    }
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { APICallError, RetryError, streamText } from 'ai';

import { AnalyticsController } from 'core/controllers/Analytics';

import { AiCallError } from './AiClient.js';
import { AI_SECRETS, ASSISTANT_MODEL, ASSISTANT_SETTINGS, assistantCostUsd } from '../ai.config.js';
import { isQuotaExhausted } from './quota.js';
import { providerErrorType } from './providerErrorType.js';
import { redactSecrets } from './redact.js';
import { StreamingAiClient } from './StreamingAiClient.js';
import { untilAborted } from './untilAborted.js';

import type { AiCall, AiFailure, AiUsage } from './AiClient.js';
import type { AiCallSettings } from '../ai.config.js';
import type { AiStream, AiStreamEnd, AiStreamRequest } from './StreamingAiClient.js';
import type { LanguageModel } from 'ai';

/** What the client knows about the call it is making, carried through the three ways it can end. */
type StreamContext = {
  readonly feature: AiStreamRequest['feature'];
  readonly model: string;
  /**
   * What the provider actually said, when it said anything.
   *
   * `streamText` does not throw a provider's error at the reader: it hands it to
   * `onError` and **ends the text stream quietly**, so the promises then reject
   * with the SDK's own "No output generated. Check the stream for errors." A
   * client that reported only that would turn every refusal — a bad key, an
   * exhausted quota, a model that does not exist — into one sentence that names
   * none of them, which is precisely the failure this product refuses to ship
   * (`StructuredAiClient`: a provider's own message is the most useful thing an
   * operator can be told). Mutable because it is filled by a callback the SDK
   * owns.
   */
  readonly reported: { current: unknown };
  readonly signal?: AbortSignal;
  readonly started: number;
};

/**
 * The assistant's answer, written as it is read (project 023, `0104`).
 *
 * Anthropic directly, on its own key and its own model, whatever `AI_PROVIDER`
 * says — `resolveAssistantModel` says why that is deliberate rather than
 * careless. With no key the model is null, `isAvailable` is false and the route
 * says the assistant is unavailable: the API still boots and plans still
 * generate, because the assistant's key is the assistant's problem alone.
 *
 * Two things it does that the structured client never had to:
 *
 * - **It prices its own calls.** Anthropic returns no cost with an answer, where
 *   OpenRouter and the gateway both do (`gateway.ts`), and a monthly ceiling has
 *   to be read from what was billed. So the cost is computed from the model's
 *   published prices (`assistantCostUsd`); an unrecognised model records none,
 *   and the month's sum is then a floor — which is exactly how
 *   `AdminAiRepository` already reports a call nobody priced.
 * - **It records the call when the stream ends, not when it starts**, because
 *   that is when the token counts exist. All three endings get a row: the answer
 *   that finished, the one that failed, and the one nobody read to the end.
 *   **Only the first carries a cost**, and that is a real hole worth naming: a
 *   stream somebody abandons was paid for, and the token counts for it never
 *   arrive, so it records `costUsd: null` and the month's sum is a floor rather
 *   than a total. What bounds that hole is not this row but the person's own
 *   allowance, which counts the message whatever became of the answer (project
 *   023 phase 3). The row is here so the **call count** cannot lie downwards; it
 *   does nothing for the money, and this comment says so rather than implying
 *   otherwise.
 */
@Injectable()
export class AnthropicStreamingClient extends StreamingAiClient {
  private readonly logger = new Logger(AnthropicStreamingClient.name);

  constructor(
    @Inject(ASSISTANT_MODEL) private readonly model: LanguageModel | null,
    @Inject(ASSISTANT_SETTINGS) private readonly settings: AiCallSettings,
    // The configured credentials, scrubbed from whatever the provider says back.
    @Inject(AI_SECRETS) private readonly secrets: readonly string[]
  ) {
    super();
  }

  get isAvailable(): boolean {
    return this.model !== null;
  }

  stream({ feature, maxOutputTokens, messages, signal, system }: AiStreamRequest): AiStream {
    if (!this.model) {
      throw new Error('No assistant model configured; check ANTHROPIC_API_KEY');
    }

    const model = typeof this.model === 'string' ? this.model : this.model.modelId;
    const reported: { current: unknown } = { current: undefined };
    const result = streamText({
      abortSignal: signal,
      maxOutputTokens,
      maxRetries: this.settings.maxRetries,
      messages: messages.map(turn => ({ content: turn.text, role: turn.role })),
      model: this.model,
      // See `StreamContext.reported`. Also stops the SDK's default handler
      // printing a provider's raw error, key included, to the log.
      onError: ({ error }) => {
        reported.current = error;
      },
      system
    });

    let settle: (end: AiStreamEnd) => void = () => undefined;
    let fail: (error: unknown) => void = () => undefined;
    const finished = new Promise<AiStreamEnd>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });

    // A caller that only reads the text never looks at `finished`, and a
    // rejection nobody is waiting for would take the process down. Handled here,
    // once: the promise handed back still rejects for whoever does await it.
    void finished.catch(() => undefined);

    return { finished, text: this.read(result, { feature, model, reported, signal, started: Date.now() }, settle, fail) };
  }

  /**
   * The text, and the `ai_call` behind it.
   *
   * Raced against the signal as well as handed to the SDK: on the platform a
   * request ran on past its aborted signal until the function was killed at
   * 300 s, and `untilAborted` is why a call that outlives its budget is
   * abandoned rather than awaited. The same reasoning, one chunk at a time.
   */
  private async *read(
    result: ReturnType<typeof streamText>,
    context: StreamContext,
    settle: (end: AiStreamEnd) => void,
    fail: (error: unknown) => void
  ): AsyncGenerator<string> {
    const iterator = result.textStream[Symbol.asyncIterator]();
    // Both pessimistic on purpose: a generator somebody stops reading never
    // reaches the end of this function, only its `finally`, so the third ending
    // is the one neither of these records.
    let ended = false;
    let failure: AiCallError | undefined = undefined;

    try {
      for (;;) {
        const next = await untilAborted(iterator.next(), context.signal);

        if (next.done === true) {
          ended = true;

          break;
        }

        yield next.value;
      }

      settle(await this.finish(result, context));
    } catch (error: unknown) {
      failure = await this.failed(error, context, false);

      fail(failure);

      throw failure;
    } finally {
      if (!ended && failure === undefined) {
        // Counted, not costed: the tokens for an answer nobody finished reading
        // never arrive. See the note on the ceiling at the top of this file.
        fail(await this.failed(new Error('the answer was abandoned before it ended'), context, true));
      }

      await iterator.return?.();
    }
  }

  /** The finished answer: what it wrote, what it cost, and the row that says so. */
  private async finish(result: ReturnType<typeof streamText>, { feature, model, started }: StreamContext): Promise<AiStreamEnd> {
    const totals = await result.totalUsage;
    const response = await result.response;
    const usage: AiUsage = { calls: 1, inputTokens: totals.inputTokens ?? 0, model, outputTokens: totals.outputTokens ?? 0 };
    const call: AiCall = {
      answeredModel: response.modelId || null,
      cachedInputTokens: totals.inputTokenDetails.cacheReadTokens ?? null,
      // Anthropic is not a gateway: nothing in front of it reports a provider or a price.
      gateway: null,
      ms: Date.now() - started,
      reasoningTokens: totals.outputTokenDetails.reasoningTokens ?? null
    };

    // Counted here rather than at a caller because this is the only place a
    // request actually leaves the building. Never awaited into a failure: the
    // repository swallows its own errors (`0033`).
    await AnalyticsController.record('ai_call', null, {
      answeredModel: call.answeredModel,
      cachedInputTokens: call.cachedInputTokens,
      costUsd: assistantCostUsd(model, usage),
      feature,
      inputTokens: usage.inputTokens,
      kind: 'answer',
      model,
      ms: call.ms,
      ok: true,
      outputTokens: usage.outputTokens,
      provider: 'anthropic',
      reasoningTokens: call.reasoningTokens
    });

    return { call, usage };
  }

  /** A call that ended badly: its row, and the error the caller is given — with the credentials out of it. */
  private async failed(error: unknown, { feature, model, reported, signal, started }: StreamContext, abandoned: boolean): Promise<AiCallError> {
    // What the provider said, where it said anything: `error` is then the SDK's
    // own "no output generated", which names nothing an operator can act on.
    const said = abandoned ? error : (reported.current ?? error);
    // A call the SDK retried fails as a RetryError; what the provider said is on its last attempt.
    const last = RetryError.isInstance(said) ? said.lastError : said;
    const api = APICallError.isInstance(last) ? last : null;
    const timedOut = !abandoned && signal?.aborted === true;
    const detail = timedOut
      ? `AI_TIMEOUT: no answer within the assistant's time budget (${Math.round((Date.now() - started) / 1000)} s)`
      : redactSecrets(
          [said instanceof Error ? said.message : 'Unknown AI failure', api?.responseBody ?? ''].filter(Boolean).join(' — '),
          this.secrets
        );
    const failure: AiFailure = {
      gateway: null,
      kind: timedOut ? 'timeout' : 'provider',
      model,
      ms: Date.now() - started,
      quota: null,
      status: api?.statusCode ?? null
    };

    await AnalyticsController.record('ai_call', null, {
      abandoned,
      costUsd: null,
      // Why, as codes and never as the provider's prose (`providerErrorType`).
      errorType: providerErrorType(last, api?.responseBody),
      failure: abandoned ? 'abandoned' : failure.kind,
      feature,
      kind: 'answer',
      model,
      ms: failure.ms,
      ok: false,
      provider: 'anthropic',
      quotaExhausted: isQuotaExhausted(said),
      status: failure.status,
      timedOut
    });

    if (abandoned) {
      this.logger.warn(`The assistant's answer was abandoned after ${String(failure.ms)} ms; the call is recorded as spent.`);
    } else if (timedOut) {
      this.logger.warn(detail);
    } else {
      this.logger.error(`The assistant's provider rejected the request: ${detail}`);
    }

    return new AiCallError(detail, failure, { cause: said });
  }
}

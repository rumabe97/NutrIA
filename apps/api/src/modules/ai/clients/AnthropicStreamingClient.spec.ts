import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { MockLanguageModelV4 } from 'ai/test';

import { AnalyticsController } from 'core/controllers/Analytics';

import { AiCallError } from './AiClient.js';
import { AnthropicStreamingClient } from './AnthropicStreamingClient.js';

import type { AiStreamRequest } from './StreamingAiClient.js';

const SETTINGS = { maxRetries: 0, sessionHeader: null };
const ASKED: AiStreamRequest = {
  feature: 'assistant',
  messages: [{ role: 'user', text: '¿Por qué llevo tanto almuerzo?' }],
  system: 'Respondes sobre nutrición.'
};

/**
 * What a provider reports, which is not what a caller reads: the SDK's own
 * usage is flat (`inputTokens: 1200`), the wire's is nested per kind. A mock
 * that sends the flat shape streams text perfectly and reports zero tokens,
 * which is a priced call recording no price.
 */
const SPENT = { inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1200, total: 1200 }, outputTokens: { reasoning: 0, text: 200, total: 200 } };

/** A model that writes `chunks` and then says what it spent. */
function writing(chunks: readonly string[], usage = SPENT): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ id: 'text-1', type: 'text-start' });

          for (const chunk of chunks) {
            controller.enqueue({ id: 'text-1', delta: chunk, type: 'text-delta' });
          }

          controller.enqueue({ id: 'text-1', type: 'text-end' });
          controller.enqueue({ finishReason: { raw: 'end_turn', unified: 'stop' }, type: 'finish', usage });
          controller.close();
        }
      })
    }),
    modelId: 'claude-haiku-5-5',
    provider: 'anthropic'
  });
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = '';

  for await (const chunk of stream) {
    text += chunk;
  }

  return text;
}

describe('AnthropicStreamingClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is unavailable with no key, which is how the API boots with no assistant', () => {
    const client = new AnthropicStreamingClient(null, SETTINGS, []);

    expect(client.isAvailable).toBe(false);
    expect(() => client.stream(ASKED)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('hands the answer over in pieces, which is the whole point of this client', async () => {
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);

    const client = new AnthropicStreamingClient(writing(['Tu almuerzo ', 'lleva un tercio ', 'del día.']), SETTINGS, []);
    const stream = client.stream(ASKED);
    const pieces: string[] = [];

    for await (const chunk of stream.text) {
      pieces.push(chunk);
    }

    expect(pieces).toEqual(['Tu almuerzo ', 'lleva un tercio ', 'del día.']);
    await expect(stream.finished).resolves.toMatchObject({ usage: { calls: 1, inputTokens: 1200, outputTokens: 200 } });
  });

  /**
   * Anthropic returns no cost with an answer, so the row is priced here or the
   * month's ceiling is never reached. 1,200 input tokens at 0.10 $ and 200
   * output at 0.50 $ per million is 0.00022 $ — the arithmetic, not a snapshot
   * of it, so a price change in the table cannot pass this test by accident.
   */
  it('prices its own call, because the provider does not', async () => {
    const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    const client = new AnthropicStreamingClient(writing(['vale']), SETTINGS, []);

    await collect(client.stream(ASKED).text);

    expect(record).toHaveBeenCalledWith(
      'ai_call',
      null,
      expect.objectContaining({ costUsd: (1200 * 0.1 + 200 * 0.5) / 1_000_000, feature: 'assistant', kind: 'answer', ok: true })
    );
  });

  it('names nobody on the row it records, like every other call this service makes', async () => {
    const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    const client = new AnthropicStreamingClient(writing(['vale']), SETTINGS, []);

    await collect(client.stream(ASKED).text);

    expect(record.mock.calls.every(([, userId]) => userId === null)).toBe(true);
  });

  /**
   * The money was spent whether or not anybody read the answer, and the gauge a
   * ceiling is read from may not lie downwards. Somebody closing a tab is this
   * test.
   */
  it('records a call whose answer nobody read to the end', async () => {
    const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    const client = new AnthropicStreamingClient(writing(['uno ', 'dos ', 'tres']), SETTINGS, []);
    const stream = client.stream(ASKED);

    for await (const chunk of stream.text) {
      expect(chunk).toBe('uno ');

      break;
    }

    await expect(stream.finished).rejects.toBeInstanceOf(AiCallError);
    expect(record).toHaveBeenCalledWith('ai_call', null, expect.objectContaining({ abandoned: true, feature: 'assistant', ok: false }));
  });

  /**
   * The thrown message is logged. A key has no shape the redaction patterns
   * know, so the configured credential is what has to be matched — the same
   * reasoning as `StructuredAiClient`, and the same mistake if it is missed.
   */
  it('keeps the configured credential out of the failure it reports', async () => {
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);

    const key = ['sk-ant', 'api03', 'b7f2c9d4e1a6'].join('-');
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error(`401 Unauthorized: key ${key} cannot use this model`);
      },
      modelId: 'claude-haiku-5-5'
    });
    const client = new AnthropicStreamingClient(model, SETTINGS, [key]);
    const failure = await collect(client.stream(ASKED).text).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).message).not.toContain(key);
    expect((failure as AiCallError).message).toContain('[redacted]');
  });

  it('reports a stream its budget ended as a timeout, not as the key or the quota', async () => {
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);

    const model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
        }),
      modelId: 'claude-haiku-5-5'
    });
    const client = new AnthropicStreamingClient(model, SETTINGS, []);
    const failure = await collect(client.stream({ ...ASKED, signal: AbortSignal.timeout(20) }).text).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).failure).toMatchObject({ kind: 'timeout', status: null });
  });
});

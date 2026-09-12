import { describe, expect, it, vi } from 'vitest';

import { summariseAiCalls } from './AdminController';

vi.mock('#repositories/Admin', () => ({ AdminRepository: {} }));
vi.mock('#repositories/Analytics', () => ({ AnalyticsRepository: {} }));

function at(minute: number): Date {
  return new Date(Date.UTC(2026, 8, 12, 6, minute));
}

/**
 * Today's calls by the model that answered (`0050`). Through a gateway the
 * name asked for is a combo; the allowance went to whatever answered, and
 * that is what the owner needs to see spent.
 */
describe('summariseAiCalls', () => {
  it('groups by the model that answered and who served it, with sums and a mean time', () => {
    const { byModel } = summariseAiCalls([
      {
        at: at(0),
        properties: {
          answeredModel: 'muse-spark',
          costUsd: 0,
          inputTokens: 5000,
          model: 'NutrIA-Fallback',
          ms: 60_000,
          ok: true,
          outputTokens: 12_000,
          provider: 'opencode-zen',
          reasoningTokens: 9000
        }
      },
      {
        at: at(1),
        properties: {
          answeredModel: 'muse-spark',
          inputTokens: 5000,
          model: 'NutrIA-Fallback',
          ms: 80_000,
          ok: true,
          outputTokens: 14_000,
          provider: 'opencode-zen',
          reasoningTokens: 11_000
        }
      },
      {
        at: at(2),
        properties: {
          answeredModel: 'mimo',
          inputTokens: 5000,
          model: 'NutrIA-Fallback',
          ms: 40_000,
          ok: true,
          outputTokens: 4000,
          provider: 'opencode-zen'
        }
      }
    ]);

    expect(byModel).toEqual([
      {
        averageMs: 70_000,
        calls: 2,
        costUsd: 0,
        failed: 0,
        inputTokens: 10_000,
        model: 'muse-spark',
        outputTokens: 26_000,
        provider: 'opencode-zen',
        reasoningTokens: 20_000
      },
      {
        averageMs: 40_000,
        calls: 1,
        costUsd: 0,
        failed: 0,
        inputTokens: 5000,
        model: 'mimo',
        outputTokens: 4000,
        provider: 'opencode-zen',
        reasoningTokens: 0
      }
    ]);
  });

  it('counts a failed call, and an event from before the gateway fields, against the model that was asked for', () => {
    const { byModel } = summariseAiCalls([
      { at: at(0), properties: { model: 'gemini-3.6-flash', ms: 400, ok: false, quotaExhausted: true } },
      { at: at(1), properties: { inputTokens: 100, model: 'gemini-3.6-flash', ok: true, outputTokens: 50 } }
    ]);

    expect(byModel).toEqual([expect.objectContaining({ averageMs: 400, calls: 2, failed: 1, model: 'gemini-3.6-flash', provider: null })]);
  });

  it('keeps the last refusal for quota, with the limit and the wait the provider wrote', () => {
    const { lastRefusal } = summariseAiCalls([
      { at: at(0), properties: { model: 'gemini-3.6-flash', ok: false, quotaExhausted: true, quotaLimit: 20, retryAfterSeconds: 40 } },
      { at: at(5), properties: { model: 'gemini-3.6-flash', ok: false, quotaExhausted: true, quotaLimit: 20, retryAfterSeconds: 26 } },
      { at: at(6), properties: { model: 'gemini-3.6-flash', ok: false, status: 503 } }
    ]);

    expect(lastRefusal).toEqual({ at: at(5).toISOString(), limit: 20, model: 'gemini-3.6-flash', retryAfterSeconds: 26 });
  });

  it('says nothing about a refusal on a day without one', () => {
    expect(summariseAiCalls([]).lastRefusal).toBeNull();
  });
});

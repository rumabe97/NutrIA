import { describe, expect, it } from '@jest/globals';

import { isQuotaExhausted } from './quota.js';

/*
 * A sweep that mistakes "no budget left" for "try again" attempted eighteen
 * recipes three times each against a provider that had already refused, and
 * emptied the same daily allowance plan generation draws on.
 */
describe('isQuotaExhausted', () => {
  it('recognises the provider’s own wording', () => {
    expect(isQuotaExhausted(new Error('You exceeded your current quota, please check your plan and billing details.'))).toBe(true);
    expect(isQuotaExhausted(new Error('Failed after 3 attempts. Last error: AI_APICallError: You exceeded your current quota'))).toBe(true);
    expect(isQuotaExhausted(new Error('429 RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isQuotaExhausted(new Error('insufficient_quota'))).toBe(true);
  });

  it('leaves an ordinary failure retryable', () => {
    expect(isQuotaExhausted(new Error('The model returned an invalid object for the schema'))).toBe(false);
    expect(isQuotaExhausted(new Error('fetch failed'))).toBe(false);
    expect(isQuotaExhausted(new Error('steps needs at least 4 steps'))).toBe(false);
  });

  it('handles a non-Error without throwing', () => {
    expect(isQuotaExhausted('quota exceeded')).toBe(true);
    expect(isQuotaExhausted(undefined)).toBe(false);
  });
});

import { describe, expect, it } from '@jest/globals';

import { redactSecrets } from './redact.js';

/**
 * These messages are surfaced to the operator and stored on the job row, and
 * provider SDKs sometimes echo the failing request. A credential must not ride
 * along with the diagnosis.
 */
// Assembled at runtime rather than written as literals. A key-shaped string in a
// tracked file trips `pnpm check:leaks`, which cannot tell a fixture from a real
// credential — and teaching it to would blunt the check that matters.
const FAKE = {
  anthropic: ['sk', 'ant', 'api03', 'AbCdEf123456'].join('-'),
  bearer: `Bearer ${['abc', 'def', 'ghi12345'].join('.')}`,
  google: `AIza${'SyD-1234567890abcdefg'}`
};

describe('redactSecrets', () => {
  it('keeps the useful part of a provider message', () => {
    expect(redactSecrets('API key not valid. Please pass a valid API key.')).toBe('API key not valid. Please pass a valid API key.');
  });

  it('removes an Anthropic key', () => {
    expect(redactSecrets(`bad key ${FAKE.anthropic}`)).toBe('bad key [redacted]');
  });

  it('removes a Google key', () => {
    expect(redactSecrets(`rejected ${FAKE.google}`)).toBe('rejected [redacted]');
  });

  it('removes a bearer token', () => {
    expect(redactSecrets(`header ${FAKE.bearer}`)).toBe('header [redacted]');
  });

  it('removes an api-key assignment', () => {
    expect(redactSecrets('sent with api_key=abcdef1234567890')).toContain('[redacted]');
  });

  it('truncates a very long message rather than storing a whole response body', () => {
    expect(redactSecrets('x'.repeat(500))).toHaveLength(301);
  });
});

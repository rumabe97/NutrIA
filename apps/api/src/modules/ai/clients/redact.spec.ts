import { describe, expect, it } from '@jest/globals';

import { providerCredentials, redactSecrets } from './redact.js';

import type { Env } from '../../../config/index.js';

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
  // The production provider's shape: a gateway key with no vendor prefix, no
  // header around it and no assignment before it — nothing any shape pattern
  // can recognise. Only the configured value matches it.
  gateway: ['9f2c4a', '17b8e0', '5d3196', 'c4ae72'].join(''),
  google: `AIza${'SyD-1234567890abcdefg'}`,
  // The generic `sk-` prefix: not Anthropic's `sk-ant-`, but the shape an
  // OpenAI-compatible gateway echoes from its own upstream.
  openai: `sk-${['proj', 'Ab12Cd34Ef56Gh78Ij90'].join('-')}`,
  // A base64-alphabet credential — `/` is valid there and in no pattern's
  // class. Ten chars ahead of the slash, so a shape pattern's `{8,}` still
  // has enough to match and stop, rather than failing to match at all.
  slashed: ['gwQm7x2pLw', '9zRt4vBnKd3hYs6e'].join('/')
};

describe('redactSecrets', () => {
  it('keeps the useful part of a provider message', () => {
    expect(redactSecrets('API key not valid. Please pass a valid API key.', [])).toBe('API key not valid. Please pass a valid API key.');
  });

  it('removes an Anthropic key', () => {
    expect(redactSecrets(`bad key ${FAKE.anthropic}`, [])).toBe('bad key [redacted]');
  });

  it('removes a Google key', () => {
    expect(redactSecrets(`rejected ${FAKE.google}`, [])).toBe('rejected [redacted]');
  });

  it('removes an OpenAI-style key a gateway echoes from its own upstream', () => {
    expect(redactSecrets(`upstream refused ${FAKE.openai}`, [])).toBe('upstream refused [redacted]');
  });

  it('removes a bearer token', () => {
    expect(redactSecrets(`header ${FAKE.bearer}`, [])).toBe('header [redacted]');
  });

  it('removes an api-key assignment', () => {
    expect(redactSecrets('sent with api_key=abcdef1234567890', [])).toContain('[redacted]');
  });

  it('truncates a very long message rather than storing a whole response body', () => {
    expect(redactSecrets('x'.repeat(500), [])).toHaveLength(301);
  });

  /** The hole the shapes leave, and why the configured value has to be matched too. */
  it('does not recognise a gateway key by shape alone', () => {
    expect(redactSecrets(`Upstream rejected key ${FAKE.gateway}`, [])).toContain(FAKE.gateway);
  });

  it('removes the configured credential from ordinary provider text', () => {
    expect(redactSecrets(`Upstream error: no credits for key ${FAKE.gateway} on model muse-spark`, [FAKE.gateway])).toBe(
      'Upstream error: no credits for key [redacted] on model muse-spark'
    );
  });

  it('removes every occurrence of it, not only the first', () => {
    expect(redactSecrets(`sent ${FAKE.gateway}; retried with ${FAKE.gateway}`, [FAKE.gateway])).not.toContain(FAKE.gateway);
  });

  it('scrubs before it truncates, so a key in a long body cannot ride in on the part that is kept', () => {
    expect(redactSecrets(`upstream said ${FAKE.gateway}: ${'detail '.repeat(100)}`, [FAKE.gateway])).not.toContain(FAKE.gateway);
  });

  it('leaves nothing of an adjacent secret, run either as pattern-then-value or the reverse', () => {
    // A regression case: run as two passes, either order lets one interfere
    // with the other. Values-first inserts `[`/`]` next to the Anthropic key,
    // taking it out of the shape pattern's class; patterns-first matches our
    // own credential only up to where its `Bearer ` prefix's class ends,
    // leaving the value-scrub searching for a string that is no longer whole.
    // Ranges computed against the untouched message and merged before any cut
    // is made are immune to both.
    const upstream = `Bearer ${FAKE.gateway}${FAKE.anthropic}`;

    expect(redactSecrets(upstream, [FAKE.gateway])).toBe('[redacted]');
  });

  it('redacts the whole of our own credential, tail included, when a pattern matches only its head', () => {
    // The regression a naive reorder introduces: `api_key=` is itself
    // pattern-matched, and that pattern's class stops at the credential's own
    // `/` — a character valid in base64, in no pattern's class. A two-pass
    // scrub in either order then leaves the credential's tail standing next
    // to `[redacted]`, which is the one string this function exists to catch.
    expect(redactSecrets(`api_key=${FAKE.slashed} is invalid`, [FAKE.slashed])).toBe('[redacted] is invalid');
    expect(redactSecrets(`authorization: Bearer ${FAKE.slashed} rejected`, [FAKE.slashed])).toBe('authorization: [redacted] rejected');
  });
});

describe('providerCredentials', () => {
  it('collects the configured provider keys and skips the ones that are unset', () => {
    const env = { ANTHROPIC_API_KEY: FAKE.anthropic, OMNIROUTE_API_KEY: FAKE.gateway } as unknown as Env;

    expect(providerCredentials(env)).toEqual([FAKE.anthropic, FAKE.gateway]);
  });

  it('collects the OpenRouter key too (0064)', () => {
    expect(providerCredentials({ OPENROUTER_API_KEY: FAKE.openai } as unknown as Env)).toEqual([FAKE.openai]);
  });

  it('skips a value too short to be a credential, which would blank out ordinary words instead', () => {
    expect(providerCredentials({ GOOGLE_API_KEY: 'k' } as unknown as Env)).toEqual([]);
  });

  it('trims a key pasted with stray whitespace, so it still matches what the provider echoes back trimmed', () => {
    // A value stored with the whitespace intact would never match: HTTP strips
    // it from the outgoing header, so the upstream's own text carries only the
    // trimmed key, and the untrimmed one this function held would search for a
    // string the message does not contain.
    const env = { OMNIROUTE_API_KEY: `  ${FAKE.gateway}\n` } as unknown as Env;
    const [trimmed] = providerCredentials(env);

    expect(trimmed).toBe(FAKE.gateway);
    expect(redactSecrets(`Incorrect API key provided: ${FAKE.gateway}.`, providerCredentials(env))).not.toContain(FAKE.gateway);
  });
});

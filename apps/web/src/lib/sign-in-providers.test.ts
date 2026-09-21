import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseProviders, signInProviders } from './sign-in-providers';

describe('parseProviders', () => {
  it('keeps what the API listed, in the order the buttons are drawn', () => {
    expect(parseProviders({ providers: ['apple', 'google'] })).toEqual(['google', 'apple']);
    expect(parseProviders({ providers: ['google'] })).toEqual(['google']);
  });

  it('drops a provider this app has no mark or name for', () => {
    expect(parseProviders({ providers: ['google', 'microsoft'] })).toEqual(['google']);
  });

  it('reads anything else as no providers', () => {
    expect(parseProviders(null)).toEqual([]);
    expect(parseProviders({})).toEqual([]);
    expect(parseProviders({ providers: 'google' })).toEqual([]);
  });
});

describe('signInProviders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the API once, and lets the answer be kept for a few minutes', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(JSON.stringify({ providers: ['google'] }), { status: 200 }));

    vi.stubGlobal('fetch', fetchStub);

    await expect(signInProviders()).resolves.toEqual(['google']);
    expect(String(fetchStub.mock.calls[0]?.[0])).toMatch(/\/settings\/sign-in-providers$/);
    expect(fetchStub.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 300 } });
  });

  it('draws no buttons when the API says no, or cannot be asked — the form still works', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(signInProviders()).resolves.toEqual([]);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')));
    await expect(signInProviders()).resolves.toEqual([]);
  });
});

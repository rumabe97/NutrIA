import { describe, expect, it, jest } from '@jest/globals';

import { OpenRouterImageClient } from './OpenRouterImageClient.js';
import { PictureCallError } from './pictureTransport.js';

import type { PictureSettings } from '../ai.config.js';

const KEY = ['sk-or-v1-', 'image', 'client', 'spec', '0123456789'].join('');

const SETTINGS: PictureSettings = {
  apiKey: KEY,
  imageModel: 'google/gemini-3.1-flash-lite-image',
  imageProviders: ['google-vertex/global'],
  judgeModel: 'qwen/qwen3-vl-235b-a22b-instruct',
  judgeProviders: ['deepinfra'],
  monthlyCapUsd: 10
};

/** A JPEG's first bytes and an APP11 segment's — the file as the model signed it, to be returned byte for byte. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xeb, 0x00, 0x08, 0x4a, 0x50, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);

type Route = (url: string) => { readonly body: unknown; readonly headers?: Record<string, string>; readonly status?: number };

function client(route: Route, secrets: readonly string[] = []): { readonly calls: string[]; readonly image: OpenRouterImageClient } {
  const calls: string[] = [];
  const fake = jest.fn(async (input: Request | string | URL) => {
    const url = String(input);
    const { body, headers, status } = route(url);

    calls.push(url);

    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers, status: status ?? 200 });
  });

  return { calls, image: new OpenRouterImageClient(SETTINGS, secrets, fake as unknown as typeof fetch, [0, 0]) };
}

function drawn(bytes: Uint8Array, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'gen-img-42', data: [{ b64_json: Buffer.from(bytes).toString('base64') }], ...extra };
}

describe('OpenRouterImageClient.draw', () => {
  it('returns the file byte for byte, its type from its bytes, what it cost and who drew it', async () => {
    const { image } = client(() => ({ body: drawn(JPEG, { usage: { cost: 0.03367 } }), headers: { 'x-provider-name': 'Google' } }));
    const picture = await image.draw('prompt');

    expect(picture).toEqual({
      bytes: JPEG,
      contentType: 'image/jpeg',
      costUsd: 0.03367,
      generationId: 'gen-img-42',
      model: 'google/gemini-3.1-flash-lite-image',
      provider: 'Google'
    });
  });

  it('reads the cost from /generation when the answer does not carry it, until it is filed', async () => {
    let lookups = 0;
    const { calls, image } = client(url => {
      if (url.includes('/generation')) {
        lookups += 1;

        return lookups === 1
          ? { body: { error: { message: 'not found' } }, status: 404 }
          : { body: { data: { provider_name: 'Google', total_cost: 0.0337 } } };
      }

      return { body: drawn(JPEG) };
    });
    const picture = await image.draw('prompt');

    expect(picture).toMatchObject({ costUsd: 0.0337, provider: 'Google' });
    expect(calls.filter(url => url.endsWith('/generation?id=gen-img-42'))).toHaveLength(2);
  });

  it('says it does not know the cost when OpenRouter never files it, rather than guessing', async () => {
    const { image } = client(url => (url.includes('/generation') ? { body: { data: {} } } : { body: drawn(JPEG) }));

    expect((await image.draw('prompt')).costUsd).toBeNull();
  });

  it('tells a PNG and a WebP from a JPEG by their bytes, and takes a data URL as its base64', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const webp = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]);
    const asDataUrl = { data: [{ b64_json: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }], usage: { cost: 0.03 } };

    expect((await client(() => ({ body: asDataUrl })).image.draw('p')).contentType).toBe('image/png');
    expect((await client(() => ({ body: drawn(webp, { usage: { cost: 0.03 } }) })).image.draw('p')).contentType).toBe('image/webp');
  });

  it.each([
    ['no image at all', { data: [] }],
    ['an empty image', { data: [{ b64_json: '' }] }],
    ['a URL instead of the file', { data: [{ url: 'https://example.com/a.jpg' }] }],
    ['a file that is not a picture', drawn(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]))]
  ])('fails a call that answers with %s', async (_case, body) => {
    await expect(client(() => ({ body })).image.draw('prompt')).rejects.toBeInstanceOf(PictureCallError);
  });

  it('carries the status of a refusal, without the key or what the provider echoed back', async () => {
    const refusal = {
      error: { message: `Key limit exceeded for ${KEY}`, metadata: { provider_name: 'Google', raw: 'your prompt was: SECRET PROMPT' } }
    };
    const failure = (await client(() => ({ body: refusal, status: 402 }))
      .image.draw('prompt')
      .catch((error: unknown) => error)) as PictureCallError;

    expect(failure).toBeInstanceOf(PictureCallError);
    expect(failure.status).toBe(402);
    expect(failure.message).toContain('OpenRouter /images answered 402');
    expect(failure.message).not.toContain(KEY);
    expect(failure.message).not.toContain('SECRET PROMPT');
  });

  it('fails a call whose answer is not JSON, and one that never arrives, without the key', async () => {
    await expect(client(() => ({ body: '<html>' })).image.draw('p')).rejects.toThrow('with no JSON');

    const unreachable = new OpenRouterImageClient(SETTINGS, [], (async () => {
      throw new Error(`connect ECONNREFUSED — Authorization: Bearer ${KEY}`);
    }) as unknown as typeof fetch);
    const failure = (await unreachable.draw('p').catch((error: unknown) => error)) as PictureCallError;

    expect(failure.status).toBeNull();
    expect(failure.message).toContain('OpenRouter /images failed');
    expect(failure.message).not.toContain(KEY);
  });

  it('passes its signal to the call', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    const fake = (async (_input: Request | string | URL, init?: RequestInit) => {
      seen.push(init?.signal);

      return new Response(JSON.stringify(drawn(JPEG, { usage: { cost: 0.03 } })));
    }) as unknown as typeof fetch;
    const signal = AbortSignal.timeout(10_000);

    await new OpenRouterImageClient(SETTINGS, [], fake).draw('p', signal);

    expect(seen).toEqual([signal]);
  });
});

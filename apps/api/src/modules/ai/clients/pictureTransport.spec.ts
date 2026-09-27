import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { dirname, join } from 'node:path';

import { NO_RETENTION, OPENROUTER_API, OpenRouterPictures, pinnedProvider } from './pictureTransport.js';
import { OpenRouterImageClient } from './OpenRouterImageClient.js';
import { OpenRouterVisionJudgeClient } from './OpenRouterVisionJudgeClient.js';
import { resolvePictureSettings } from '../ai.config.js';
import { validateEnv } from '../../../config/Env.validation.js';

import type { PinnedProvider } from './pictureTransport.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const KEY = ['sk-or-v1-', 'picture', 'test', 'key', '0123456789'].join('');

const base = {
  AI_PROVIDER: 'openrouter',
  AI_PROVIDER_ONLY: 'deepinfra',
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  OPENROUTER_API_KEY: 'sk-or-v1-the-text-key-not-this-one',
  OPENROUTER_IMAGE_API_KEY: KEY
};

type Sent = {
  readonly body: Record<string, unknown> | null;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
};

/** A fetch that answers every picture call as OpenRouter would, and keeps what it was sent. */
function recordingFetch(): { readonly fetch: typeof fetch; readonly sent: Sent[] } {
  const sent: Sent[] = [];
  const answers: Record<string, unknown> = {
    '/chat/completions': { choices: [{ message: { content: '{"foods": [], "extras": [], "ingredients": []}' } }], usage: { cost: 0.0003 } },
    '/images': { id: 'gen-img-1', data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64') }], usage: { cost: 0.0337 } }
  };
  const fake = jest.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;

    sent.push({ body, headers: init?.headers as Record<string, string>, method: init?.method ?? 'GET', url });

    return new Response(JSON.stringify(answers[url.replace(OPENROUTER_API, '')] ?? {}), { status: 200 });
  });

  return { fetch: fake as unknown as typeof fetch, sent };
}

/** Every request the two picture clients can make, made. */
async function everyRequest(env: Record<string, string>): Promise<readonly Sent[]> {
  const settings = resolvePictureSettings(validateEnv(env));
  const { fetch, sent } = recordingFetch();
  const image = new OpenRouterImageClient(settings, [], fetch, []);
  const judge = new OpenRouterVisionJudgeClient(settings, [], fetch);

  await image.draw('A realistic photograph of one serving of a home-cooked dish');
  await judge.see({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' });
  await judge.match([{ amount: 'main', name: 'rice', specific: true }], [{ name: 'Rice', slug: 'arroz' }]);

  return sent;
}

/*
 * PRD 3: every image and judge call is pinned to an endpoint that keeps
 * nothing, with fallbacks off, and no request can go out without it.
 */
describe('the provider block on every picture request', () => {
  it('pins the image call to Google Vertex and both judge calls to DeepInfra, keeping nothing and falling back to no one', async () => {
    const sent = await everyRequest(base);
    const posts = sent.filter(request => request.method === 'POST');

    expect(posts.map(request => request.url)).toEqual([
      `${OPENROUTER_API}/images`,
      `${OPENROUTER_API}/chat/completions`,
      `${OPENROUTER_API}/chat/completions`
    ]);
    expect(posts.map(request => request.body?.['provider'])).toEqual([
      { allow_fallbacks: false, data_collection: 'deny', only: ['google-vertex/global'], zdr: true },
      { allow_fallbacks: false, data_collection: 'deny', only: ['deepinfra'], zdr: true },
      { allow_fallbacks: false, data_collection: 'deny', only: ['deepinfra'], zdr: true }
    ]);
  });

  it('asks for the model, 4:3 and 1K on the image call, and the judge model on both judge calls', async () => {
    const [image, see, match] = (await everyRequest(base)).filter(request => request.method === 'POST');

    expect(image?.body).toMatchObject({ aspect_ratio: '4:3', model: 'google/gemini-3.1-flash-lite-image', n: 1, resolution: '1K' });
    expect(see?.body).toMatchObject({ model: 'qwen/qwen3-vl-235b-a22b-instruct', response_format: { type: 'json_object' } });
    expect(match?.body).toMatchObject({ model: 'qwen/qwen3-vl-235b-a22b-instruct', response_format: { type: 'json_object' } });
  });

  it('takes the companies from the environment, and nothing else about the block', async () => {
    const sent = await everyRequest({ ...base, AI_IMAGE_PROVIDER_ONLY: 'google-vertex/europe', AI_JUDGE_PROVIDER_ONLY: 'deepinfra,parasail' });

    expect(sent.filter(request => request.method === 'POST').map(request => request.body?.['provider'])).toEqual([
      { ...NO_RETENTION, only: ['google-vertex/europe'] },
      { ...NO_RETENTION, only: ['deepinfra', 'parasail'] },
      { ...NO_RETENTION, only: ['deepinfra', 'parasail'] }
    ]);
  });

  it('sends every request to OpenRouter’s API with the pictures’ own key, never the text key', async () => {
    const sent = await everyRequest(base);

    expect(sent.every(request => request.url.startsWith('https://openrouter.ai/api/v1/'))).toBe(true);
    expect(sent.every(request => request.headers['Authorization'] === `Bearer ${KEY}`)).toBe(true);
  });

  it('writes the block over a provider a body carries, so no caller can loosen it', async () => {
    const { fetch, sent } = recordingFetch();
    const api = new OpenRouterPictures(KEY, [], fetch);

    await api.post(
      '/images',
      { model: 'm', provider: { allow_fallbacks: true, data_collection: 'allow', only: ['anyone'], zdr: false } },
      pinnedProvider(['google-vertex/global'])
    );

    expect(sent[0]?.body?.['provider']).toEqual({ allow_fallbacks: false, data_collection: 'deny', only: ['google-vertex/global'], zdr: true });
  });

  it('makes a block that cannot be changed once made, and refuses to make one that names no company', () => {
    const block = pinnedProvider(['deepinfra']);

    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.only)).toBe(true);
    expect(Object.isFrozen(NO_RETENTION)).toBe(true);
    expect(() => pinnedProvider([])).toThrow(/must name the providers/);
  });

  it('will not take a hand-written block where a pinned one is due', () => {
    const { fetch } = recordingFetch();
    const api = new OpenRouterPictures(KEY, [], fetch);
    const handWritten = { allow_fallbacks: false, data_collection: 'deny', only: ['deepinfra'], zdr: true } as const;

    // @ts-expect-error — only `pinnedProvider` makes a `PinnedProvider`.
    const unpinned: PinnedProvider = handWritten;

    expect(unpinned).toBe(handWritten);
    expect(api).toBeInstanceOf(OpenRouterPictures);
  });

  /*
   * The type keeps a caller from posting without the block; this keeps a new
   * file from going round the transport to post on its own.
   */
  it('is the only picture code that calls fetch', () => {
    const callers = readdirSync(HERE)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .filter(name => /\bfetch\s*\(/.test(readFileSync(join(HERE, name), 'utf8')));

    expect(callers).toEqual(['pictureTransport.ts']);
  });
});

describe('with AI_PROVIDER=stub, or no pictures key', () => {
  it.each([
    ['the stub provider', { ...base, AI_PROVIDER: 'stub' }],
    ['no key', { ...base, OPENROUTER_IMAGE_API_KEY: '' }]
  ])('with %s, draws and judges nothing, and calls no one', async (_case, env) => {
    const settings = resolvePictureSettings(validateEnv(env));
    const { fetch, sent } = recordingFetch();
    const image = new OpenRouterImageClient(settings, [], fetch, []);
    const judge = new OpenRouterVisionJudgeClient(settings, [], fetch);

    expect(settings).toBeNull();
    expect(image.isAvailable).toBe(false);
    expect(judge.isAvailable).toBe(false);
    await expect(image.draw('prompt')).rejects.toThrow('No image model configured');
    await expect(judge.see({ bytes: new Uint8Array([1]), contentType: 'image/jpeg' })).rejects.toThrow('No judge model configured');
    await expect(judge.match([], [])).rejects.toThrow('No judge model configured');
    expect(sent).toEqual([]);
  });
});

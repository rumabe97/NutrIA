import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { generateObject, jsonSchema } from 'ai';

import {
  ASSISTANT_CALL_SETTINGS,
  assistantCostUsd,
  NO_TRAINING_PROVIDER,
  nonStrictSchema,
  openRouterRequest,
  resolveAssistantModel,
  resolveCallSettings,
  resolveModel,
  resolveOutputCap,
  resolvePictureSettings
} from './ai.config.js';
import { validateEnv } from '../../config/Env.validation.js';

import type { Env } from '../../config/index.js';
import type { LanguageModel } from 'ai';

/**
 * The OmniRoute provider sends `wirePoolSchema` as a `json_schema` response
 * format with `strict: false`. Strict mode made a model behind the gateway
 * reject every generation request with a 400, because the wire schema cannot
 * carry `additionalProperties: false` (Gemini rejects that keyword).
 */
describe('nonStrictSchema', () => {
  it('turns a strict json_schema response format non-strict, and keeps the schema itself', () => {
    const schema = { properties: { dishes: { type: 'array' } }, required: ['dishes'], type: 'object' };
    const body = { model: 'NutrIA-Fallback', response_format: { json_schema: { name: 'response', schema, strict: true }, type: 'json_schema' } };

    expect(nonStrictSchema(body)).toEqual({
      model: 'NutrIA-Fallback',
      response_format: { json_schema: { name: 'response', schema, strict: false }, type: 'json_schema' }
    });
  });

  it('leaves every other body exactly as it came', () => {
    const jsonObject = { model: 'm', response_format: { type: 'json_object' } };
    const plain = { model: 'm' };

    expect(nonStrictSchema(jsonObject)).toBe(jsonObject);
    expect(nonStrictSchema(plain)).toBe(plain);
  });
});

/**
 * A gateway moves a failed call to its next model itself. The SDK repeating the
 * call on top of that repeated the gateway's whole wait: one slot held for nine
 * minutes over three tries before the pool builder heard of the failure.
 */
describe('resolveCallSettings', () => {
  it('leaves retrying to the gateway, and files each call under a session there', () => {
    expect(resolveCallSettings({ AI_PROVIDER: 'omniroute' } as Env)).toEqual({ maxRetries: 0, sessionHeader: 'x-omniroute-session' });
  });

  it('leaves retrying to OpenRouter’s own fallback list, and sends it none of our ids (0064)', () => {
    expect(resolveCallSettings({ AI_PROVIDER: 'openrouter' } as Env)).toEqual({ maxRetries: 0, sessionHeader: null });
  });

  it('keeps the SDK’s default for a provider nothing else retries for, and sends it none of our ids', () => {
    for (const provider of ['google', 'anthropic', 'ollama'] as const) {
      expect(resolveCallSettings({ AI_PROVIDER: provider } as Env)).toEqual({ maxRetries: 2, sessionHeader: null });
    }
  });
});

/**
 * The no-training rule's third layer (`0064` § 3): every request to OpenRouter
 * goes only to endpoints that retain nothing and collect nothing, whatever a
 * caller asked for, and says which models may answer and how hard they think.
 */
describe('openRouterRequest', () => {
  const ONLY = ['deepinfra', 'coreweave'];
  const body = {
    messages: [{ content: 'Diseña platos', role: 'user' }],
    model: 'deepseek/deepseek-v4.1-flash',
    response_format: { json_schema: { name: 'response', schema: { type: 'object' }, strict: true }, type: 'json_schema' }
  };

  it('sends a request only to endpoints that neither retain nor collect it, asks for its cost, and keeps the schema non-strict', () => {
    const sent = openRouterRequest({ fallbackModels: [], providerOnly: ONLY })(body);

    expect(sent['provider']).toEqual({ data_collection: 'deny', only: ONLY, require_parameters: true, zdr: true });
    expect(sent['usage']).toEqual({ include: true });
    expect(sent['response_format']).toEqual({ json_schema: { name: 'response', schema: { type: 'object' }, strict: false }, type: 'json_schema' });
    expect(sent['messages']).toBe(body.messages);
  });

  it('writes the provider block over any a caller set, never merging with it — a looser only included', () => {
    const asked = { ...body, provider: { data_collection: 'allow', only: ['somewhere', 'deepinfra'], order: ['somewhere'], zdr: false } };

    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY })(asked)['provider']).toEqual({ ...NO_TRAINING_PROVIDER, only: ONLY });
  });

  it('sends only to the configured companies even when a caller sets no provider at all or tries to drop only', () => {
    const noProvider = openRouterRequest({ fallbackModels: [], providerOnly: ['deepinfra'] })(body);
    const dropped = openRouterRequest({ fallbackModels: [], providerOnly: ['deepinfra'] })({ ...body, provider: { only: undefined } });

    expect((noProvider['provider'] as { only: unknown }).only).toEqual(['deepinfra']);
    expect((dropped['provider'] as { only: unknown }).only).toEqual(['deepinfra']);
  });

  it('lists the asked model first and the fallbacks after it, each once', () => {
    const send = openRouterRequest({ fallbackModels: ['minimax/minimax-m3', 'deepseek/deepseek-v4.1-flash'], providerOnly: ONLY });

    expect(send(body)['models']).toEqual(['deepseek/deepseek-v4.1-flash', 'minimax/minimax-m3']);
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY })(body)['models']).toEqual(['deepseek/deepseek-v4.1-flash']);
  });

  it('spells the reasoning effort as OpenRouter does, switches it off for none, and leaves the model’s default when unset', () => {
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY, reasoningEffort: 'low' })(body)['reasoning']).toEqual({ effort: 'low' });
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY, reasoningEffort: 'none' })(body)['reasoning']).toEqual({ enabled: false });
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY })(body)).not.toHaveProperty('reasoning');
  });

  it('caps the thinking in tokens when asked, over any effort, but none still switches it off', () => {
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY, reasoningMaxTokens: 2048 })(body)['reasoning']).toEqual({ max_tokens: 2048 });
    expect(
      openRouterRequest({ fallbackModels: [], providerOnly: ONLY, reasoningEffort: 'high', reasoningMaxTokens: 2048 })(body)['reasoning']
    ).toEqual({ max_tokens: 2048 });
    expect(
      openRouterRequest({ fallbackModels: [], providerOnly: ONLY, reasoningEffort: 'none', reasoningMaxTokens: 2048 })(body)['reasoning']
    ).toEqual({ enabled: false });
  });

  it('adds the endpoint order when set, and keeps every no-training field beside it', () => {
    const asked = { ...body, provider: { data_collection: 'allow', require_parameters: false, zdr: false } };

    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY, providerSort: 'throughput' })(asked)['provider']).toEqual({
      data_collection: 'deny',
      only: ONLY,
      require_parameters: true,
      sort: 'throughput',
      zdr: true
    });
    expect(openRouterRequest({ fallbackModels: [], providerOnly: ONLY })(body)['provider']).not.toHaveProperty('sort');
  });

  it('adds the providers to ignore when set, beside the order, and never lets them loosen the no-training fields', () => {
    const asked = { ...body, provider: { data_collection: 'allow', ignore: ['nobody'], require_parameters: false, zdr: false } };

    expect(
      openRouterRequest({ fallbackModels: [], providerIgnore: ['sail-research'], providerOnly: ONLY, providerSort: 'latency' })(asked)['provider']
    ).toEqual({ data_collection: 'deny', ignore: ['sail-research'], only: ONLY, require_parameters: true, sort: 'latency', zdr: true });
    expect(openRouterRequest({ fallbackModels: [], providerIgnore: [], providerOnly: ONLY })(body)['provider']).not.toHaveProperty('ignore');
  });
});

describe('resolveOutputCap', () => {
  const openrouter = { AI_PROVIDER: 'openrouter', AI_REASONING_EFFORT: 'none' } as Env;

  it('caps OpenRouter at 1200 tokens a dish and an 800-token margin when nothing else is set', () => {
    expect(resolveOutputCap(openrouter)).toEqual({ margin: 800, perDish: 1200 });
    expect(resolveOutputCap({ ...openrouter, AI_MAX_OUTPUT_TOKENS_PER_DISH: 900 })).toEqual({ margin: 800, perDish: 900 });
  });

  it('adds a thinking cap to the margin, and caps nothing while the thinking has none', () => {
    expect(resolveOutputCap({ ...openrouter, AI_REASONING_EFFORT: 'low', AI_REASONING_MAX_TOKENS: 2048 })).toEqual({ margin: 2848, perDish: 1200 });
    expect(resolveOutputCap({ ...openrouter, AI_REASONING_MAX_TOKENS: 2048 })).toEqual({ margin: 800, perDish: 1200 });
    expect(resolveOutputCap({ ...openrouter, AI_REASONING_EFFORT: 'low' })).toBeNull();
    expect(resolveOutputCap({ ...openrouter, AI_REASONING_EFFORT: undefined })).toBeNull();
  });

  it('caps no other provider', () => {
    for (const provider of ['anthropic', 'google', 'ollama', 'omniroute', 'stub'] as const) {
      expect(resolveOutputCap({ ...openrouter, AI_PROVIDER: provider })).toBeNull();
    }
  });
});

/** The same, on the wire: what the SDK actually posts, with a call that tries to loosen it. */
describe('the openrouter provider', () => {
  const base = {
    AI_PROVIDER: 'openrouter',
    AI_PROVIDER_ONLY: 'deepinfra,coreweave',
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    OPENROUTER_API_KEY: 'test-openrouter-key'
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the provider block, the fallback list and the reasoning to OpenRouter, whatever the call’s own options say', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'gen-1',
            choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
            created: 1_790_000_000,
            model: 'deepseek/deepseek-v4.1-flash',
            provider: 'DeepInfra',
            usage: { completion_tokens: 10, cost: 0.0123, prompt_tokens: 20, total_tokens: 30 }
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 }
        )
      );
    const env = validateEnv({ ...base, AI_FALLBACK_MODELS: 'deepseek/deepseek-v4.1-flash', AI_REASONING_EFFORT: 'low' });

    await generateObject({
      model: resolveModel(env) as LanguageModel,
      prompt: 'Diseña platos',
      // What a caller — or a later change — might try: an endpoint that keeps data, and models of its own.
      providerOptions: {
        openrouter: { models: ['somebody/free-model:free'], provider: { data_collection: 'allow', only: ['somewhere-else'], zdr: false } }
      },
      schema: jsonSchema<{ dishes: unknown[] }>({ properties: { dishes: { type: 'array' } }, type: 'object' })
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(sent).toMatchObject({
      model: 'google/gemma-4-31b-it',
      models: ['google/gemma-4-31b-it', 'deepseek/deepseek-v4.1-flash'],
      provider: { data_collection: 'deny', only: ['deepinfra', 'coreweave'], require_parameters: true, zdr: true },
      reasoning: { effort: 'low' },
      response_format: { json_schema: { strict: false }, type: 'json_schema' },
      usage: { include: true }
    });
  });

  it('posts the output cap as max_tokens and the providers to ignore inside the provider block', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'gen-2',
            choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
            created: 1_790_000_000,
            model: 'deepseek/deepseek-v4.1-flash',
            usage: { completion_tokens: 10, prompt_tokens: 20, total_tokens: 30 }
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 }
        )
      );
    const env = validateEnv({ ...base, AI_PROVIDER_IGNORE: 'sail-research', AI_REASONING_EFFORT: 'none' });

    await generateObject({
      maxOutputTokens: 4400,
      model: resolveModel(env) as LanguageModel,
      prompt: 'Diseña platos',
      schema: jsonSchema<{ dishes: unknown[] }>({ properties: { dishes: { type: 'array' } }, type: 'object' })
    });

    const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;

    expect(sent).toMatchObject({
      max_tokens: 4400,
      provider: { data_collection: 'deny', ignore: ['sail-research'], only: ['deepinfra', 'coreweave'], require_parameters: true, zdr: true },
      reasoning: { enabled: false }
    });
  });

  /*
   * Boot refuses a leftover gateway URL; an `Env` that skipped boot — built by
   * hand, as a spec or a script would — is refused where the key is handed over.
   */
  it('never hands the key to a host that is not OpenRouter, even with an Env that skipped validation', () => {
    const env = validateEnv(base);

    expect(() => resolveModel({ ...env, AI_BASE_URL: 'http://localhost:20128/v1' })).toThrow(/AI_BASE_URL/);
    expect(() => resolveModel({ ...env, AI_BASE_URL: 'https://openrouter.ai/api/v1' })).not.toThrow();
  });

  /* Production, 2026-09-26: `AI_BASE_URL=https://openrouter.ai` sent every call to the website, which answered HTML. */
  it('posts to OpenRouter’s API path whatever path AI_BASE_URL names on its origin', async () => {
    // A fresh Response per call: a body can be read once.
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'gen-1',
              choices: [{ finish_reason: 'stop', index: 0, message: { content: '{"dishes":[]}', role: 'assistant' } }],
              created: 1_790_000_000,
              model: 'google/gemma-4-31b-it',
              usage: { completion_tokens: 10, prompt_tokens: 20, total_tokens: 30 }
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 }
          )
        )
      );

    for (const configured of ['https://openrouter.ai', 'https://openrouter.ai/', 'https://openrouter.ai/somewhere']) {
      await generateObject({
        model: resolveModel(validateEnv({ ...base, AI_BASE_URL: configured })) as LanguageModel,
        prompt: 'Diseña platos',
        schema: jsonSchema<{ dishes: unknown[] }>({ properties: { dishes: { type: 'array' } }, type: 'object' })
      });
    }

    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual(Array(3).fill('https://openrouter.ai/api/v1/chat/completions'));
  });

  it('refuses to build the model without the companies it may route to, even with an Env that skipped validation', () => {
    const env = validateEnv(base);

    expect(() => resolveModel({ ...env, AI_PROVIDER_ONLY: undefined })).toThrow(/AI_PROVIDER_ONLY/);
    expect(() => resolveModel({ ...env, AI_PROVIDER_ONLY: [] })).toThrow(/AI_PROVIDER_ONLY/);
  });
});

/*
 * `0066`. `AI_PROVIDER=stub` means no model call of any kind: a pictures key
 * left in a local file draws nothing while the stub is selected.
 */
describe('resolvePictureSettings', () => {
  const base = {
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    OPENROUTER_IMAGE_API_KEY: ' sk-or-v1-pictures-only '
  };

  it('gives the pictures their own key, models, companies and cap', () => {
    const env = validateEnv({ ...base, AI_IMAGE_MONTHLY_CAP_USD: '4', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' });

    expect(resolvePictureSettings(env)).toEqual({
      apiKey: 'sk-or-v1-pictures-only',
      imageModel: 'google/gemini-3.1-flash-lite-image',
      imageProviders: ['google-vertex/global'],
      judgeModel: 'qwen/qwen3-vl-235b-a22b-instruct',
      judgeProviders: ['deepinfra'],
      monthlyCapUsd: 4
    });
  });

  it('draws nothing with the stub provider, even with a key', () => {
    expect(resolvePictureSettings(validateEnv({ ...base, AI_PROVIDER: 'stub' }))).toBeNull();
  });

  it('draws nothing without a key', () => {
    expect(
      resolvePictureSettings(validateEnv({ ...base, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', OPENROUTER_IMAGE_API_KEY: '' }))
    ).toBeNull();
  });
});

/**
 * The assistant calls Anthropic beside whatever provider generation runs on,
 * not instead of it (`0104` clause 6). Every one of these rows is a way that
 * could have been got wrong by reusing `resolveModel`, which switches on
 * `AI_PROVIDER` and would have forced the choice between moving every plan
 * generation to Anthropic and having no assistant at all.
 */
describe('the assistant\u2019s own provider', () => {
  const base = {
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db'
  };

  it('is there while generation runs on OpenRouter, which is how production runs', () => {
    const env = validateEnv({
      ...base,
      AI_PROVIDER: 'openrouter',
      AI_PROVIDER_ONLY: 'deepinfra',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      OPENROUTER_API_KEY: 'test-openrouter-key'
    });
    const model = resolveAssistantModel(env) as Exclude<LanguageModel, string>;

    expect(model.modelId).toBe('claude-haiku-5-5');
    expect(model.provider).toContain('anthropic');
    // And generation is untouched: the two live side by side.
    expect((resolveModel(env) as Exclude<LanguageModel, string>).provider).toContain('openrouter');
  });

  it('is absent, rather than an error, when nobody has given it a key', () => {
    expect(resolveAssistantModel(validateEnv({ ...base }))).toBeNull();
    expect(resolveAssistantModel(validateEnv({ ...base, ANTHROPIC_API_KEY: '   ' }))).toBeNull();
  });

  it('takes the model it is told to, and only an Anthropic one', () => {
    const env = validateEnv({ ...base, AI_ASSISTANT_MODEL: 'claude-opus-5-5', ANTHROPIC_API_KEY: 'sk-ant-test' });

    expect((resolveAssistantModel(env) as Exclude<LanguageModel, string>).modelId).toBe('claude-opus-5-5');
    expect(() => validateEnv({ ...base, AI_ASSISTANT_MODEL: 'gemini-3.6-flash', ANTHROPIC_API_KEY: 'sk-ant-test' })).toThrow(/AI_ASSISTANT_MODEL/);
  });

  /**
   * `AI_REWRITE_MODEL` is checked against the configured provider, which is the
   * right question for the sweep and the wrong one here: under `google` that
   * rule rejects every Claude id, and under `openrouter` it checks nothing.
   */
  it('is checked against Anthropic whatever AI_PROVIDER says', () => {
    const google = { ...base, AI_PROVIDER: 'google', ANTHROPIC_API_KEY: 'sk-ant-test', GOOGLE_API_KEY: 'g' };

    expect(() => validateEnv({ ...google, AI_ASSISTANT_MODEL: 'claude-haiku-5-5' })).not.toThrow();
    expect(() => validateEnv({ ...google, AI_ASSISTANT_MODEL: 'gemini-3.6-flash' })).toThrow(/AI_ASSISTANT_MODEL/);
  });

  it('lets the SDK retry, which OpenRouter\u2019s settings would not', () => {
    expect(ASSISTANT_CALL_SETTINGS).toEqual({ maxRetries: 2, sessionHeader: null });
    expect(resolveCallSettings({ AI_PROVIDER: 'openrouter' } as Env).maxRetries).toBe(0);
  });
});

/**
 * Anthropic returns no cost with an answer, so a call this service does not
 * price is a call the month\u2019s ceiling never sees.
 */
describe('assistantCostUsd', () => {
  it('prices a call from the model\u2019s published prices', () => {
    expect(assistantCostUsd('claude-haiku-5-5', { inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.1);
    expect(assistantCostUsd('claude-haiku-5-5', { inputTokens: 0, outputTokens: 1_000_000 })).toBe(0.5);
    expect(assistantCostUsd('claude-sonnet-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(12);
    expect(assistantCostUsd('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(24);
  });

  it('prices a dated snapshot as the model it is a snapshot of', () => {
    expect(assistantCostUsd('claude-haiku-5-5-20260401', { inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.1);
    expect(assistantCostUsd('CLAUDE-HAIKU-5-5', { inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.1);
  });

  /**
   * A model nobody priced records no cost rather than a wrong one: the console
   * counts uncosted calls apart and says its sum is a floor
   * (`AdminAiRepository`), which is a true statement where a guess would be a
   * false one.
   */
  it('says nothing rather than something wrong about a model it does not know', () => {
    expect(assistantCostUsd('claude-fable-9', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeNull();
    expect(assistantCostUsd('claude-haiku-5', { inputTokens: 1_000_000, outputTokens: 0 })).toBeNull();
  });
});

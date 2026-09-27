import { describe, expect, it } from '@jest/globals';

import { OpenRouterVisionJudgeClient } from './OpenRouterVisionJudgeClient.js';
import { PictureCallError } from './pictureTransport.js';

import type { PictureSettings } from '../ai.config.js';

const SETTINGS: PictureSettings = {
  apiKey: ['sk-or-v1-', 'judge', 'client', 'spec', '0123456789'].join(''),
  imageModel: 'google/gemini-3.1-flash-lite-image',
  imageProviders: ['google-vertex/global'],
  judgeModel: 'qwen/qwen3-vl-235b-a22b-instruct',
  judgeProviders: ['deepinfra'],
  monthlyCapUsd: 10
};

/** A judge that answers every call with `content`, and keeps the bodies it was sent. */
function judge(content: string, extra: Record<string, unknown> = { provider: 'DeepInfra', usage: { cost: 0.0004 } }) {
  const bodies: Record<string, unknown>[] = [];
  const fake = (async (_input: Request | string | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);

    return new Response(JSON.stringify({ choices: [{ message: { content } }], ...extra }));
  }) as unknown as typeof fetch;

  return { bodies, client: new OpenRouterVisionJudgeClient(SETTINGS, [], fake) };
}

const PICTURE = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x10]), contentType: 'image/jpeg' };

type Message = {
  readonly content: readonly { readonly image_url?: { readonly url: string }; readonly text?: string; readonly type: string }[] | string;
};

describe('OpenRouterVisionJudgeClient.see', () => {
  it('shows the model the file itself, and reads what it saw into the shape the rule takes', async () => {
    const answer = {
      extra_dishes: 0,
      foods: [
        { amount: 'main', name: 'tofu', specific: true },
        { amount: 'garnish', name: 'white drizzle', specific: false }
      ],
      non_food: [],
      notes: 'Looks real.',
      plastic_or_cgi: false,
      realism: 5,
      sharpness: 4
    };
    const { bodies, client } = judge(`\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);
    const call = await client.see(PICTURE);

    expect(call).toEqual({
      costUsd: 0.0004,
      model: 'qwen/qwen3-vl-235b-a22b-instruct',
      provider: 'DeepInfra',
      result: {
        extraDishes: 0,
        foods: [
          { amount: 'main', name: 'tofu', specific: true },
          { amount: 'garnish', name: 'white drizzle', specific: false }
        ],
        nonFood: [],
        plasticOrCgi: false,
        realism: 5,
        sharpness: 4
      }
    });

    const [message] = bodies[0]?.['messages'] as Message[];
    const parts = message?.content as Exclude<Message['content'], string>;

    expect(parts[1]?.image_url?.url).toBe(`data:image/jpeg;base64,${Buffer.from(PICTURE.bytes).toString('base64')}`);
    expect(bodies[0]).toMatchObject({ temperature: 0, usage: { include: true } });
  });

  it('never asks the model which allergens a food carries: the catalogue answers that', async () => {
    const { bodies, client } = judge('{"foods": []}');

    await client.see(PICTURE);

    expect(JSON.stringify(bodies[0])).not.toMatch(/allergen/i);
  });

  it('leans toward checking more where the answer strays: a food with no "specific" is specific, an unknown amount is a main one', async () => {
    const { client } = judge('{"foods": [{"name": "prawns", "amount": "a few"}], "realism": "high"}');

    expect((await client.see(PICTURE)).result).toEqual({
      extraDishes: 0,
      foods: [{ amount: 'main', name: 'prawns', specific: true }],
      nonFood: [],
      plasticOrCgi: false
    });
  });

  it.each([
    ['prose', 'I see a lovely plate of food.'],
    ['JSON of another shape', '{"items": ["rice"]}'],
    ['a food with no name', '{"foods": [{"name": "", "specific": true, "amount": "main"}]}'],
    ['nothing', '']
  ])('fails an answer that is %s, so the picture is not kept', async (_case, content) => {
    await expect(judge(content).client.see(PICTURE)).rejects.toBeInstanceOf(PictureCallError);
  });

  it('fails an answer with no message at all', async () => {
    const fake = (async () => new Response(JSON.stringify({ choices: [] }))) as unknown as typeof fetch;

    await expect(new OpenRouterVisionJudgeClient(SETTINGS, [], fake).see(PICTURE)).rejects.toThrow('JSON of the wrong shape');
  });
});

describe('OpenRouterVisionJudgeClient.match', () => {
  it('sends the seen names and the recipe’s ingredients, and reads the match', async () => {
    const answer = { extras: ['shrimp'], ingredients: [{ matched: ['rice'], slug: 'arroz', status: 'seen' }] };
    const { bodies, client } = judge(JSON.stringify(answer), { usage: { cost: 0.0002 } });
    const call = await client.match(
      [
        { amount: 'main', name: 'rice', specific: true },
        { amount: 'side', name: 'shrimp', specific: true }
      ],
      [{ name: 'Cooked white rice', slug: 'arroz' }]
    );

    expect(call).toEqual({ costUsd: 0.0002, model: 'qwen/qwen3-vl-235b-a22b-instruct', provider: null, result: answer });

    const [message] = bodies[0]?.['messages'] as Message[];

    expect(message?.content).toContain('Recipe ingredients: [{"name":"Cooked white rice","slug":"arroz"}]');
    expect(message?.content).toContain('Foods seen: ["rice","shrimp"]');
    expect(message?.content).toContain('is a match, not an extra');
  });

  it('reads an ingredient with no status as unsure, and no matches as none', async () => {
    const { client } = judge('{"extras": [], "ingredients": [{"slug": "arroz", "status": "maybe"}]}');

    expect((await client.match([], [{ name: 'Rice', slug: 'arroz' }])).result).toEqual({
      extras: [],
      ingredients: [{ matched: [], slug: 'arroz', status: 'unsure' }]
    });
  });

  it('fails a match with no list of extras', async () => {
    await expect(judge('{"ingredients": []}').client.match([], [])).rejects.toBeInstanceOf(PictureCallError);
  });
});

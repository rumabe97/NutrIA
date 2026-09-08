import { afterEach, describe, expect, it, jest } from '@jest/globals';
import sharp from 'sharp';

import { RecipeController } from 'core/controllers/Recipe';

import { ImageClient } from './clients/ImageClient.js';
import { illustrationPrompt, RecipeIllustrator } from './RecipeIllustrator.service.js';

import type { ImageRequest, ImageResponse } from './clients/ImageClient.js';

/** A real 8×6 PNG, made by sharp itself so it is exactly what a provider would return. */
const PNG = await sharp({ create: { background: '#6d8a46', channels: 3, height: 6, width: 8 } })
  .png()
  .toBuffer();

class ScriptedImageClient extends ImageClient {
  public prompts: string[] = [];

  constructor(
    private readonly available: boolean,
    private readonly fail: (prompt: string) => boolean = () => false
  ) {
    super();
  }

  get isAvailable(): boolean {
    return this.available;
  }

  generate({ prompt }: ImageRequest): Promise<ImageResponse> {
    this.prompts.push(prompt);

    if (this.fail(prompt)) {return Promise.reject(new Error('quota exceeded for metric x'));}

    return Promise.resolve({ bytes: new Uint8Array(PNG), mediaType: 'image/png', model: 'scripted-image' });
  }
}

const pending = [
  { id: '11111111-1111-4111-8111-111111111111', ingredientNames: ['calamar', 'ajo', 'perejil', 'arroz integral'], locale: 'es-ES', name: 'Calamares a la plancha con ajo y perejil' },
  { id: '22222222-2222-4222-8222-222222222222', ingredientNames: ['yogur griego', 'nueces'], locale: 'es-ES', name: 'Yogur griego con nueces' }
];

describe('RecipeIllustrator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing at all when illustrations are off', async () => {
    const pendingSpy = jest.spyOn(RecipeController, 'pendingIllustrations');
    const run = await new RecipeIllustrator(new ScriptedImageClient(false)).illustrateMissing(6);

    expect(run).toEqual({ drawn: 0, failed: 0, pending: 0 });
    expect(pendingSpy).not.toHaveBeenCalled();
  });

  it('draws each pending recipe, resizes it to WebP, and stores it with its provenance', async () => {
    jest.spyOn(RecipeController, 'pendingIllustrations').mockResolvedValue(pending);
    const store = jest.spyOn(RecipeController, 'storeIllustration').mockResolvedValue(undefined);
    const client = new ScriptedImageClient(true);

    const run = await new RecipeIllustrator(client).illustrateMissing(6);

    expect(run).toEqual({ drawn: 2, failed: 0, pending: 2 });
    expect(store).toHaveBeenCalledTimes(2);

    const [recipeId, image] = store.mock.calls[0] as [string, { bytes: Buffer; contentType: string; height: number; model: string; promptVersion: string; width: number }];

    expect(recipeId).toBe(pending[0]?.id);
    expect(image.contentType).toBe('image/webp');
    expect(image.model).toBe('scripted-image');
    expect(image.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(image.width).toBeGreaterThan(0);
    // WebP magic: RIFF....WEBP
    expect(image.bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(image.bytes.subarray(8, 12).toString()).toBe('WEBP');
  });

  it('counts a failure and carries on, rather than failing the sweep', async () => {
    jest.spyOn(RecipeController, 'pendingIllustrations').mockResolvedValue(pending);
    const store = jest.spyOn(RecipeController, 'storeIllustration').mockResolvedValue(undefined);
    const client = new ScriptedImageClient(true, prompt => prompt.includes('Calamares'));

    const run = await new RecipeIllustrator(client).illustrateMissing(6);

    expect(run).toEqual({ drawn: 1, failed: 1, pending: 2 });
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('asks for exactly the bound it was given', async () => {
    const pendingSpy = jest.spyOn(RecipeController, 'pendingIllustrations').mockResolvedValue([]);

    await new RecipeIllustrator(new ScriptedImageClient(true)).illustrateMissing(3);

    expect(pendingSpy).toHaveBeenCalledWith(3);
  });
});

describe('illustrationPrompt', () => {
  const prompt = illustrationPrompt(pending[0] as (typeof pending)[number]);

  it('is built from the dish alone — its name and its ingredients', () => {
    expect(prompt).toContain('Calamares a la plancha con ajo y perejil');
    expect(prompt).toContain('calamar, ajo, perejil, arroz integral');
  });

  it('asks for an illustration of a plate, with nothing written on it and nobody in it', () => {
    expect(prompt).toContain('No text');
    expect(prompt).toContain('no people');
    expect(prompt).toContain('home cooking');
  });

  it('caps the ingredient list so a twenty-item dish does not become a shopping list', () => {
    const many = illustrationPrompt({ ...pending[0], ingredientNames: Array.from({ length: 20 }, (_, index) => `ing-${index}`) } as (typeof pending)[number]);

    expect(many).toContain('ing-7');
    expect(many).not.toContain('ing-8');
  });
});

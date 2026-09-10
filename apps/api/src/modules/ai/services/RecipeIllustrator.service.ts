import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

import { RecipeController } from 'core/controllers/Recipe';

import { ImageClient } from '../clients/ImageClient.js';
import { isQuotaExhausted } from '../clients/quota.js';

/** Bumped when the wording changes; stored with each image so a better prompt can tell its own rows apart. */
export const ILLUSTRATION_PROMPT_VERSION = '1.0.0';

/** Phone-sized. A plan page shows a dozen at once; a megabyte each is not a plan page. */
const WIDTH = 960;
const QUALITY = 78;

type Pending = { readonly id: string; readonly ingredientNames: readonly string[]; readonly locale: string; readonly name: string };

export type IllustrationRun = { readonly drawn: number; readonly failed: number; readonly pending: number };

/**
 * Draws the illustration for recipes that lack one.
 *
 * Built from the recipe alone — its name and its ingredients — so there is
 * nothing about any person to leak, and the health-data boundary test that
 * scans this directory covers it without being told. The prompt asks for a
 * home-cooked plate and forbids text, people and hands: it is an illustration
 * of the dish, and is labelled as one wherever it is shown (0010).
 *
 * Bounded per run and best-effort: a failure is logged and skipped, never thrown
 * to whoever asked. The plan the picture belongs to was complete before this ran.
 */
@Injectable()
export class RecipeIllustrator {
  private readonly logger = new Logger(RecipeIllustrator.name);

  constructor(private readonly images: ImageClient) {}

  get isAvailable(): boolean {
    return this.images.isAvailable;
  }

  async illustrateMissing(limit: number): Promise<IllustrationRun> {
    if (!this.isAvailable) {return { drawn: 0, failed: 0, pending: 0 };}

    const pending = await RecipeController.pendingIllustrations(limit);
    let drawn = 0;
    let failed = 0;

    for (const recipe of pending) {
      try {
        await this.illustrate(recipe);
        drawn += 1;
      } catch (error: unknown) {
        failed += 1;
        this.logger.warn(`Could not illustrate recipe ${recipe.id}: ${error instanceof Error ? error.message : 'unknown'}`);

        // See `isQuotaExhausted`: the rest of this batch cannot succeed either.
        if (isQuotaExhausted(error)) {
          this.logger.warn('Provider quota is exhausted; stopping this sweep. The rest will be picked up next time.');
          break;
        }
      }
    }

    return { drawn, failed, pending: pending.length };
  }

  private async illustrate(recipe: Pending): Promise<void> {
    const generated = await this.images.generate({ aspectRatio: '4:3', prompt: illustrationPrompt(recipe) });
    const image = sharp(Buffer.from(generated.bytes)).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY });
    const { data, info } = await image.toBuffer({ resolveWithObject: true });

    await RecipeController.storeIllustration(recipe.id, {
      bytes: data,
      contentType: 'image/webp',
      height: info.height,
      model: generated.model,
      promptVersion: ILLUSTRATION_PROMPT_VERSION,
      width: info.width
    });
  }
}

/**
 * English, whatever the recipe's language: image models follow it best, and the
 * dish name is passed through as written because it *is* the subject.
 */
export function illustrationPrompt(recipe: Pending): string {
  const ingredients = recipe.ingredientNames.slice(0, 8).join(', ');

  return [
    `Overhead photograph of one plate of home cooking: "${recipe.name}".`,
    ingredients ? `Visible ingredients: ${ingredients}.` : '',
    'A single plate on a plain wooden or linen table, natural daylight from one side, shallow depth of field.',
    'Realistic and appetising, cooked at home rather than plated by a restaurant.',
    'No text, no labels, no logos, no people, no hands, no cutlery beyond one fork.'
  ]
    .filter(Boolean)
    .join(' ');
}

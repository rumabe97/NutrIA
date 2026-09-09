import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { dirname, join } from 'node:path';

import { buildPoolPrompt } from './PoolPrompt.js';

import type { MealSlot } from 'core/entities/Plan';
import type { PromptContext } from './PoolPrompt.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The boundary from `docs/decisions/0004-deterministic-safety-layer.md`, made
 * mechanical.
 *
 * Health data is collected, stored and shown back. It is never reasoned about,
 * and the strongest form of "never" available here is that the code which talks
 * to a model has no way to reach it. These tests fail the moment someone adds
 * the import that would make it reachable — which is the moment worth catching,
 * not the moment a medication finally shows up in a prompt.
 */
describe('the health-data boundary around the AI module', () => {
  const sources = readdirSync(HERE, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map(entry => join(entry.parentPath, entry.name));

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(4);
  });

  it.each(['core/controllers/Health', 'core/entities/Health', '#repositories/Health'])('imports nothing from %s', specifier => {
    const offenders = sources.filter(path => readFileSync(path, 'utf8').includes(specifier));

    expect(offenders).toEqual([]);
  });

  it('builds a prompt from a context that has nowhere to put a condition or a medication', () => {
    const context: PromptContext = {
      avoidNames: [],
      breakfastStyle: null,
      budget: 'medium',
      cookingFrequency: null,
      cookingTimeMinutes: 30,
      cuisines: ['Mediterránea'],
      dietaryPatterns: ['omnivore'],
      dislikedLabels: ['brócoli'],
      dislikedNames: ['Lentejas con chorizo'],
      excludeSlugs: [],
      forbiddenLabels: [],
      language: 'Spanish (Spain)',
      likedLabels: ['salmón'],
      lovedNames: ['Salmón al horno con eneldo'],
      needBySlot: new Map<MealSlot, number>([['breakfast', 2]]),
      portionPreference: null,
      scheduleNotes: null,
      targets: { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 150 }
    };

    // Every key the prompt can carry, listed. A future field called `conditions`
    // or `medications` fails here before it can ever be rendered.
    expect(Object.keys(context).filter(key => /condition|medication|health|supplement|diagnos/i.test(key))).toEqual([]);

    const prompt = buildPoolPrompt(context, []);

    for (const word of ['metformina', 'celiaquía', 'diabetes', 'embarazo', 'medicaci']) {
      expect(prompt.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { dirname, join } from 'node:path';

import { buildPoolPrompt } from './prompts/PoolPrompt.js';

import type { MealSlot } from 'core/entities/Plan';
import type { PromptContext } from './prompts/PoolPrompt.js';

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

  /*
   * The professional's side goes behind the same wall (PRD 004, criterion 11):
   * a link is how a professional reaches a client's conditions, and what a
   * professional reads or writes about a client is theirs and the client's,
   * never a prompt's (`0059`).
   */
  it.each([
    'core/controllers/Health',
    'core/entities/Health',
    '#repositories/Health',
    'core/controllers/Care',
    'core/entities/Care',
    '#repositories/Care',
    'core/controllers/Professional',
    'core/entities/Professional',
    '#repositories/Professional'
  ])('imports nothing from %s', specifier => {
    const offenders = sources.filter(path => readFileSync(path, 'utf8').includes(specifier));

    expect(offenders).toEqual([]);
  });

  // The API modules that hold the same data, by any relative path into them.
  it.each(['care', 'health-data'])('imports nothing from the %s module', module => {
    const into = new RegExp(`(?:from\\s+|import\\(\\s*)['"][./]*(?:modules/)?${module}/`);
    const offenders = sources.filter(path => into.test(readFileSync(path, 'utf8')));

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
      dayShape: null,
      dietaryPatterns: ['omnivore'],
      dislikedLabels: ['brócoli'],
      dislikedNames: ['Lentejas con chorizo'],
      excludeSlugs: [],
      forbiddenLabels: [],
      goal: null,
      language: 'Spanish (Spain)',
      likedLabels: ['salmón'],
      lovedNames: ['Salmón al horno con eneldo'],
      needBySlot: new Map<MealSlot, number>([['breakfast', 2]]),
      portionPreference: null,
      scheduleNotes: null,
      slotShares: new Map(),
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

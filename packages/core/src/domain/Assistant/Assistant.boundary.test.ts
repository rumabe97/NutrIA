import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { assistantContext } from 'core/domain/Assistant';

// `__dirname`, not `import.meta`: this package compiles to CommonJS, as `provenance.test.ts` already relies on.
const HERE = __dirname;

/**
 * The health wall, for the half of the assistant that lives here (PRD criterion
 * 5, `0104` clause 3).
 *
 * `apps/api/src/modules/ai/health-boundary.spec.ts` sweeps the AI module and
 * nothing else, and this folder is not in it — so the same wall is written
 * again here rather than assumed. It fails the moment a source in this folder
 * so much as imports what holds somebody's conditions, medications, care, links
 * or cupboard: the moment worth catching, not the moment one shows up in a
 * prompt.
 */
describe('the health-data boundary around the assistant’s domain', () => {
  const sources = readdirSync(HERE)
    .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map(name => join(HERE, name));

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each([
    'core/controllers',
    'core/entities/Admin',
    'core/entities/Care',
    'core/entities/Health',
    'core/entities/Pantry',
    'core/entities/Professional',
    'core/domain/Health',
    'core/domain/Pantry',
    '#repositories'
  ])('imports nothing from %s', specifier => {
    expect(sources.filter(path => readFileSync(path, 'utf8').includes(`'${specifier}`))).toEqual([]);
  });

  /**
   * The key list, held to an exact and reviewed set. A new key is not a bug —
   * it is a question somebody must answer before this test is changed: is it
   * something the plan generator already tells a model? If not, it is not this
   * project's to add.
   *
   * What a person **types** never enters this object: the question and the
   * replayed history travel beside it, as the only two person-written fields in
   * any assistant prompt — the same standing as `dishRequest` in `PromptContext`.
   */
  it('has nowhere to put a condition, a medication, a supplement or a cupboard', () => {
    const keys = Object.keys(
      assistantContext({
        cookingTimeMinutes: null,
        cuisines: [],
        days: [],
        dislikedNames: [],
        kitchen: null,
        language: 'Spanish',
        likedFoods: [],
        lovedNames: [],
        slotShares: new Map(),
        targets: { carbsG: 0, fatG: 0, fiberG: 0, kcal: 1, proteinG: 0 }
      })
    ).sort();

    expect(keys).toEqual([
      'cookingTimeMinutes',
      'cuisines',
      'days',
      'dislikedNames',
      'kitchen',
      'language',
      'likedFoods',
      'lovedNames',
      'slotShares',
      'targets'
    ]);
    expect(keys.filter(key => /condition|medication|supplement|pantry|cupboard|health|care/i.test(key))).toEqual([]);
    // Nor a person's allergies, by any name: the profile consent says the model never receives them (023 phase 5, F1).
    expect(keys.filter(key => /allerg|intoleran|exclu|forbid|avoid/i.test(key))).toEqual([]);
    // Nor the goal or the way of eating: health data consented to for the plan alone (legal F5, 2026-11-10).
    expect(keys.filter(key => /goal|pattern|diet|weight|height/i.test(key))).toEqual([]);
  });
});

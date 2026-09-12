import { describe, expect, it } from '@jest/globals';
import { DEFAULT_MEAL_SHAPE, weightsFor } from 'core/domain/MealShape';

import { buildPoolPrompt, STEPS_VERSION } from './PoolPrompt.js';

import type { Goal } from 'core/entities/Profile';
import type { CatalogueIngredient, IngredientCategory, MealSlot } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PromptContext } from './PoolPrompt.js';

const TARGETS: NutritionTargets = { carbsG: 250, fatG: 70, fiberG: 30, kcal: 2400, proteinG: 150 };

const LABEL: Partial<Record<MealSlot, string>> = {
  afternoon_snack: 'afternoon snack',
  breakfast: 'breakfast',
  dinner: 'dinner',
  lunch: 'lunch',
  morning_snack: 'mid-morning snack'
};

function context(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    avoidNames: [],
    breakfastStyle: null,
    budget: null,
    cookingFrequency: null,
    cookingTimeMinutes: 30,
    cuisines: [],
    dayShape: null,
    dietaryPatterns: [],
    dislikedLabels: [],
    dislikedNames: [],
    excludeSlugs: [],
    forbiddenLabels: [],
    goal: null,
    language: 'Spanish (Spain)',
    likedLabels: [],
    lovedNames: [],
    needBySlot: new Map<MealSlot, number>([['lunch', 6]]),
    portionPreference: null,
    scheduleNotes: null,
    slotShares: weightsFor(DEFAULT_MEAL_SHAPE),
    targets: TARGETS,
    ...overrides
  };
}

type Brief = { carbsG: number; fatG: number; fiberG: number; kcal: number; proteinG: number };

/** The per-serving numbers the prompt asks of one slot's dishes. */
function briefIn(prompt: string, slot: MealSlot): Brief {
  const match = new RegExp(
    `- ${LABEL[slot]}: \\d+ distinct dishes, each ~(\\d+) kcal · (\\d+) g protein · (\\d+) g carbohydrate · (\\d+) g fat · at least (\\d+) g fibre per serving`
  ).exec(prompt);

  if (!match) {
    throw new Error(`no brief for ${slot}`);
  }

  const [kcal, proteinG, carbsG, fatG, fiberG] = match.slice(1).map(Number) as [number, number, number, number, number];

  return { carbsG, fatG, fiberG, kcal, proteinG };
}

describe('buildPoolPrompt', () => {
  /**
   * The bug 3.0.0 exists to fix (`0047`). The pool builder sends one slot per
   * request (`0016`), and the share was computed over the slots in the request —
   * so every dish was asked to carry the whole day in one serving.
   */
  it('briefs a one-slot request at that slot’s share of the day, not the whole day', () => {
    const lunch = briefIn(buildPoolPrompt(context(), []), 'lunch');
    const share = weightsFor(DEFAULT_MEAL_SHAPE).get('lunch')! / [...weightsFor(DEFAULT_MEAL_SHAPE).values()].reduce((a, b) => a + b, 0);

    expect(lunch.kcal).toBe(Math.round(TARGETS.kcal * share));
    expect(lunch.kcal).toBeLessThan(TARGETS.kcal / 2);
  });

  it('briefs the slots of one day so they add up to the day, on all four macros', () => {
    const slots: MealSlot[] = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
    const briefs = slots.map(slot => briefIn(buildPoolPrompt(context({ needBySlot: new Map([[slot, 4]]) }), []), slot));
    const sum = (key: keyof Brief) => briefs.reduce((total, brief) => total + brief[key], 0);

    // Each figure is rounded on its own, so the day can be off by one per slot.
    expect(Math.abs(sum('kcal') - TARGETS.kcal)).toBeLessThanOrEqual(slots.length);
    expect(Math.abs(sum('proteinG') - TARGETS.proteinG)).toBeLessThanOrEqual(slots.length);
    expect(Math.abs(sum('carbsG') - TARGETS.carbsG)).toBeLessThanOrEqual(slots.length);
    expect(Math.abs(sum('fatG') - TARGETS.fatG)).toBeLessThanOrEqual(slots.length);
  });

  it('sizes each slot by the person’s meal shape', () => {
    const normal = briefIn(buildPoolPrompt(context(), []), 'lunch');
    const large = briefIn(buildPoolPrompt(context({ slotShares: weightsFor({ ...DEFAULT_MEAL_SHAPE, lunch: 'large' }) }), []), 'lunch');
    const snack = (size: 'light' | 'normal') =>
      briefIn(
        buildPoolPrompt(
          context({ needBySlot: new Map([['afternoon_snack', 4]]), slotShares: weightsFor({ ...DEFAULT_MEAL_SHAPE, afternoon_snack: size }) }),
          []
        ),
        'afternoon_snack'
      );

    expect(large.kcal).toBeGreaterThan(normal.kcal);
    expect(snack('light').kcal).toBeLessThan(snack('normal').kcal);
  });

  it('falls back to the default shape, and never briefs a requested slot as a dish of nothing', () => {
    const fallback = briefIn(buildPoolPrompt(context({ slotShares: new Map() }), []), 'lunch');
    const offShape = briefIn(buildPoolPrompt(context({ needBySlot: new Map([['morning_snack', 4]]) }), []), 'morning_snack');

    expect(fallback).toEqual(briefIn(buildPoolPrompt(context(), []), 'lunch'));
    expect(offShape.kcal).toBeGreaterThan(0);
  });

  it('states the whole day — four macros, fibre and the split — and holds each to 5%', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('- 2400 kcal · 150 g protein · 250 g carbohydrate · 70 g fat · at least 30 g fibre');
    expect(prompt).toContain('The split: 27% protein · 45% carbohydrate · 28% fat.');
    expect(prompt).toContain('Energy, protein, carbohydrate and fat are each held to 5% of target on every day, over and under');
    // No longer true since `0045`: the bands are advisory, and nothing is discarded for protein.
    expect(prompt).not.toContain('discarded in full');
  });

  it('teaches how a plate reaches its numbers, raw and cooked weights included', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('HOW TO BUILD EACH DISH TO ITS NUMBERS:');
    expect(prompt).toContain('fat carries 9');
    expect(prompt).toContain('When it asks for little carbohydrate');
    expect(prompt).toContain('is weighed dry, as bought');
  });

  /**
   * 3.0.0's dishes all landed at or over their protein, and a day built from
   * dishes on one side of a figure cannot land on it (`0048`).
   */
  it('asks for protein as a figure to land on, and for each meal’s set to straddle every figure', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('Protein is a figure to land on, not a minimum.');
    expect(prompt).toContain('land about half a little under each figure and half a little over');
    // In numbers per meal, since prose alone still came back high.
    const lunch = briefIn(prompt, 'lunch');

    expect(prompt).toContain(
      `Protein: half the set between ${Math.round(lunch.proteinG * 0.9)} and ${lunch.proteinG} g, half between ${lunch.proteinG} and ${Math.round(lunch.proteinG * 1.1)} g`
    );
    expect(prompt).not.toContain('protein to a floor');
  });

  it('puts way of eating with allergy, above the numbers', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('1. Only ingredients from the list below: nothing forbidden by allergy, nothing their way of eating rules out.');
    expect(prompt.indexOf('1. Only ingredients')).toBeLessThan(prompt.indexOf('2. Each dish lands on its numbers'));
  });

  it.each<[Goal['type'], string]>([
    ['custom', 'set by hand'],
    ['healthy_eating', 'Eating well is the goal'],
    ['maintenance', 'Keeping their weight'],
    ['muscle_gain', 'Building muscle'],
    ['performance', 'Training performance'],
    ['weight_loss', 'Losing weight']
  ])('tells the model what %s asks of a plate', (goal, phrase) => {
    expect(buildPoolPrompt(context({ goal }), [])).toContain(phrase);
  });

  it('says nothing about a goal the person has not set', () => {
    const prompt = buildPoolPrompt(context(), []);

    for (const phrase of ['Losing weight', 'Building muscle', 'Training performance', 'Keeping their weight']) {
      expect(prompt).not.toContain(phrase);
    }
  });

  it('asks a share of the dishes at an event day’s split, only when there is one', () => {
    const loaded: NutritionTargets = { carbsG: 400, fatG: 60, fiberG: 30, kcal: 2900, proteinG: 160 };
    const without = buildPoolPrompt(context(), []);
    const withEvent = buildPoolPrompt(context({ loadedTargets: [loaded] }), []);

    expect(without).not.toContain('EAT FOR AN EVENT');
    expect(withEvent).toContain('SOME DAYS THIS FORTNIGHT EAT FOR AN EVENT');
    expect(withEvent).toContain('Make 2 of these dishes fit that split instead');
    expect(withEvent).toContain('(23% protein · 58% carbohydrate · 19% fat)');
  });

  it('keeps its sections apart and never stacks blank lines', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('\n\nDISHES NEEDED:\n');
    expect(prompt).not.toMatch(/\n{3,}/);
  });

  it('names free-text allergies and the output language', () => {
    const prompt = buildPoolPrompt(context({ forbiddenLabels: ['altramuz'], language: 'British English' }), []);

    expect(prompt).toContain('FORBIDDEN BY ALLERGY');
    expect(prompt).toContain('altramuz');
    expect(prompt).toContain('WRITE EVERY DISH NAME AND EVERY STEP IN BRITISH ENGLISH.');
  });

  /**
   * 3.2.0. The list was 70% of the prompt, and most of its names were the slug
   * again with the accents put back. Every ingredient is still offered.
   */
  it('offers every ingredient, and names one only where its slug does not already say it', () => {
    const ingredient = (slug: string, name: string, category: IngredientCategory = 'produce') => ({ category, name, slug }) as CatalogueIngredient;
    const prompt = buildPoolPrompt(context(), [
      ingredient('calabacin', 'Calabacín'),
      ingredient('arandano', 'Arándanos'),
      ingredient('aceite-de-oliva-virgen-extra', 'Aceite de oliva virgen extra', 'pantry'),
      ingredient('nora', 'Ñora', 'pantry')
    ]);

    expect(prompt).toContain('Fresh produce and herbs:\narandano (Arándanos), calabacin\n');
    expect(prompt).toContain('Pantry: grains, pasta, tins, oils, sauces, spices:\naceite-de-oliva-virgen-extra, nora (Ñora)\n');
  });

  /**
   * 3.2.2. The prompt said "fifteen is a shopping trip" while the schema
   * refused thirteen; the model believed the prompt. The two now say the same.
   */
  it('states the ingredient ceiling and the servings the schema enforces', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).toContain('Never more than fifteen, salt, spices and oil included');
    expect(prompt).toContain('Declare between one and eight servings.');
  });

  /**
   * A tripwire, not a spec. The rewrite sweep re-writes the method of every
   * recipe whose stamp differs from this, with a model call each. Change it only
   * with the steps rules, and change this test on purpose when you do.
   */
  it('keeps the steps stamp where the steps rules last changed', () => {
    expect(STEPS_VERSION).toBe('2.8.0');
  });

  /**
   * 3.3.0. Forty grams of protein at breakfast came back as pasta with turkey,
   * and a snack as a bowl of turkey with strawberries: on the numbers, and not
   * what anybody eats at that hour.
   */
  it('tells breakfast and a snack what kind of food they are', () => {
    const prompt = buildPoolPrompt(
      context({
        needBySlot: new Map<MealSlot, number>([
          ['breakfast', 4],
          ['afternoon_snack', 4]
        ])
      }),
      []
    );

    expect(prompt).toContain('Breakfast: morning food, built on bread, oats, dairy, eggs or fruit');
    expect(prompt).toContain('Not lunch food: no pasta, rice, stews, pulses or plated salads.');
    expect(prompt).toContain('Not a plated main: no rice, pasta, potato or pulses as its base');
    expect(prompt).not.toContain('come first');
  });

  it('lets the person’s own words about breakfast win over that', () => {
    const prompt = buildPoolPrompt(context({ breakfastStyle: 'Salado y rápido', needBySlot: new Map<MealSlot, number>([['breakfast', 4]]) }), []);

    expect(prompt).toContain('Their own words about breakfast, below, come first.');
    expect(prompt).toContain('- Breakfast, in their words: Salado y rápido');
  });

  it('says nothing of the kind of food a lunch is', () => {
    const prompt = buildPoolPrompt(context(), []);

    expect(prompt).not.toContain('Breakfast: morning food');
    expect(prompt).not.toContain('Not a plated main');
  });
});

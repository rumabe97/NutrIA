import { describe, expect, it } from 'vitest';

import { DISHES_NEEDED_PER_SLOT, FRESH_DISHES_PER_SLOT, isPreferredDish, REUSED_DISHES_PER_SLOT, rotatePool, seededShuffle } from 'core/domain/Variety';
import type { CandidateDish, MealSlot } from 'core/entities/Plan';

import { makeDish } from '#test/fixtures';

function library(count: number, slots: readonly MealSlot[]): CandidateDish[] {
  return Array.from({ length: count }, (_, index) => makeDish({ name: `Dish ${index}`, slots: [...slots], slug: `dish-${index}` }));
}

const nothingAvoided = new Set<string>();

describe('seededShuffle', () => {
  it('is a permutation, and the same one for the same seed', () => {
    const items = Array.from({ length: 50 }, (_, index) => index);
    const once = seededShuffle(items, 'user-a:1');

    expect([...once].sort((a, b) => a - b)).toEqual(items);
    expect(seededShuffle(items, 'user-a:1')).toEqual(once);
  });

  it('gives a different order for a different seed', () => {
    const items = Array.from({ length: 50 }, (_, index) => index);

    expect(seededShuffle(items, 'user-a:1')).not.toEqual(seededShuffle(items, 'user-b:1'));
    expect(seededShuffle(items, 'user-a:1')).not.toEqual(seededShuffle(items, 'user-a:2'));
  });

  it('leaves the input untouched', () => {
    const items = [1, 2, 3, 4, 5];

    seededShuffle(items, 'x');

    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('rotatePool', () => {
  const slots: MealSlot[] = ['breakfast', 'lunch'];

  it('hands two users different dishes from the same library', () => {
    const dishes = library(60, ['lunch']);
    const first = rotatePool(dishes, ['lunch'], { avoidSlugs: nothingAvoided, seed: 'user-a:1' }).map(dish => dish.slug);
    const second = rotatePool(dishes, ['lunch'], { avoidSlugs: nothingAvoided, seed: 'user-b:1' }).map(dish => dish.slug);

    expect(first).toHaveLength(REUSED_DISHES_PER_SLOT);
    expect(second).toHaveLength(REUSED_DISHES_PER_SLOT);
    expect(first).not.toEqual(second);
  });

  it('leaves a third of every slot for dishes that do not exist yet, however large the library', () => {
    const dishes = library(200, ['lunch']);
    const picked = rotatePool(dishes, ['lunch'], { avoidSlugs: nothingAvoided, seed: 'user-a:1' });

    expect(picked.length + FRESH_DISHES_PER_SLOT).toBe(DISHES_NEEDED_PER_SLOT);
    expect(FRESH_DISHES_PER_SLOT).toBeGreaterThanOrEqual(Math.ceil(DISHES_NEEDED_PER_SLOT / 3));
  });

  it('hands the same user the same dishes for the same plan version, and different ones next fortnight', () => {
    const dishes = library(60, ['lunch']);
    const rotation = { avoidSlugs: nothingAvoided, seed: 'user-a:1' };

    expect(rotatePool(dishes, ['lunch'], rotation)).toEqual(rotatePool(dishes, ['lunch'], rotation));
    expect(rotatePool(dishes, ['lunch'], rotation)).not.toEqual(rotatePool(dishes, ['lunch'], { ...rotation, seed: 'user-a:2' }));
  });

  it('puts what the user asked to see again at the front, however large the library', () => {
    const dishes = library(300, ['lunch']);
    const picked = rotatePool(dishes, ['lunch'], { avoidSlugs: nothingAvoided, preferSlugs: new Set(['dish-250', 'dish-299']), seed: 'user-a:1' }).map(dish => dish.slug);

    expect(picked.slice(0, 2).sort()).toEqual(['dish-250', 'dish-299']);
    expect(picked).toHaveLength(REUSED_DISHES_PER_SLOT);
  });

  it('does not let a favourite override last fortnight', () => {
    const dishes = library(20, ['lunch']);
    const picked = rotatePool(dishes, ['lunch'], { avoidSlugs: new Set(['dish-3']), preferSlugs: new Set(['dish-3']), seed: 'user-a:1' }).map(dish => dish.slug);

    expect(picked).not.toContain('dish-3');
  });

  it('never offers what the user had last fortnight', () => {
    const dishes = library(20, ['lunch']);
    const avoid = new Set(['dish-3', 'dish-7', 'dish-11']);
    const picked = rotatePool(dishes, ['lunch'], { avoidSlugs: avoid, seed: 'user-a:2' }).map(dish => dish.slug);

    for (const slug of avoid) {expect(picked).not.toContain(slug);}
  });

  it('covers every slot up to the per-slot need, counting a dish for each slot it suits', () => {
    const dishes = [...library(30, ['breakfast']), ...library(30, ['lunch']).map(dish => ({ ...dish, slug: `l-${dish.slug}` }))];
    const picked = rotatePool(dishes, slots, { avoidSlugs: nothingAvoided, seed: 's' }, 5);

    expect(picked.filter(dish => dish.slots.includes('breakfast'))).toHaveLength(5);
    expect(picked.filter(dish => dish.slots.includes('lunch'))).toHaveLength(5);
  });

  it('returns the whole library when it is smaller than the need — the shortfall is the model’s job', () => {
    const dishes = library(4, ['lunch']);

    expect(rotatePool(dishes, ['lunch'], { avoidSlugs: nothingAvoided, seed: 's' })).toHaveLength(4);
  });

  it('never returns the same dish twice', () => {
    const dishes = library(40, ['breakfast', 'lunch']);
    const picked = rotatePool(dishes, slots, { avoidSlugs: nothingAvoided, seed: 's' });

    expect(new Set(picked.map(dish => dish.slug)).size).toBe(picked.length);
  });
});

describe('isPreferredDish — the three reasons a dish goes first', () => {
  const dish = (slug: string, cuisine: string | null, slugs: readonly string[]) => ({
    ...makeDish({ ingredients: slugs.map(ingredient => ({ grams: 100, slug: ingredient })), name: slug, slug }),
    cuisine
  });

  it('takes a dish they asked for by name', () => {
    expect(isPreferredDish(dish('a', null, []), { preferSlugs: new Set(['a']) })).toBe(true);
    expect(isPreferredDish(dish('b', null, []), { preferSlugs: new Set(['a']) })).toBe(false);
  });

  it('takes a kitchen they chose, however it was written', () => {
    const leaning = { preferCuisines: new Set(['mediterranea']) };

    expect(isPreferredDish(dish('a', 'mediterranea', []), leaning)).toBe(true);
    expect(isPreferredDish(dish('a', 'japonesa', []), leaning)).toBe(false);
    expect(isPreferredDish(dish('a', null, []), leaning)).toBe(false);
  });

  it('takes a food they said they like', () => {
    const leaning = { preferIngredientSlugs: new Set(['salmon']) };

    expect(isPreferredDish(dish('a', null, ['arroz', 'salmon']), leaning)).toBe(true);
    expect(isPreferredDish(dish('a', null, ['arroz']), leaning)).toBe(false);
  });

  it('prefers nothing when nothing was said', () => {
    expect(isPreferredDish(dish('a', 'mediterranea', ['salmon']), {})).toBe(false);
  });
});

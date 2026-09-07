import { describe, expect, it } from 'vitest';

import { DISHES_NEEDED_PER_SLOT, rotatePool, seededShuffle } from 'core/domain/Variety';
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

    expect(first).toHaveLength(DISHES_NEEDED_PER_SLOT);
    expect(second).toHaveLength(DISHES_NEEDED_PER_SLOT);
    expect(first).not.toEqual(second);
  });

  it('hands the same user the same dishes for the same plan version, and different ones next fortnight', () => {
    const dishes = library(60, ['lunch']);
    const rotation = { avoidSlugs: nothingAvoided, seed: 'user-a:1' };

    expect(rotatePool(dishes, ['lunch'], rotation)).toEqual(rotatePool(dishes, ['lunch'], rotation));
    expect(rotatePool(dishes, ['lunch'], rotation)).not.toEqual(rotatePool(dishes, ['lunch'], { ...rotation, seed: 'user-a:2' }));
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

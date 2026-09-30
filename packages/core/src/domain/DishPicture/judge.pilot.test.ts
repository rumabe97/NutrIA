import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { judgePicture } from 'core/domain/DishPicture';

import { SEED_CATALOGUE } from '#test/dish-picture/acceptance';

import type { PictureMatch, PictureRecipe, SeenFood } from 'core/domain/DishPicture';

/*
 * The floor of the picture judge (project 010, PRD 2): the judge's stored
 * answers for the pilot's 68 pictures, run through the rule with the seed
 * catalogue. 65 faithful pictures are accepted with the notes they had before
 * the rule changed, and the 3 pictures judged against the wrong recipe are
 * rejected. No phase of the project edits this file or its fixture: a change
 * to the rule that moves one verdict or one note here is the change to undo.
 *
 * `judge.pilot.fixture.json` says in its `about` how it was reduced from the
 * pilot's private record, what was left out, and what is an assumption — the
 * controls' match call, rebuilt from their verdicts.
 */
type PilotPicture = {
  readonly id: string;
  readonly accepted: boolean;
  readonly match: PictureMatch;
  readonly notes: readonly string[];
  readonly recipe: string;
  readonly seen: {
    readonly extraDishes?: number;
    readonly foods: readonly SeenFood[];
    /** How many objects the judge listed; their names were not kept. */
    readonly nonFood?: number;
    readonly plasticOrCgi?: boolean;
    readonly realism?: number;
    readonly sharpness?: number;
  };
  readonly set: 'control' | 'mini' | 'rejudged';
};

type PilotFixture = {
  readonly pictures: readonly PilotPicture[];
  readonly recipes: readonly { readonly ingredients: PictureRecipe['ingredients']; readonly key: string; readonly title: string }[];
};

const PILOT = JSON.parse(readFileSync(join(__dirname, 'judge.pilot.fixture.json'), 'utf8')) as PilotFixture;
const RECIPES = new Map(PILOT.recipes.map(recipe => [recipe.key, { ingredients: recipe.ingredients, name: recipe.title }]));

function verdictOn({ match, recipe, seen }: PilotPicture) {
  const dish = RECIPES.get(recipe);

  if (dish === undefined) {
    throw new Error(`The fixture has no recipe "${recipe}"`);
  }

  const { nonFood, ...rest } = seen;

  return judgePicture({
    catalogue: SEED_CATALOGUE,
    match,
    recipe: dish,
    seen: { ...rest, ...(nonFood === undefined ? {} : { nonFood: Array.from({ length: nonFood }, () => 'object') }) }
  });
}

describe('judgePicture — the pilot, replayed', () => {
  const faithful = PILOT.pictures.filter(picture => picture.set !== 'control');
  const controls = PILOT.pictures.filter(picture => picture.set === 'control');

  it('holds the 57 pictures judged again, the 8 of the mini-pilot and the 3 controls, over 20 recipes', () => {
    const count = (set: PilotPicture['set']) => PILOT.pictures.filter(picture => picture.set === set).length;

    expect([count('rejudged'), count('mini'), count('control')]).toEqual([57, 8, 3]);
    expect(PILOT.recipes).toHaveLength(20);
    expect(new Set(PILOT.pictures.map(picture => picture.id)).size).toBe(68);
  });

  it('pins every faithful picture as accepted and every control as rejected', () => {
    expect(faithful.every(picture => picture.accepted)).toBe(true);
    expect(controls.some(picture => picture.accepted)).toBe(false);
  });

  it.each(faithful.map(picture => [picture.id, picture] as const))('accepts %s with the notes it had', (_id, picture) => {
    const verdict = verdictOn(picture);

    expect({ accepted: verdict.accepted, notes: verdict.notes }).toEqual({ accepted: true, notes: picture.notes });
  });

  /*
   * A control is pinned by what rejects it, not by its whole notes: closing a
   * hole (phase 5) may add an allergen to a food beside the one that rejects,
   * and must not have to touch this file.
   */
  it.each([
    ['control-1', 'shrimp', 'crustaceans'],
    ['control-2', 'octopus', 'molluscs'],
    ['control-2', 'feta cheese', 'milk'],
    ['control-3', 'bun', 'gluten']
  ])('rejects %s, a picture judged against the wrong recipe: "%s" carries %s', (id, name, allergen) => {
    const picture = controls.find(control => control.id === id);

    expect(picture).toBeDefined();

    const verdict = verdictOn(picture as PilotPicture);

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.find(extra => extra.name === name)?.foreignAllergens).toContain(allergen);
  });

  it('gives no dish a title: each recipe is named by its number in the pilot', () => {
    expect(PILOT.recipes.map(recipe => recipe.title)).toEqual(PILOT.recipes.map(recipe => `Plato del piloto ${recipe.key}`));
  });
});

import type { AllergenKey } from '../allergens';

export type Category = 'bakery' | 'beverages' | 'dairy' | 'frozen' | 'other' | 'pantry' | 'produce' | 'protein';
export type Unit = 'cup' | 'g' | 'ml' | 'pinch' | 'slice' | 'tbsp' | 'tsp' | 'unit';

/**
 * The classes of food a substitution must never introduce, and the classes a
 * way of eating excludes. `pork` implies `meat`, and everything here implies
 * `animal`. Four of them the allergen links already reveal — milk is `dairy`,
 * eggs `egg`, fish `fish`, crustaceans or molluscs `shellfish` — so a row tags
 * only what no allergen shows: `meat`, `pork`, or a bare `animal` for honey,
 * gelatine, lard and a meat stock. `foodClasses()` in `seed.test.ts` does the
 * joining; the seed says the least it can.
 */
export type FoodClass = 'animal' | 'dairy' | 'egg' | 'fish' | 'meat' | 'pork' | 'shellfish';

export type IngredientSeed = {
  readonly allergens?: readonly { readonly key: AllergenKey; readonly presence?: 'contains' | 'may_contain' }[];
  readonly carbs: number;
  readonly category: Category;
  /** Only what the allergens cannot tell — see `FoodClass`. */
  readonly classes?: readonly FoodClass[];
  readonly defaultUnit?: Unit;
  readonly fat: number;
  readonly fiber?: number;
  readonly gramsPerUnit?: number;
  readonly kcal: number;
  /** Spanish. The other locales live in `ingredient-names.ts`, keyed by slug. */
  readonly name: string;
  readonly protein: number;
  readonly slug: string;
  /** Composition table the macros came from. Defaults to `manual` when unset. */
  readonly source?: 'bedca' | 'manual' | 'usda';
};

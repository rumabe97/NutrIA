import { BAKERY } from './bakery';
import { BEVERAGES } from './beverages';
import { DAIRY } from './dairy';
import { FROZEN } from './frozen';
import { OTHER } from './other';
import { PANTRY } from './pantry';
import { PRODUCE } from './produce';
import { PROTEIN } from './protein';
import { STARTER } from './starter';

import type { IngredientSeed } from './types';

export type { Category, FoodClass, IngredientSeed, Unit } from './types';

/**
 * The whole catalogue: the starter set, then the expansion by category. Order
 * carries no meaning; the slug is the identity and `seed.test.ts` refuses a
 * duplicate. A row in any of these files is a thing the model may cook with,
 * so every row carries its allergens — the catalogue is the safety boundary
 * ([`0004`](../../../../../docs/decisions/0004-ai-provider-and-deterministic-safety.md)).
 */
export const INGREDIENT_SEED: readonly IngredientSeed[] = [...STARTER, ...PRODUCE, ...PROTEIN, ...DAIRY, ...PANTRY, ...FROZEN, ...BAKERY, ...BEVERAGES, ...OTHER];

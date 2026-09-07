import type { AllergenKey } from './allergens';

type Category = 'bakery' | 'beverages' | 'dairy' | 'frozen' | 'other' | 'pantry' | 'produce' | 'protein';
type Unit = 'cup' | 'g' | 'ml' | 'pinch' | 'slice' | 'tbsp' | 'tsp' | 'unit';

export type IngredientSeed = {
  readonly allergens?: readonly { readonly key: AllergenKey; readonly presence?: 'contains' | 'may_contain' }[];
  readonly carbs: number;
  readonly category: Category;
  readonly defaultUnit?: Unit;
  readonly fat: number;
  readonly fiber?: number;
  readonly gramsPerUnit?: number;
  readonly kcal: number;
  readonly name: string;
  readonly protein: number;
  readonly slug: string;
  /** Composition table the macros came from. Defaults to `manual` when unset. */
  readonly source?: 'bedca' | 'manual' | 'usda';
};

/**
 * Starter catalogue for the Spanish/Mediterranean market. Macros are **per 100 g**
 * of edible portion, rounded to one decimal, sourced from BEDCA/USDA composition
 * tables. They exist so a plan's nutrition is looked up, not invented by a model.
 *
 * `gramsPerUnit` is what turns "2 huevos" into grams without a guess — set it on
 * anything a person counts rather than weighs.
 *
 * Adding rows here is safe and expected. Changing an existing row's macros is
 * not: meals snapshot their macros at generation time, so historical plans keep
 * the numbers the user actually ate, but the row still feeds every future plan.
 */
export const INGREDIENT_SEED: readonly IngredientSeed[] = [
  // ── Produce ───────────────────────────────────────────────────────────
  { carbs: 3.9, category: 'produce', fat: 0.2, fiber: 1.2, kcal: 18, name: 'Tomate', protein: 0.9, slug: 'tomate' },
  { carbs: 2.2, category: 'produce', fat: 0.2, fiber: 1.2, kcal: 16, name: 'Cebolla', protein: 1.2, slug: 'cebolla' },
  { carbs: 6.4, category: 'produce', fat: 0.3, fiber: 2.1, kcal: 31, name: 'Pimiento rojo', protein: 1, slug: 'pimiento-rojo' },
  { carbs: 6.5, category: 'produce', fat: 0.2, fiber: 2.8, kcal: 33, name: 'Zanahoria', protein: 0.9, slug: 'zanahoria' },
  { carbs: 3.6, category: 'produce', fat: 0.4, fiber: 2.2, kcal: 23, name: 'Espinaca', protein: 2.9, slug: 'espinaca' },
  { carbs: 6.6, category: 'produce', fat: 0.4, fiber: 2.6, kcal: 35, name: 'Brócoli', protein: 3, slug: 'brocoli' },
  { carbs: 2.1, category: 'produce', fat: 0.2, fiber: 1.1, kcal: 15, name: 'Calabacín', protein: 1.2, slug: 'calabacin' },
  { carbs: 15.6, category: 'produce', fat: 0.1, fiber: 2.2, kcal: 77, name: 'Patata', protein: 2, slug: 'patata' },
  { carbs: 17.7, category: 'produce', fat: 0.1, fiber: 2.6, kcal: 86, name: 'Boniato', protein: 1.6, slug: 'boniato' },
  { carbs: 8.5, category: 'produce', fat: 14.7, fiber: 6.7, kcal: 160, name: 'Aguacate', protein: 2, slug: 'aguacate' },
  { carbs: 11.4, category: 'produce', defaultUnit: 'unit', fat: 0.2, fiber: 2.4, gramsPerUnit: 180, kcal: 52, name: 'Manzana', protein: 0.3, slug: 'manzana' },
  { carbs: 20.2, category: 'produce', defaultUnit: 'unit', fat: 0.3, fiber: 2.6, gramsPerUnit: 120, kcal: 89, name: 'Plátano', protein: 1.1, slug: 'platano' },
  { carbs: 8.9, category: 'produce', defaultUnit: 'unit', fat: 0.1, fiber: 2.4, gramsPerUnit: 130, kcal: 47, name: 'Naranja', protein: 0.9, slug: 'naranja' },
  { carbs: 7.7, category: 'produce', fat: 0.3, fiber: 2, kcal: 32, name: 'Fresa', protein: 0.7, slug: 'fresa' },
  { carbs: 30.9, category: 'produce', fat: 0.5, fiber: 3.3, kcal: 132, name: 'Ajo', protein: 6.4, slug: 'ajo' },
  { carbs: 2.9, category: 'produce', fat: 0.1, fiber: 1.2, kcal: 15, name: 'Lechuga', protein: 1.4, slug: 'lechuga' },
  { carbs: 3.6, category: 'produce', fat: 0.1, fiber: 0.5, kcal: 16, name: 'Pepino', protein: 0.7, slug: 'pepino' },
  { carbs: 3.3, category: 'produce', fat: 0.3, fiber: 1, kcal: 22, name: 'Champiñón', protein: 3.1, slug: 'champinon' },
  { allergens: [{ key: 'celery' }], carbs: 2.9, category: 'produce', fat: 0.2, fiber: 1.6, kcal: 16, name: 'Apio', protein: 0.7, slug: 'apio' },
  { carbs: 4.3, category: 'produce', fat: 0.2, fiber: 1.7, kcal: 23, name: 'Pimiento verde', protein: 0.9, slug: 'pimiento-verde', source: 'bedca' },
  { carbs: 5.7, category: 'produce', fat: 0.2, fiber: 3, kcal: 29, name: 'Berenjena', protein: 1, slug: 'berenjena', source: 'bedca' },
  { carbs: 4.1, category: 'produce', fat: 0.3, fiber: 2, kcal: 27, name: 'Coliflor', protein: 1.9, slug: 'coliflor', source: 'bedca' },
  { carbs: 5.9, category: 'produce', fat: 0.7, fiber: 3.6, kcal: 43, name: 'Col rizada', protein: 3.3, slug: 'col-rizada', source: 'usda' },
  { carbs: 4.9, category: 'produce', fat: 0.2, fiber: 3.4, kcal: 29, name: 'Judía verde', protein: 1.8, slug: 'judia-verde', source: 'bedca' },
  { carbs: 12.4, category: 'produce', fat: 0.3, fiber: 1.8, kcal: 58, name: 'Puerro', protein: 1.5, slug: 'puerro', source: 'bedca' },
  { carbs: 2.1, category: 'produce', fat: 0.7, fiber: 1.6, kcal: 25, name: 'Rúcula', protein: 2.6, slug: 'rucula', source: 'usda' },
  { carbs: 2.6, category: 'produce', fat: 0.2, fiber: 2.1, kcal: 17, name: 'Escarola', protein: 1.3, slug: 'escarola', source: 'bedca' },
  { carbs: 8.8, category: 'produce', fat: 0.2, fiber: 2.8, kcal: 43, name: 'Remolacha', protein: 1.6, slug: 'remolacha', source: 'bedca' },
  { carbs: 3.4, category: 'produce', fat: 0.1, fiber: 1.6, kcal: 17, name: 'Rábano', protein: 0.7, slug: 'rabano', source: 'bedca' },
  { carbs: 6.4, category: 'produce', fat: 0.1, fiber: 1.8, kcal: 30, name: 'Nabo', protein: 0.9, slug: 'nabo', source: 'bedca' },
  { carbs: 11.2, category: 'produce', defaultUnit: 'unit', fat: 0.2, fiber: 5.4, gramsPerUnit: 120, kcal: 60, name: 'Alcachofa', protein: 3.3, slug: 'alcachofa', source: 'bedca' },
  { carbs: 3.9, category: 'produce', defaultUnit: 'unit', fat: 0.1, fiber: 2.1, gramsPerUnit: 20, kcal: 25, name: 'Espárrago verde', protein: 2.2, slug: 'esparrago-verde', source: 'bedca' },
  { carbs: 6.5, category: 'produce', fat: 0.1, fiber: 0.5, kcal: 31, name: 'Calabaza', protein: 1, slug: 'calabaza', source: 'bedca' },
  { carbs: 19, category: 'produce', fat: 1.5, fiber: 2.4, kcal: 103, name: 'Maíz dulce cocido', protein: 3.4, slug: 'maiz-dulce', source: 'usda' },
  { carbs: 16.8, category: 'produce', fat: 0.1, fiber: 3.2, kcal: 78, name: 'Chalota', protein: 2.5, slug: 'chalota', source: 'usda' },
  { carbs: 7.3, category: 'produce', fat: 0.2, fiber: 2.6, kcal: 38, name: 'Cebolleta', protein: 1.8, slug: 'cebolleta', source: 'bedca' },
  { carbs: 6.3, category: 'produce', fat: 0.8, fiber: 3.3, kcal: 44, name: 'Perejil fresco', protein: 3, slug: 'perejil', source: 'bedca' },
  { carbs: 3.7, category: 'produce', fat: 0.5, fiber: 2.8, kcal: 28, name: 'Cilantro fresco', protein: 2.1, slug: 'cilantro', source: 'usda' },
  { carbs: 9.3, category: 'produce', defaultUnit: 'unit', fat: 0.3, fiber: 2.8, gramsPerUnit: 100, kcal: 44, name: 'Limón', protein: 1.1, slug: 'limon', source: 'bedca' },
  { carbs: 18.1, category: 'produce', fat: 0.2, fiber: 0.9, kcal: 77, name: 'Uva', protein: 0.6, slug: 'uva', source: 'bedca' },
  { carbs: 9.5, category: 'produce', defaultUnit: 'unit', fat: 0.3, fiber: 1.5, gramsPerUnit: 150, kcal: 44, name: 'Melocotón', protein: 0.9, slug: 'melocoton', source: 'bedca' },
  { carbs: 15.2, category: 'produce', defaultUnit: 'unit', fat: 0.1, fiber: 3.1, gramsPerUnit: 170, kcal: 63, name: 'Pera', protein: 0.4, slug: 'pera', source: 'bedca' },
  { carbs: 14.7, category: 'produce', defaultUnit: 'unit', fat: 0.5, fiber: 3, gramsPerUnit: 75, kcal: 68, name: 'Kiwi', protein: 1.1, slug: 'kiwi', source: 'usda' },
  { carbs: 8.2, category: 'produce', fat: 0.2, fiber: 0.9, kcal: 38, name: 'Melón', protein: 0.8, slug: 'melon', source: 'bedca' },
  { carbs: 7.6, category: 'produce', fat: 0.2, fiber: 0.4, kcal: 35, name: 'Sandía', protein: 0.6, slug: 'sandia', source: 'bedca' },

  // ── Protein ───────────────────────────────────────────────────────────
  { carbs: 0, category: 'protein', fat: 3.6, kcal: 165, name: 'Pechuga de pollo', protein: 31, slug: 'pechuga-de-pollo' },
  { carbs: 0, category: 'protein', fat: 8.1, kcal: 172, name: 'Muslo de pollo', protein: 24.8, slug: 'muslo-de-pollo' },
  { carbs: 0, category: 'protein', fat: 4.3, kcal: 143, name: 'Pavo', protein: 29, slug: 'pavo' },
  { carbs: 0, category: 'protein', fat: 10.7, kcal: 195, name: 'Ternera magra', protein: 26.1, slug: 'ternera-magra' },
  { carbs: 0, category: 'protein', fat: 6.6, kcal: 143, name: 'Lomo de cerdo', protein: 22.2, slug: 'lomo-de-cerdo' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 13.4, kcal: 208, name: 'Salmón', protein: 20.4, slug: 'salmon' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 1, kcal: 82, name: 'Merluza', protein: 17.8, slug: 'merluza' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 1, kcal: 116, name: 'Atún al natural', protein: 25.5, slug: 'atun-al-natural' },
  { allergens: [{ key: 'crustaceans' }], carbs: 0.2, category: 'protein', fat: 1.7, kcal: 99, name: 'Gambas', protein: 20.3, slug: 'gambas' },
  { allergens: [{ key: 'molluscs' }], carbs: 3.7, category: 'protein', fat: 2.5, kcal: 86, name: 'Mejillón', protein: 11.9, slug: 'mejillon' },
  { allergens: [{ key: 'eggs' }], carbs: 1.1, category: 'protein', defaultUnit: 'unit', fat: 9.5, gramsPerUnit: 58, kcal: 143, name: 'Huevo', protein: 12.6, slug: 'huevo' },
  { allergens: [{ key: 'soy' }], carbs: 2.8, category: 'protein', fat: 8.7, fiber: 0.9, kcal: 144, name: 'Tofu firme', protein: 15.8, slug: 'tofu-firme' },
  { carbs: 27.4, category: 'protein', fat: 2.6, fiber: 7.6, kcal: 164, name: 'Garbanzos cocidos', protein: 8.9, slug: 'garbanzos-cocidos' },
  { carbs: 20.1, category: 'protein', fat: 0.4, fiber: 7.9, kcal: 116, name: 'Lentejas cocidas', protein: 9, slug: 'lentejas-cocidas' },
  { carbs: 21.2, category: 'protein', fat: 0.5, fiber: 6.4, kcal: 127, name: 'Alubias blancas cocidas', protein: 8.7, slug: 'alubias-blancas-cocidas' },
  { carbs: 0.5, category: 'protein', fat: 14, kcal: 248, name: 'Jamón serrano', protein: 30.1, slug: 'jamon-serrano', source: 'bedca' },
  { carbs: 1.5, category: 'protein', fat: 3, kcal: 101, name: 'Jamón cocido', protein: 17, slug: 'jamon-cocido', source: 'bedca' },
  { carbs: 2, category: 'protein', fat: 31, kcal: 375, name: 'Chorizo', protein: 22, slug: 'chorizo', source: 'bedca' },
  { carbs: 1.4, category: 'protein', fat: 45, kcal: 448, name: 'Panceta', protein: 9.3, slug: 'panceta', source: 'bedca' },
  { carbs: 0, category: 'protein', fat: 8, kcal: 156, name: 'Solomillo de ternera', protein: 21, slug: 'solomillo-de-ternera', source: 'bedca' },
  { carbs: 0, category: 'protein', fat: 5, kcal: 129, name: 'Carne picada de ternera', protein: 21, slug: 'carne-picada-de-ternera', source: 'bedca' },
  { carbs: 0, category: 'protein', fat: 23, kcal: 279, name: 'Costillas de cerdo', protein: 18, slug: 'costillas-de-cerdo', source: 'bedca' },
  { carbs: 0, category: 'protein', fat: 4, kcal: 120, name: 'Conejo', protein: 21, slug: 'conejo', source: 'bedca' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 0.7, kcal: 78, name: 'Bacalao desalado', protein: 17.8, slug: 'bacalao-desalado', source: 'bedca' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 3, kcal: 103, name: 'Dorada', protein: 19, slug: 'dorada', source: 'bedca' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 3, kcal: 99, name: 'Lubina', protein: 18, slug: 'lubina', source: 'bedca' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'protein', fat: 11, kcal: 179, name: 'Sardina', protein: 20, slug: 'sardina', source: 'bedca' },
  { allergens: [{ key: 'molluscs' }], carbs: 3, category: 'protein', fat: 1.4, kcal: 85, name: 'Calamar', protein: 15, slug: 'calamar', source: 'bedca' },
  { allergens: [{ key: 'molluscs' }], carbs: 2, category: 'protein', fat: 1, kcal: 89, name: 'Pulpo cocido', protein: 18, slug: 'pulpo-cocido', source: 'bedca' },
  { allergens: [{ key: 'molluscs' }], carbs: 2.6, category: 'protein', fat: 1, kcal: 67, name: 'Almeja', protein: 12, slug: 'almeja', source: 'bedca' },
  { allergens: [{ key: 'eggs' }], carbs: 0.7, category: 'protein', defaultUnit: 'unit', fat: 0.2, gramsPerUnit: 33, kcal: 48, name: 'Clara de huevo', protein: 10.9, slug: 'clara-de-huevo', source: 'usda' },
  { allergens: [{ key: 'soy' }], carbs: 10, category: 'protein', fat: 5, fiber: 5, kcal: 129, name: 'Edamame cocido', protein: 11, slug: 'edamame-cocido', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 4, category: 'protein', fat: 1.9, fiber: 0.6, kcal: 133, name: 'Seitán', protein: 25, slug: 'seitan', source: 'usda' },
  { allergens: [{ key: 'soy' }], carbs: 9, category: 'protein', fat: 11, fiber: 5, kcal: 211, name: 'Tempeh', protein: 19, slug: 'tempeh', source: 'usda' },
  { carbs: 20, category: 'protein', fat: 0.6, fiber: 6.5, kcal: 121, name: 'Alubias pintas cocidas', protein: 9, slug: 'alubias-pintas-cocidas', source: 'usda' },

  // ── Dairy ─────────────────────────────────────────────────────────────
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.6, category: 'dairy', fat: 4, kcal: 97, name: 'Yogur griego natural', protein: 9, slug: 'yogur-griego-natural' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.3, category: 'dairy', fat: 0.2, kcal: 59, name: 'Yogur natural desnatado', protein: 10.3, slug: 'yogur-natural-desnatado' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 4.7, category: 'dairy', defaultUnit: 'ml', fat: 1.6, kcal: 46, name: 'Leche semidesnatada', protein: 3.2, slug: 'leche-semidesnatada' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.4, category: 'dairy', fat: 4.3, kcal: 98, name: 'Requesón', protein: 11.1, slug: 'requeson' },
  { allergens: [{ key: 'milk' }], carbs: 1.3, category: 'dairy', fat: 33.1, kcal: 402, name: 'Queso curado', protein: 25, slug: 'queso-curado' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.1, category: 'dairy', fat: 22.1, kcal: 280, name: 'Queso fresco de cabra', protein: 18.5, slug: 'queso-fresco-de-cabra' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 4.8, category: 'dairy', defaultUnit: 'ml', fat: 3.6, kcal: 64, name: 'Leche entera', protein: 3.2, slug: 'leche-entera', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 5, category: 'dairy', defaultUnit: 'ml', fat: 0.2, kcal: 35, name: 'Leche desnatada', protein: 3.4, slug: 'leche-desnatada', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 2.2, category: 'dairy', fat: 17, kcal: 234, name: 'Queso mozzarella', protein: 18, slug: 'queso-mozzarella', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.2, category: 'dairy', fat: 25.8, kcal: 388, name: 'Queso parmesano', protein: 35.8, slug: 'queso-parmesano', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3, category: 'dairy', fat: 8, kcal: 132, name: 'Queso de Burgos', protein: 12, slug: 'queso-de-burgos', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.4, category: 'dairy', fat: 4.3, kcal: 96, name: 'Queso cottage', protein: 11, slug: 'queso-cottage', source: 'usda' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 3.5, category: 'dairy', defaultUnit: 'ml', fat: 18, kcal: 186, name: 'Nata para cocinar', protein: 2.5, slug: 'nata-para-cocinar', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 0.1, category: 'dairy', defaultUnit: 'tbsp', fat: 82, gramsPerUnit: 14, kcal: 742, name: 'Mantequilla', protein: 0.9, slug: 'mantequilla', source: 'bedca' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }], carbs: 4.5, category: 'dairy', defaultUnit: 'ml', fat: 3.5, kcal: 63, name: 'Kéfir', protein: 3.3, slug: 'kefir', source: 'bedca' },

  // ── Pantry ────────────────────────────────────────────────────────────
  { carbs: 28.2, category: 'pantry', fat: 0.3, fiber: 0.4, kcal: 130, name: 'Arroz blanco cocido', protein: 2.7, slug: 'arroz-blanco-cocido' },
  { carbs: 23, category: 'pantry', fat: 0.9, fiber: 1.8, kcal: 111, name: 'Arroz integral cocido', protein: 2.6, slug: 'arroz-integral-cocido' },
  { allergens: [{ key: 'gluten' }], carbs: 30.9, category: 'pantry', fat: 1.1, fiber: 1.8, kcal: 158, name: 'Pasta cocida', protein: 5.8, slug: 'pasta-cocida' },
  { carbs: 21.3, category: 'pantry', fat: 1.9, fiber: 2.8, kcal: 120, name: 'Quinoa cocida', protein: 4.4, slug: 'quinoa-cocida' },
  { allergens: [{ key: 'gluten', presence: 'may_contain' }], carbs: 60.1, category: 'pantry', fat: 6.9, fiber: 10.1, kcal: 389, name: 'Copos de avena', protein: 16.9, slug: 'copos-de-avena' },
  { carbs: 0, category: 'pantry', defaultUnit: 'tbsp', fat: 100, gramsPerUnit: 13.5, kcal: 884, name: 'Aceite de oliva virgen extra', protein: 0, slug: 'aceite-de-oliva-virgen-extra' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 21.6, category: 'pantry', fat: 49.9, fiber: 12.5, kcal: 579, name: 'Almendras', protein: 21.2, slug: 'almendras' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 13.7, category: 'pantry', fat: 65.2, fiber: 6.7, kcal: 654, name: 'Nueces', protein: 15.2, slug: 'nueces' },
  { carbs: 42.1, category: 'pantry', fat: 30.7, fiber: 34.4, kcal: 486, name: 'Semillas de chía', protein: 16.5, slug: 'semillas-de-chia' },
  { allergens: [{ key: 'sesame' }], carbs: 23.4, category: 'pantry', fat: 49.7, fiber: 11.8, kcal: 573, name: 'Sésamo', protein: 17.7, slug: 'sesamo' },
  { carbs: 8.6, category: 'pantry', fat: 0.5, fiber: 2.7, kcal: 46, name: 'Tomate triturado', protein: 1.6, slug: 'tomate-triturado' },
  { allergens: [{ key: 'mustard' }], carbs: 5.8, category: 'pantry', defaultUnit: 'tsp', fat: 4, fiber: 3.3, gramsPerUnit: 5, kcal: 66, name: 'Mostaza de Dijon', protein: 4.4, slug: 'mostaza-de-dijon' },
  { allergens: [{ key: 'gluten' }], carbs: 71, category: 'pantry', fat: 5, fiber: 3, kcal: 377, name: 'Pan rallado', protein: 12, slug: 'pan-rallado', source: 'bedca' },
  { allergens: [{ key: 'gluten' }], carbs: 71, category: 'pantry', fat: 1, fiber: 3, kcal: 333, name: 'Harina de trigo', protein: 10, slug: 'harina-de-trigo', source: 'bedca' },
  { allergens: [{ key: 'gluten', presence: 'may_contain' }], carbs: 66, category: 'pantry', fat: 7, fiber: 8, kcal: 379, name: 'Harina de avena', protein: 13, slug: 'harina-de-avena', source: 'usda' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 14, category: 'pantry', fat: 50, fiber: 10, kcal: 590, name: 'Harina de almendra', protein: 21, slug: 'harina-de-almendra', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 23, category: 'pantry', fat: 0.2, fiber: 1.4, kcal: 109, name: 'Cuscús cocido', protein: 3.8, slug: 'cuscus-cocido', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 19, category: 'pantry', fat: 0.2, fiber: 4.5, kcal: 90, name: 'Bulgur cocido', protein: 3.1, slug: 'bulgur-cocido', source: 'usda' },
  { carbs: 25, category: 'pantry', fat: 0.2, fiber: 1, kcal: 109, name: 'Fideos de arroz cocidos', protein: 1.8, slug: 'fideos-de-arroz-cocidos', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 27, category: 'pantry', fat: 0.9, fiber: 3.9, kcal: 137, name: 'Pasta integral cocida', protein: 5.3, slug: 'pasta-integral-cocida', source: 'bedca' },
  { carbs: 20, category: 'pantry', fat: 0.4, fiber: 8, kcal: 120, name: 'Lentejas rojas cocidas', protein: 9, slug: 'lentejas-rojas-cocidas', source: 'usda' },
  { allergens: [{ key: 'soy' }], carbs: 8, category: 'pantry', fat: 1, fiber: 6, kcal: 113, name: 'Soja texturizada cocida', protein: 18, slug: 'soja-texturizada', source: 'usda' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 30, category: 'pantry', fat: 44, fiber: 3.3, kcal: 588, name: 'Anacardos', protein: 18, slug: 'anacardos', source: 'usda' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 28, category: 'pantry', fat: 45, fiber: 10, kcal: 597, name: 'Pistachos', protein: 20, slug: 'pistachos', source: 'usda' },
  { allergens: [{ key: 'tree_nuts' }], carbs: 17, category: 'pantry', fat: 61, fiber: 9.7, kcal: 677, name: 'Avellanas', protein: 15, slug: 'avellanas', source: 'usda' },
  { allergens: [{ key: 'peanuts' }, { key: 'tree_nuts', presence: 'may_contain' }], carbs: 16, category: 'pantry', fat: 49, fiber: 8.5, kcal: 605, name: 'Cacahuetes', protein: 25, slug: 'cacahuetes', source: 'usda' },
  { allergens: [{ key: 'tree_nuts', presence: 'may_contain' }], carbs: 20, category: 'pantry', fat: 51, fiber: 8.6, kcal: 623, name: 'Pipas de girasol', protein: 21, slug: 'pipas-de-girasol', source: 'usda' },
  { allergens: [{ key: 'tree_nuts', presence: 'may_contain' }], carbs: 15, category: 'pantry', fat: 49, fiber: 6, kcal: 577, name: 'Semillas de calabaza', protein: 19, slug: 'semillas-de-calabaza', source: 'usda' },
  { allergens: [{ key: 'tree_nuts', presence: 'may_contain' }], carbs: 29, category: 'pantry', fat: 42, fiber: 27, kcal: 566, name: 'Semillas de lino', protein: 18, slug: 'semillas-de-lino', source: 'usda' },
  { allergens: [{ key: 'sesame' }], carbs: 21, category: 'pantry', defaultUnit: 'tbsp', fat: 54, fiber: 9, gramsPerUnit: 15, kcal: 638, name: 'Tahini', protein: 17, slug: 'tahini', source: 'usda' },
  { allergens: [{ key: 'peanuts' }, { key: 'tree_nuts', presence: 'may_contain' }], carbs: 20, category: 'pantry', defaultUnit: 'tbsp', fat: 50, fiber: 6, gramsPerUnit: 16, kcal: 630, name: 'Mantequilla de cacahuete', protein: 25, slug: 'mantequilla-de-cacahuete', source: 'usda' },
  { carbs: 0, category: 'pantry', defaultUnit: 'tbsp', fat: 100, gramsPerUnit: 13.5, kcal: 900, name: 'Aceite de girasol', protein: 0, slug: 'aceite-de-girasol', source: 'bedca' },
  { carbs: 0, category: 'pantry', defaultUnit: 'tbsp', fat: 100, gramsPerUnit: 13.5, kcal: 900, name: 'Aceite de coco', protein: 0, slug: 'aceite-de-coco', source: 'usda' },
  { carbs: 0.9, category: 'pantry', defaultUnit: 'tbsp', fat: 0, gramsPerUnit: 15, kcal: 4, name: 'Vinagre de manzana', protein: 0, slug: 'vinagre-de-manzana', source: 'bedca' },
  { carbs: 1, category: 'pantry', defaultUnit: 'tbsp', fat: 0, gramsPerUnit: 15, kcal: 5, name: 'Vinagre de Jerez', protein: 0.2, slug: 'vinagre-de-jerez', source: 'bedca' },
  { carbs: 11, category: 'pantry', fat: 4, fiber: 1.5, kcal: 86, name: 'Tomate frito', protein: 1.5, slug: 'tomate-frito', source: 'bedca' },
  { carbs: 1.2, category: 'pantry', defaultUnit: 'ml', fat: 0.5, kcal: 13, name: 'Caldo de pollo', protein: 0.8, slug: 'caldo-de-pollo', source: 'bedca' },
  { carbs: 1.5, category: 'pantry', defaultUnit: 'ml', fat: 0.2, kcal: 10, name: 'Caldo de verduras', protein: 0.5, slug: 'caldo-de-verduras', source: 'bedca' },
  { allergens: [{ key: 'gluten', presence: 'may_contain' }], carbs: 84, category: 'pantry', fat: 0.9, fiber: 3, kcal: 372, name: 'Copos de maíz', protein: 7, slug: 'copos-de-maiz', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 66, category: 'pantry', fat: 6, fiber: 8, kcal: 358, name: 'Muesli', protein: 10, slug: 'muesli', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 44, category: 'pantry', fat: 10, fiber: 13, kcal: 358, name: 'Germen de trigo', protein: 23, slug: 'germen-de-trigo', source: 'usda' },
  { carbs: 28, category: 'pantry', defaultUnit: 'tsp', fat: 0, gramsPerUnit: 4, kcal: 112, name: 'Levadura química', protein: 0, slug: 'levadura-quimica', source: 'usda' },
  { carbs: 91, category: 'pantry', fat: 0.1, kcal: 366, name: 'Maicena', protein: 0.3, slug: 'maicena', source: 'usda' },
  { carbs: 25, category: 'pantry', fat: 0.3, fiber: 0.4, kcal: 113, name: 'Arroz basmati cocido', protein: 2.7, slug: 'arroz-basmati-cocido', source: 'usda' },
  { allergens: [{ key: 'soy' }, { key: 'gluten' }], carbs: 6, category: 'pantry', defaultUnit: 'tbsp', fat: 0.1, fiber: 0.8, gramsPerUnit: 15, kcal: 57, name: 'Salsa de soja', protein: 8, slug: 'salsa-de-soja', source: 'usda' },

  // ── Bakery ────────────────────────────────────────────────────────────
  { allergens: [{ key: 'gluten' }], carbs: 41.3, category: 'bakery', defaultUnit: 'slice', fat: 3.4, fiber: 7, gramsPerUnit: 40, kcal: 247, name: 'Pan integral', protein: 8.8, slug: 'pan-integral' },
  { allergens: [{ key: 'gluten' }], carbs: 49.4, category: 'bakery', defaultUnit: 'unit', fat: 3.1, fiber: 2.7, gramsPerUnit: 60, kcal: 265, name: 'Tortilla de trigo', protein: 8.2, slug: 'tortilla-de-trigo' },
  { allergens: [{ key: 'gluten' }], carbs: 50, category: 'bakery', defaultUnit: 'slice', fat: 1.2, fiber: 2.7, gramsPerUnit: 30, kcal: 247, name: 'Pan blanco', protein: 9, slug: 'pan-blanco', source: 'bedca' },
  { allergens: [{ key: 'gluten' }], carbs: 48, category: 'bakery', defaultUnit: 'slice', fat: 1.5, fiber: 5.8, gramsPerUnit: 35, kcal: 240, name: 'Pan de centeno', protein: 8.5, slug: 'pan-de-centeno', source: 'bedca' },
  { allergens: [{ key: 'gluten' }], carbs: 49, category: 'bakery', defaultUnit: 'slice', fat: 3.5, fiber: 2.5, gramsPerUnit: 25, kcal: 260, name: 'Pan de molde', protein: 8, slug: 'pan-de-molde', source: 'bedca' },
  { allergens: [{ key: 'gluten' }], carbs: 54, category: 'bakery', defaultUnit: 'unit', fat: 1.5, fiber: 2.3, gramsPerUnit: 90, kcal: 270, name: 'Bagel', protein: 10, slug: 'bagel', source: 'usda' },
  { carbs: 45, category: 'bakery', defaultUnit: 'unit', fat: 3.4, fiber: 3.4, gramsPerUnit: 25, kcal: 233, name: 'Tortitas de maíz', protein: 5.7, slug: 'tortitas-de-maiz', source: 'usda' },
  { carbs: 81, category: 'bakery', defaultUnit: 'unit', fat: 2.8, fiber: 2, gramsPerUnit: 9, kcal: 379, name: 'Tortitas de arroz', protein: 7.5, slug: 'tortitas-de-arroz', source: 'usda' },
  { allergens: [{ key: 'gluten' }], carbs: 73, category: 'bakery', defaultUnit: 'unit', fat: 7, fiber: 3.5, gramsPerUnit: 5, kcal: 399, name: 'Picos de pan', protein: 11, slug: 'picos-de-pan', source: 'bedca' },
  { allergens: [{ key: 'gluten' }], carbs: 48, category: 'bakery', defaultUnit: 'unit', fat: 5, fiber: 2.5, gramsPerUnit: 60, kcal: 273, name: 'Pan de hamburguesa', protein: 9, slug: 'pan-de-hamburguesa', source: 'bedca' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 45, category: 'bakery', defaultUnit: 'unit', fat: 21, fiber: 2, gramsPerUnit: 60, kcal: 401, name: 'Croissant', protein: 8, slug: 'croissant', source: 'bedca' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 54, category: 'bakery', defaultUnit: 'unit', fat: 15, fiber: 1.2, gramsPerUnit: 40, kcal: 375, name: 'Magdalena', protein: 6, slug: 'magdalena', source: 'bedca' },

  // ── Frozen ────────────────────────────────────────────────────────────
  { carbs: 12.8, category: 'frozen', fat: 0.4, fiber: 5.1, kcal: 77, name: 'Guisantes congelados', protein: 5.2, slug: 'guisantes-congelados' },
  { carbs: 4.2, category: 'frozen', fat: 0.3, fiber: 2.5, kcal: 30, name: 'Judía verde congelada', protein: 1.8, slug: 'judia-verde-congelada' },
  { carbs: 4, category: 'frozen', fat: 0.3, fiber: 3, kcal: 30, name: 'Brócoli congelado', protein: 2.8, slug: 'brocoli-congelado', source: 'usda' },
  { carbs: 3.2, category: 'frozen', fat: 0.5, fiber: 2.6, kcal: 25, name: 'Espinacas congeladas', protein: 2.6, slug: 'espinacas-congeladas', source: 'usda' },
  { carbs: 18, category: 'frozen', fat: 1, fiber: 2.4, kcal: 94, name: 'Maíz congelado', protein: 3.2, slug: 'maiz-congelado', source: 'usda' },
  { carbs: 9, category: 'frozen', fat: 0.4, fiber: 3, kcal: 50, name: 'Mix de verduras congelado', protein: 2.5, slug: 'mix-de-verduras-congelado', source: 'usda' },
  { carbs: 12, category: 'frozen', fat: 0.4, fiber: 4, kcal: 55, name: 'Frutos rojos congelados', protein: 0.8, slug: 'frutos-rojos-congelados', source: 'usda' },
  { allergens: [{ key: 'fish' }], carbs: 0, category: 'frozen', fat: 1, kcal: 77, name: 'Filete de merluza congelado', protein: 17, slug: 'filete-de-merluza-congelado', source: 'bedca' },

  // ── Beverages ─────────────────────────────────────────────────────────
  { allergens: [{ key: 'tree_nuts' }], carbs: 0.3, category: 'beverages', defaultUnit: 'ml', fat: 1.1, kcal: 13, name: 'Leche de almendra', protein: 0.5, slug: 'leche-de-almendra', source: 'usda' },
  { allergens: [{ key: 'gluten', presence: 'may_contain' }], carbs: 6.7, category: 'beverages', defaultUnit: 'ml', fat: 1.5, fiber: 0.8, kcal: 44, name: 'Leche de avena', protein: 1, slug: 'leche-de-avena', source: 'usda' },
  { allergens: [{ key: 'soy' }], carbs: 1.8, category: 'beverages', defaultUnit: 'ml', fat: 1.8, kcal: 37, name: 'Leche de soja', protein: 3.3, slug: 'leche-de-soja', source: 'usda' },
  { carbs: 0.4, category: 'beverages', defaultUnit: 'ml', fat: 0, kcal: 2, name: 'Café solo', protein: 0.2, slug: 'cafe-solo', source: 'bedca' },
  { carbs: 0.3, category: 'beverages', defaultUnit: 'ml', fat: 0, kcal: 2, name: 'Té verde', protein: 0.2, slug: 'te-verde', source: 'bedca' },

  // ── Other ─────────────────────────────────────────────────────────────
  { carbs: 82, category: 'other', defaultUnit: 'tbsp', fat: 0, gramsPerUnit: 21, kcal: 304, name: 'Miel', protein: 0.3, slug: 'miel', source: 'bedca' },
  { carbs: 100, category: 'other', defaultUnit: 'tsp', fat: 0, gramsPerUnit: 4.2, kcal: 400, name: 'Azúcar blanco', protein: 0, slug: 'azucar-blanco', source: 'usda' },
  { carbs: 76, category: 'other', defaultUnit: 'tbsp', fat: 0, gramsPerUnit: 21, kcal: 304, name: 'Sirope de agave', protein: 0, slug: 'sirope-de-agave', source: 'usda' },
  { carbs: 50, category: 'other', defaultUnit: 'tbsp', fat: 0.1, fiber: 0.6, gramsPerUnit: 20, kcal: 203, name: 'Mermelada de fresa', protein: 0.4, slug: 'mermelada-de-fresa', source: 'usda' },
  { carbs: 11, category: 'other', defaultUnit: 'tbsp', fat: 14, fiber: 9, gramsPerUnit: 5, kcal: 250, name: 'Cacao en polvo puro', protein: 20, slug: 'cacao-en-polvo-puro', source: 'usda' },
  { allergens: [{ key: 'milk', presence: 'may_contain' }, { key: 'tree_nuts', presence: 'may_contain' }], carbs: 35, category: 'other', fat: 43, fiber: 11, kcal: 558, name: 'Chocolate negro 70%', protein: 7.8, slug: 'chocolate-negro-70', source: 'usda' },
  { carbs: 0.3, category: 'other', defaultUnit: 'tbsp', fat: 0, gramsPerUnit: 15, kcal: 1, name: 'Vinagre de vino tinto', protein: 0, slug: 'vinagre-de-vino-tinto', source: 'usda' },
  { carbs: 3, category: 'other', defaultUnit: 'unit', fat: 15, fiber: 2.5, gramsPerUnit: 4, kcal: 151, name: 'Aceitunas negras', protein: 1, slug: 'aceitunas-negras', source: 'bedca' },
  { carbs: 3.8, category: 'other', defaultUnit: 'unit', fat: 12.8, fiber: 3.3, gramsPerUnit: 4, kcal: 136, name: 'Aceitunas verdes', protein: 1.4, slug: 'aceitunas-verdes', source: 'bedca' },
  { carbs: 4.9, category: 'other', defaultUnit: 'tbsp', fat: 0.9, fiber: 3.2, gramsPerUnit: 9, kcal: 37, name: 'Alcaparras', protein: 2.4, slug: 'alcaparras', source: 'bedca' },
  { carbs: 2.3, category: 'other', defaultUnit: 'unit', fat: 0.2, fiber: 1.2, gramsPerUnit: 15, kcal: 12, name: 'Pepinillos en vinagre', protein: 0.3, slug: 'pepinillos-en-vinagre', source: 'bedca' },
  { carbs: 26, category: 'other', defaultUnit: 'tbsp', fat: 0.2, fiber: 0.4, gramsPerUnit: 17, kcal: 111, name: 'Kétchup', protein: 1.2, slug: 'ketchup', source: 'usda' },
  { allergens: [{ key: 'eggs' }], carbs: 1, category: 'other', defaultUnit: 'tbsp', fat: 75, gramsPerUnit: 14, kcal: 683, name: 'Mayonesa', protein: 1, slug: 'mayonesa', source: 'bedca' },
  { allergens: [{ key: 'mustard' }], carbs: 8, category: 'other', defaultUnit: 'tsp', fat: 3.3, fiber: 3, gramsPerUnit: 5, kcal: 79, name: 'Mostaza amarilla', protein: 4.4, slug: 'mostaza-amarilla', source: 'bedca' },
  { allergens: [{ key: 'eggs' }], carbs: 2, category: 'other', defaultUnit: 'tbsp', fat: 45, gramsPerUnit: 14, kcal: 418, name: 'Salsa alioli', protein: 1.2, slug: 'salsa-alioli', source: 'bedca' },
  { allergens: [{ key: 'tree_nuts' }, { key: 'milk' }], carbs: 4.5, category: 'other', defaultUnit: 'tbsp', fat: 40, fiber: 1.5, gramsPerUnit: 16, kcal: 392, name: 'Pesto genovese', protein: 3.5, slug: 'pesto-genovese', source: 'usda' },
  { allergens: [{ key: 'sesame' }], carbs: 14, category: 'other', defaultUnit: 'tbsp', fat: 9.6, fiber: 6, gramsPerUnit: 15, kcal: 174, name: 'Hummus', protein: 7.9, slug: 'hummus', source: 'usda' },
  { carbs: 6, category: 'other', fat: 14, fiber: 5, kcal: 157, name: 'Guacamole', protein: 1.8, slug: 'guacamole', source: 'usda' },
  { carbs: 2, category: 'other', defaultUnit: 'tsp', fat: 0.4, fiber: 0.5, gramsPerUnit: 5, kcal: 15, name: 'Salsa picante tipo tabasco', protein: 0.9, slug: 'salsa-picante-tabasco', source: 'usda' },
  { carbs: 30, category: 'other', defaultUnit: 'tbsp', fat: 0.4, fiber: 0.5, gramsPerUnit: 17, kcal: 128, name: 'Salsa barbacoa', protein: 1, slug: 'salsa-barbacoa', source: 'usda' },
  { carbs: 18, category: 'other', defaultUnit: 'tsp', fat: 0.9, fiber: 1, gramsPerUnit: 6, kcal: 85, name: 'Salsa sriracha', protein: 1.3, slug: 'salsa-sriracha', source: 'usda' },
  { carbs: 58, category: 'other', defaultUnit: 'tsp', fat: 14, fiber: 33, gramsPerUnit: 2, kcal: 410, name: 'Curry en polvo', protein: 13, slug: 'curry-en-polvo', source: 'usda' },
  { carbs: 54, category: 'other', defaultUnit: 'tsp', fat: 13, fiber: 35, gramsPerUnit: 2, kcal: 389, name: 'Pimentón dulce', protein: 14, slug: 'pimenton-dulce', source: 'bedca' },
  { carbs: 44, category: 'other', defaultUnit: 'tsp', fat: 22, fiber: 11, gramsPerUnit: 2, kcal: 446, name: 'Comino molido', protein: 18, slug: 'comino-molido', source: 'usda' },
  { carbs: 69, category: 'other', defaultUnit: 'tsp', fat: 4.3, fiber: 43, gramsPerUnit: 1, kcal: 359, name: 'Orégano seco', protein: 11, slug: 'oregano-seco', source: 'usda' },
  { carbs: 81, category: 'other', defaultUnit: 'tsp', fat: 1.2, fiber: 53, gramsPerUnit: 2.5, kcal: 351, name: 'Canela molida', protein: 4, slug: 'canela-molida', source: 'usda' },
  { carbs: 49, category: 'other', defaultUnit: 'tsp', fat: 36, fiber: 21, gramsPerUnit: 2, kcal: 544, name: 'Nuez moscada', protein: 6, slug: 'nuez-moscada', source: 'usda' },
  { carbs: 71, category: 'other', defaultUnit: 'tsp', fat: 4.2, fiber: 14, gramsPerUnit: 2, kcal: 358, name: 'Jengibre en polvo', protein: 9, slug: 'jengibre-en-polvo', source: 'usda' },
  { carbs: 65, category: 'other', defaultUnit: 'tsp', fat: 10, fiber: 21, gramsPerUnit: 3, kcal: 382, name: 'Cúrcuma molida', protein: 8, slug: 'curcuma-molida', source: 'usda' },
  { carbs: 75, category: 'other', defaultUnit: 'unit', fat: 8.4, fiber: 26, gramsPerUnit: 0.2, kcal: 406, name: 'Laurel', protein: 7.6, slug: 'laurel', source: 'usda' },
  { carbs: 0, category: 'other', defaultUnit: 'pinch', fat: 0, gramsPerUnit: 0.5, kcal: 0, name: 'Sal', protein: 0, slug: 'sal', source: 'usda' },
  { carbs: 36, category: 'other', defaultUnit: 'tbsp', fat: 8, fiber: 20, gramsPerUnit: 5, kcal: 416, name: 'Levadura nutricional', protein: 50, slug: 'levadura-nutricional', source: 'usda' },
  { carbs: 2, category: 'other', fat: 0.1, kcal: 349, name: 'Gelatina neutra', protein: 85, slug: 'gelatina-neutra', source: 'usda' },
  { carbs: 13, category: 'other', defaultUnit: 'tsp', fat: 0.1, gramsPerUnit: 4.2, kcal: 53, name: 'Extracto de vainilla', protein: 0.1, slug: 'extracto-de-vainilla', source: 'usda' },
  { carbs: 24, category: 'other', fat: 65, fiber: 16, kcal: 709, name: 'Coco rallado', protein: 6.9, slug: 'coco-rallado', source: 'usda' }
];

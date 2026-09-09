import type { IngredientSeed } from './types';

/**
 * Breads, flatbreads and pastries beyond the starter set. Wheat is `gluten`,
 * always; seeded and burger breads carry `sesame` as `may_contain`, because the
 * bakery counter does not label. Ensaimada is made with lard, so it is pork to
 * the substitution rule, which is the kind of thing a person keeping halal
 * would want a recipe app to know.
 */
export const BAKERY: readonly IngredientSeed[] = [
  // ── Bread ─────────────────────────────────────────────────────────────
  { allergens: [{ key: 'gluten' }], carbs: 52, category: 'bakery', defaultUnit: 'slice', fat: 1.5, fiber: 3, gramsPerUnit: 40, kcal: 265, name: 'Hogaza de pan', protein: 9, slug: 'hogaza-de-pan' },
  { allergens: [{ key: 'gluten' }], carbs: 54, category: 'bakery', fat: 1.5, fiber: 2.5, kcal: 270, name: 'Baguette', protein: 9, slug: 'baguette' },
  { allergens: [{ key: 'gluten' }], carbs: 52, category: 'bakery', fat: 1.8, fiber: 2.5, kcal: 265, name: 'Chapata', protein: 9, slug: 'chapata' },
  { allergens: [{ key: 'gluten' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 2.5, fiber: 2, gramsPerUnit: 80, kcal: 260, name: 'Mollete', protein: 8, slug: 'mollete' },
  { allergens: [{ key: 'gluten' }], carbs: 48, category: 'bakery', defaultUnit: 'slice', fat: 1.8, fiber: 5, gramsPerUnit: 35, kcal: 250, name: 'Pan de espelta', protein: 9, slug: 'pan-de-espelta' },
  { allergens: [{ key: 'gluten' }, { key: 'sesame', presence: 'may_contain' }, { key: 'tree_nuts', presence: 'may_contain' }], carbs: 44, category: 'bakery', defaultUnit: 'slice', fat: 7, fiber: 6, gramsPerUnit: 35, kcal: 280, name: 'Pan de semillas', protein: 10, slug: 'pan-de-semillas' },
  { allergens: [{ key: 'gluten' }], carbs: 50, category: 'bakery', defaultUnit: 'slice', fat: 1.5, fiber: 3, gramsPerUnit: 40, kcal: 260, name: 'Pan de masa madre', protein: 9, slug: 'pan-de-masa-madre' },
  { carbs: 48, category: 'bakery', defaultUnit: 'slice', fat: 5, fiber: 4, gramsPerUnit: 30, kcal: 250, name: 'Pan sin gluten', protein: 3, slug: 'pan-sin-gluten' },
  { allergens: [{ key: 'gluten' }], carbs: 55, category: 'bakery', defaultUnit: 'unit', fat: 1.2, fiber: 2.2, gramsPerUnit: 60, kcal: 275, name: 'Pan de pita', protein: 9, slug: 'pan-de-pita' },
  { allergens: [{ key: 'gluten' }, { key: 'milk', presence: 'may_contain' }, { key: 'eggs', presence: 'may_contain' }], carbs: 48, category: 'bakery', defaultUnit: 'unit', fat: 7, gramsPerUnit: 90, kcal: 290, name: 'Pan naan', protein: 8.5, slug: 'pan-naan' },
  { allergens: [{ key: 'gluten' }], carbs: 73, category: 'bakery', defaultUnit: 'unit', fat: 5, fiber: 4, gramsPerUnit: 9, kcal: 385, name: 'Pan tostado (biscotes)', protein: 11, slug: 'pan-tostado' },
  { allergens: [{ key: 'gluten' }], carbs: 66, category: 'bakery', defaultUnit: 'unit', fat: 1.5, fiber: 15, gramsPerUnit: 12, kcal: 330, name: 'Tostas de centeno', protein: 9, slug: 'tostas-de-centeno' },
  { allergens: [{ key: 'gluten' }, { key: 'sesame', presence: 'may_contain' }], carbs: 70, category: 'bakery', fat: 8, fiber: 3, kcal: 400, name: 'Regañás', protein: 10, slug: 'regana' },
  { carbs: 45, category: 'bakery', defaultUnit: 'unit', fat: 2.5, fiber: 5, gramsPerUnit: 30, kcal: 220, name: 'Tortilla de maíz', protein: 5.5, slug: 'tortilla-de-maiz' },
  { allergens: [{ key: 'gluten' }], carbs: 48, category: 'bakery', defaultUnit: 'unit', fat: 6, fiber: 5, gramsPerUnit: 60, kcal: 290, name: 'Wrap integral', protein: 9, slug: 'wrap-integral' },
  { allergens: [{ key: 'gluten' }, { key: 'milk', presence: 'may_contain' }, { key: 'sesame', presence: 'may_contain' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 5, gramsPerUnit: 60, kcal: 280, name: 'Pan de perrito', protein: 8.5, slug: 'pan-de-perrito' },
  { allergens: [{ key: 'gluten' }, { key: 'sesame', presence: 'may_contain' }], carbs: 44, category: 'bakery', defaultUnit: 'unit', fat: 4, fiber: 5, gramsPerUnit: 70, kcal: 250, name: 'Pan de hamburguesa integral', protein: 10, slug: 'pan-de-hamburguesa-integral' },
  { allergens: [{ key: 'gluten' }], carbs: 46, category: 'bakery', defaultUnit: 'unit', fat: 3.5, gramsPerUnit: 250, kcal: 250, name: 'Base de pizza fresca', protein: 8, slug: 'base-de-pizza-fresca' },
  // ── Enriched and sweet ────────────────────────────────────────────────
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 48, category: 'bakery', defaultUnit: 'slice', fat: 11, gramsPerUnit: 40, kcal: 330, name: 'Brioche', protein: 8, slug: 'brioche' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 52, category: 'bakery', defaultUnit: 'unit', fat: 8, gramsPerUnit: 35, kcal: 320, name: 'Pan de leche', protein: 8, slug: 'pan-de-leche' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }, { key: 'soy', presence: 'may_contain' }], carbs: 45, category: 'bakery', defaultUnit: 'unit', fat: 24, gramsPerUnit: 55, kcal: 420, name: 'Donut', protein: 5, slug: 'donut' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }, { key: 'soy', presence: 'may_contain' }], carbs: 46, category: 'bakery', defaultUnit: 'unit', fat: 24, gramsPerUnit: 90, kcal: 430, name: 'Napolitana de chocolate', protein: 7, slug: 'napolitana-de-chocolate' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk', presence: 'may_contain' }], carbs: 50, category: 'bakery', classes: ['pork'], defaultUnit: 'unit', fat: 19, gramsPerUnit: 60, kcal: 400, name: 'Ensaimada', protein: 6, slug: 'ensaimada' },
  { allergens: [{ key: 'gluten' }, { key: 'milk', presence: 'may_contain' }, { key: 'eggs', presence: 'may_contain' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 28, gramsPerUnit: 70, kcal: 470, name: 'Palmera de hojaldre', protein: 5, slug: 'palmera-de-hojaldre' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk' }], carbs: 50, category: 'bakery', defaultUnit: 'slice', fat: 17, gramsPerUnit: 60, kcal: 380, name: 'Bizcocho', protein: 6, slug: 'bizcocho' },
  { allergens: [{ key: 'gluten' }], carbs: 45, category: 'bakery', defaultUnit: 'unit', fat: 20, gramsPerUnit: 25, kcal: 380, name: 'Churros', protein: 5, slug: 'churros' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 30, category: 'bakery', defaultUnit: 'unit', fat: 9, gramsPerUnit: 40, kcal: 230, name: 'Tortitas americanas', protein: 6, slug: 'tortitas-americanas' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs' }], carbs: 37, category: 'bakery', defaultUnit: 'unit', fat: 13, gramsPerUnit: 60, kcal: 290, name: 'Gofre', protein: 7, slug: 'gofre' },
  // ── Second pass ───────────────────────────────────────────────────────
  { allergens: [{ key: 'gluten' }], carbs: 55, category: 'bakery', fat: 1.5, fiber: 2, kcal: 270, name: 'Pan de cristal', protein: 8, slug: 'pan-de-cristal' },
  { allergens: [{ key: 'gluten' }], carbs: 52, category: 'bakery', defaultUnit: 'unit', fat: 3, gramsPerUnit: 50, kcal: 280, name: 'Panecillos', protein: 9, slug: 'panecillos' },
  { allergens: [{ key: 'gluten' }, { key: 'milk', presence: 'may_contain' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 5, gramsPerUnit: 40, kcal: 280, name: 'Pan bao', protein: 8, slug: 'pan-bao' },
  { allergens: [{ key: 'gluten' }], carbs: 43, category: 'bakery', defaultUnit: 'slice', fat: 4, fiber: 6, gramsPerUnit: 30, kcal: 250, name: 'Pan de molde integral', protein: 9, slug: 'pan-de-molde-integral' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk', presence: 'may_contain' }], carbs: 60, category: 'bakery', defaultUnit: 'unit', fat: 17, gramsPerUnit: 30, kcal: 420, name: 'Rosquillas', protein: 6, slug: 'rosquillas' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 27, gramsPerUnit: 40, kcal: 470, name: 'Sobaos', protein: 6, slug: 'sobaos' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk' }, { key: 'soy', presence: 'may_contain' }], carbs: 62, category: 'bakery', defaultUnit: 'unit', fat: 24, gramsPerUnit: 25, kcal: 490, name: 'Cookies de chocolate', protein: 5, slug: 'cookies-de-chocolate' },
  { allergens: [{ key: 'gluten' }, { key: 'eggs' }, { key: 'milk' }, { key: 'tree_nuts', presence: 'may_contain' }], carbs: 50, category: 'bakery', defaultUnit: 'unit', fat: 25, gramsPerUnit: 60, kcal: 450, name: 'Brownie', protein: 6, slug: 'brownie' },
  { allergens: [{ key: 'milk' }, { key: 'lactose' }, { key: 'eggs' }, { key: 'gluten' }], carbs: 28, category: 'bakery', defaultUnit: 'slice', fat: 21, gramsPerUnit: 100, kcal: 320, name: 'Tarta de queso', protein: 6, slug: 'tarta-de-queso' },
  { allergens: [{ key: 'gluten' }, { key: 'milk' }, { key: 'eggs', presence: 'may_contain' }], carbs: 35, category: 'bakery', defaultUnit: 'slice', fat: 11, gramsPerUnit: 100, kcal: 250, name: 'Tarta de manzana', protein: 3, slug: 'tarta-de-manzana' }
];

export const BAKERY_NAMES_EN_GB: Record<string, string> = {
  baguette: 'Baguette',
  'base-de-pizza-fresca': 'Fresh pizza base',
  bizcocho: 'Sponge cake',
  brioche: 'Brioche',
  brownie: 'Brownie',
  chapata: 'Ciabatta',
  churros: 'Churros',
  'cookies-de-chocolate': 'Chocolate chip cookies',
  donut: 'Doughnut',
  ensaimada: 'Ensaimada',
  gofre: 'Waffle',
  'hogaza-de-pan': 'Country loaf',
  mollete: 'Mollete roll',
  'napolitana-de-chocolate': 'Chocolate pastry',
  'palmera-de-hojaldre': 'Palmier',
  'pan-bao': 'Bao buns',
  'pan-de-cristal': 'Glass bread (pan de cristal)',
  'pan-de-espelta': 'Spelt bread',
  'pan-de-hamburguesa-integral': 'Wholemeal burger bun',
  'pan-de-leche': 'Milk roll',
  'pan-de-masa-madre': 'Sourdough bread',
  'pan-de-molde-integral': 'Wholemeal sliced bread',
  'pan-de-perrito': 'Hot dog bun',
  'pan-de-pita': 'Pitta bread',
  'pan-de-semillas': 'Seeded bread',
  'pan-naan': 'Naan bread',
  'pan-sin-gluten': 'Gluten-free bread',
  'pan-tostado': 'Toasted bread (rusks)',
  panecillos: 'Bread rolls',
  regana: 'Regañás crackers',
  rosquillas: 'Ring doughnuts (rosquillas)',
  sobaos: 'Sobaos sponge cakes',
  'tarta-de-manzana': 'Apple tart',
  'tarta-de-queso': 'Cheesecake',
  'tortilla-de-maiz': 'Corn tortilla',
  'tortitas-americanas': 'American pancakes',
  'tostas-de-centeno': 'Rye crispbread',
  'wrap-integral': 'Wholemeal wrap'
};

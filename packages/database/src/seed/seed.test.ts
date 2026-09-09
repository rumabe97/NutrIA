import { describe, expect, it } from 'vitest';

import { ALLERGEN_SEED } from './allergens';
import { INGREDIENT_NAMES_EN_GB } from './ingredient-names';
import { INGREDIENT_SEED } from './ingredients';
import { foodClasses } from './ingredients/classes';

import type { AllergenKey } from './allergens';
import type { FoodClass } from './ingredients';
import { SUBSTITUTION_EXTRAS, SUBSTITUTION_GROUPS, substitutionPairs } from './substitutions';

const ALLERGEN_KEYS = new Set(ALLERGEN_SEED.map(a => a.key));

/** Wide enough to clear the honest table-vs-model spread, tight enough to catch a decimal slip. */
const RATIO_BAND = { max: 1.6, min: 0.6 } as const;

/** Below this the ratio is noise — a 5 kcal herb swings wildly on a rounding difference. */
const ESTIMATE_FLOOR_KCAL = 15;

describe('INGREDIENT_SEED', () => {
  it('references only allergen keys that exist in ALLERGEN_SEED', () => {
    for (const ingredient of INGREDIENT_SEED) {
      for (const link of ingredient.allergens ?? []) {
        expect(ALLERGEN_KEYS.has(link.key), `"${ingredient.slug}" references unknown allergen key "${link.key}"`).toBe(true);
      }
    }
  });

  it('has no duplicate slugs', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const ingredient of INGREDIENT_SEED) {
      if (seen.has(ingredient.slug)) {
        duplicates.push(ingredient.slug);
      }

      seen.add(ingredient.slug);
    }

    expect(duplicates).toEqual([]);
  });

  it('has only non-negative macros', () => {
    for (const ingredient of INGREDIENT_SEED) {
      expect(ingredient.carbs, `"${ingredient.slug}" carbs`).toBeGreaterThanOrEqual(0);
      expect(ingredient.fat, `"${ingredient.slug}" fat`).toBeGreaterThanOrEqual(0);
      expect(ingredient.kcal, `"${ingredient.slug}" kcal`).toBeGreaterThanOrEqual(0);
      expect(ingredient.protein, `"${ingredient.slug}" protein`).toBeGreaterThanOrEqual(0);

      if (ingredient.fiber !== undefined) {
        expect(ingredient.fiber, `"${ingredient.slug}" fiber`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // A sanity band, not a physics check.
  //
  // Its job is to catch transcription errors — a misplaced decimal, a figure
  // copied from the wrong row — which are off by 2x or 10x, not by 30%. Real
  // composition tables disagree with an Atwater estimate by considerably more
  // than 30% for legitimate reasons: they differ on whether carbohydrate is
  // reported total or available, fibre is only partly metabolised, and spices and
  // some vegetables sit well outside the model. Measured across this catalogue
  // the honest spread is [0.84, 1.43].
  //
  // A tighter band would not find more typos; it would push the data away from
  // its sources to satisfy the formula, which is the opposite of the point.
  // Entries below the floor are skipped: for a 5 kcal herb the ratio is noise.
  it('has a kcal in a sane ratio to its macros for every entry', () => {
    for (const ingredient of INGREDIENT_SEED) {
      const fiber = ingredient.fiber ?? 0;
      const availableCarbs = Math.max(ingredient.carbs - fiber, 0);
      const estimate = 4 * ingredient.protein + 4 * availableCarbs + 9 * ingredient.fat + 2 * fiber;

      if (estimate < ESTIMATE_FLOOR_KCAL) {continue;}

      const ratio = ingredient.kcal / estimate;

      expect(
        ratio,
        `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)}) — check for a transcription error`
      ).toBeGreaterThanOrEqual(RATIO_BAND.min);
      expect(ratio, `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)})`).toBeLessThanOrEqual(
        RATIO_BAND.max
      );
    }
  });
});

/**
 * The catalogue is bilingual, and a gap in either direction is a bug someone
 * only finds by reading their shopping list in the wrong language.
 */
/**
 * A name that says what it is must carry the allergen it names.
 *
 * The row is the source of truth, not the name — but a row called "queso" with
 * no `milk`, or "gambas" with no `crustaceans`, is a typo in the one field a
 * person with an allergy is trusting, and the macro checks above would never
 * see it. Either presence counts: oats say `gluten` as `may_contain`, and that
 * is the right answer. `unless` carves out the names that contain the word and
 * not the thing — coconut milk, buckwheat flour, nutmeg, vegan cheese.
 */
const NAME_IMPLIES: readonly { readonly key: AllergenKey; readonly pattern: RegExp; readonly unless?: RegExp }[] = [
  {
    key: 'milk',
    pattern: /queso|leche|nata|mantequilla|yogur|kéfir|requesón|ricotta|mascarpone|burrata|mozzarella|cuajada|natillas|flan|helado|batido|skyr|ghee|tzatziki|tiramisú|crema catalana/iu,
    unless: /vegetal|vegano|de coco|de soja|de avena|de almendra|de arroz|de anacardos|de avellanas|de cacahuete|de pistacho|sorbete|leche de coco|cabello/iu
  },
  {
    key: 'gluten',
    pattern: /trigo|\bpan\b|pasta|espaguetis|macarrones|harina|cuscús|bulgur|seitán|cebada|centeno|espelta|galletas|croissant|bizcocho|magdalena|pizza|noodles|fideos|empanad|croquetas|rebozad|a la romana|panko|sémola|freekeh|tortellini|raviolis|ñoquis|lasaña|canelones|cerveza|muesli|granola|salvado|avena|tortilla de trigo|wrap|brioche|donut|napolitana|ensaimada|palmera|churros|gofre|tortitas americanas|pretzels|crackers|regañás|picos|biscotes|tostas|baguette|chapata|mollete|hogaza|panecillos|bao|\bpita\b|naan|bagel|sobaos|rosquillas|cookies|brownie|tarta|polvorón|ramen|san jacobos|flamenquines|nuggets|palitos de merluza|salmorejo|sopa de fideos|quiche|hojaldre|masa quebrada|filo|obleas|tempura|gluten de trigo/iu,
    unless: /sin gluten|de arroz|de maíz|de garbanzo|trigo sarraceno|de coco|de almendra|fécula|tapioca|de cristal|papel de arroz|pasta de curry|pasta de anchoas|pasta de tamarindo|en pasta|de lentejas|de garbanzos|pan de higo|algarroba|tortilla de maíz|tortitas de arroz|tortitas de maíz|nachos|vegetales$|salsa de tomate|santiago/iu
  },
  { key: 'eggs', pattern: /huevo|mayonesa|alioli|tortilla de patatas|natillas|flan|tártara|césar|codorniz/iu, unless: /^codorniz$/iu },
  {
    key: 'fish',
    pattern: /atún|bonito|salmón|sardina|merluza|bacalao|dorada|lubina|trucha|caballa|anchoa|boquerones|jurel|pescad|\brape\b|\bmero\b|rodaballo|lenguado|\bgallo\b|rosada|tilapia|perca|corvina|besugo|abadejo|fletán|\braya\b|congrio|bacaladilla|salmonete|palometa|melva|mojama|surimi|gulas|huevas|dashi|worcestershire|pez espada|panga|ensaladilla/iu,
    unless: /pico de gallo/iu
  },
  { key: 'crustaceans', pattern: /gamba|langostino|gambón|cigala|cangrejo|bogavante|centollo|marisco/iu },
  { key: 'molluscs', pattern: /mejill|almeja|calamar|sepia|chipir|pulpo|berberecho|navaja|vieira|zamburi|ostra|caracol|marisco/iu, unless: /seta de ostra/iu },
  { key: 'soy', pattern: /soja|tofu|tempeh|edamame|miso|heura|\btamari\b|teriyaki|hoisin|gochujang|ponzu|satay|ramen/iu },
  {
    key: 'tree_nuts',
    pattern: /almendra|avellana|nuez|nueces|anacardo|pistacho|\bpiñon|macadamia|brasil|pecana|turrón|mazapán|pesto|santiago|frutos secos/iu,
    unless: /nuez moscada/iu
  },
  { key: 'peanuts', pattern: /cacahuete|satay/iu, unless: /calabaza/iu },
  { key: 'sesame', pattern: /sésamo|tahini|hummus|baba ganoush/iu },
  { key: 'mustard', pattern: /mostaza/iu },
  { key: 'celery', pattern: /\bapio\b|apionabo/iu },
  { key: 'lupin', pattern: /altramu/iu },
  { key: 'sulphites', pattern: /\bvino\b|orejones/iu, unless: /vinagre/iu }
];

describe('allergen links', () => {
  it('are never missing on a row whose name says what it contains', () => {
    const missing: string[] = [];

    for (const ingredient of INGREDIENT_SEED) {
      const keys = new Set((ingredient.allergens ?? []).map(link => link.key));

      for (const rule of NAME_IMPLIES) {
        if (!rule.pattern.test(ingredient.name)) {continue;}

        if (rule.unless?.test(ingredient.name)) {continue;}

        if (!keys.has(rule.key)) {missing.push(`${ingredient.slug} ("${ingredient.name}") lacks ${rule.key}`);}
      }
    }

    expect(missing).toEqual([]);
  });
});

describe('INGREDIENT_NAMES_EN_GB', () => {
  it('translates every seeded ingredient', () => {
    const missing = INGREDIENT_SEED.filter(ingredient => INGREDIENT_NAMES_EN_GB[ingredient.slug] === undefined).map(ingredient => ingredient.slug);

    expect(missing).toEqual([]);
  });

  it('translates nothing that is not seeded', () => {
    // An orphan entry is a slug that was renamed, and the rename left a
    // translation behind that now silently applies to nothing.
    const slugs = new Set(INGREDIENT_SEED.map(ingredient => ingredient.slug));

    expect(Object.keys(INGREDIENT_NAMES_EN_GB).filter(slug => !slugs.has(slug))).toEqual([]);
  });

  it('has no blank name', () => {
    expect(Object.entries(INGREDIENT_NAMES_EN_GB).filter(([, name]) => name.trim() === '')).toEqual([]);
  });

  it('does not leave a name untranslated', () => {
    // Not a spell check — plenty of names are genuinely the same in both (Kiwi,
    // Tempeh, Hummus, Pak choi, Skyr, Ricotta). This catches the copy-paste that
    // leaves a whole Spanish phrase sitting in the English column: an identical
    // name is a problem when it reads as Spanish — an accent, a Spanish
    // connective, or a Spanish kitchen word.
    const readsAsSpanish = /[áéíóúñü]|\b(?:al|con|de|del|en|para|y)\b|cocid|congelad|fresc|picad|rallad|salsa|queso/iu;
    const identical = INGREDIENT_SEED.filter(ingredient => INGREDIENT_NAMES_EN_GB[ingredient.slug] === ingredient.name)
      .filter(ingredient => readsAsSpanish.test(ingredient.name))
      .map(ingredient => ingredient.slug);

    expect(identical).toEqual([]);
  });
});

describe('SUBSTITUTION_GROUPS and SUBSTITUTION_EXTRAS', () => {
  const slugs = new Set(INGREDIENT_SEED.map(entry => entry.slug));
  const pairs = substitutionPairs();

  it('name only seeded ingredients, so every alternative has macros and allergen links', () => {
    for (const group of SUBSTITUTION_GROUPS) {
      for (const member of group.members) {expect(slugs.has(member), `${group.name}: ${member}`).toBe(true);}
    }

    for (const extra of SUBSTITUTION_EXTRAS) {
      expect(slugs.has(extra.from), extra.from).toBe(true);
      expect(slugs.has(extra.to), extra.to).toBe(true);
    }
  });

  it('never offer an ingredient as its own alternative, and never the same pair twice', () => {
    const keys = pairs.map(pair => `${pair.ingredient}→${pair.substitute}`);

    expect(pairs.every(pair => pair.ingredient !== pair.substitute)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('scale by a ratio a cook could follow', () => {
    for (const pair of pairs) {
      expect(pair.ratio, `${pair.ingredient} → ${pair.substitute}`).toBeGreaterThanOrEqual(0.25);
      expect(pair.ratio, `${pair.ingredient} → ${pair.substitute}`).toBeLessThanOrEqual(4);
    }
  });

  /**
   * The rule that keeps a vegetarian, pescatarian or halal plan intact without the
   * code knowing the person's pattern: a swap may leave a class of food, never
   * enter one. Dietary patterns are enforced only in the prompt, so this is the
   * one place a substitute could otherwise undo them. The classes come from the
   * rows themselves — `foodClasses` — so a new pork cut or a new fish is covered
   * the moment it is seeded, not when someone remembers to extend a list here.
   */
  it('never introduce a class of food the dish did not already have', () => {
    const classesOf = new Map(INGREDIENT_SEED.map(entry => [entry.slug, foodClasses(entry)]));

    for (const pair of pairs) {
      const from = classesOf.get(pair.ingredient) ?? new Set<FoodClass>();
      const to = classesOf.get(pair.substitute) ?? new Set<FoodClass>();

      for (const cls of to) {
        expect(from.has(cls), `${pair.ingredient} → ${pair.substitute} introduces ${cls}`).toBe(true);
      }
    }
  });
});


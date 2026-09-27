/**
 * The words a dish's picture is drawn from (`0066`).
 *
 * Prompt v1 of the 2026-09-27 pilot, which the owner scored above v2 at the
 * size the app shows it. Built from the recipe alone: its name, and each
 * ingredient's name and grams. Nothing about a person — who opened the dish,
 * their profile, their allergies — has a field here to arrive through, and the
 * picture is stored once and shown to everyone who eats the dish.
 */

/** Bump when the words change: a stored picture records the version that drew it. */
export const PICTURE_PROMPT_VERSION = '2.0.0';

/** One ingredient as the prompt sees it: `name` is the English one when the catalogue has it. */
export type PictureRecipeIngredient = { readonly grams: number; readonly name: string; readonly slug: string };

/** What the prompt is built from, and all of it. */
export type PictureRecipe = { readonly ingredients: readonly PictureRecipeIngredient[]; readonly name: string };

/**
 * Used in cooking and not seen as a food of its own — oil, salt, spices, stock,
 * vinegar, wine, sugar, flour, protein powder: never named as visible, or the
 * model draws a heap of salt beside the plate.
 */
const INVISIBLE =
  /^(aceite-|sal$|sal-|pimienta-|pimenton-|comino|curcuma|canela-molida|cardamomo|curry-en-polvo|garam|ras-el-hanout|jengibre-en-polvo|nuez-moscada|[a-z]+-seco$|laurel|azafran|ajo-en-polvo|cilantro-molido|caldo-|vinagre-|vino-|agua$|levadura-|extracto-|zumo-de-|salsa-de-soja|tamari|salsa-de-pescado|salsa-de-ostras|azucar-|harina-|guindilla|zaatar|sazonador|pasta-de-curry|concentrado-|proteina|edulcorante|bicarbonato)/;

/** Seasonings that may show a little: named as cooked in, never as a portion. */
const AROMATIC =
  /^(ajo|ajos-tiernos|perejil|cilantro|eneldo|albahaca|hierbabuena|menta|jengibre|limon|lima|cebollino|romero|tomillo|chile|guindilla)/;

/** An aromatic this heavy is a food on the plate, not a seasoning. */
const AROMATIC_MAX_GRAMS = 15;

/** Liquids the dish is cooked in: part of the dish, never a glass beside it. */
const LIQUID = /^(leche-|bebida-de-|leche$)/;

/** Dishes served blended, which the model otherwise draws as whole pieces. */
const BLENDED = /\b(crema de|pur[ée]|batido|vichyssoise|sopa cremosa|hummus|smoothie)\b/i;

/** A main is one the eye must find: the heaviest visible food, and any with this share of what is seen. */
const MAIN_SHARE = 0.15;

/** How a recipe's ingredients show on the plate. */
export type PictureParts = {
  readonly aromatic: readonly PictureRecipeIngredient[];
  readonly invisible: readonly PictureRecipeIngredient[];
  readonly liquid: readonly PictureRecipeIngredient[];
  /** The visible foods the picture must show: the heaviest, and every one above `MAIN_SHARE`. */
  readonly mains: readonly PictureRecipeIngredient[];
  /** Grams of everything visible, never zero. */
  readonly total: number;
  /** Heaviest first. */
  readonly visible: readonly PictureRecipeIngredient[];
};

export function pictureParts(recipe: PictureRecipe): PictureParts {
  const invisible = recipe.ingredients.filter(ingredient => INVISIBLE.test(ingredient.slug));
  const rest = recipe.ingredients.filter(ingredient => !INVISIBLE.test(ingredient.slug));
  const aromatic = rest.filter(ingredient => AROMATIC.test(ingredient.slug) && ingredient.grams < AROMATIC_MAX_GRAMS);
  const liquid = rest.filter(ingredient => LIQUID.test(ingredient.slug));
  const visible = rest.filter(ingredient => !aromatic.includes(ingredient) && !liquid.includes(ingredient)).sort((a, b) => b.grams - a.grams);
  const total = visible.reduce((sum, ingredient) => sum + ingredient.grams, 0) || 1;
  const mains = visible.filter((ingredient, at) => at === 0 || ingredient.grams / total >= MAIN_SHARE);

  return { aromatic, invisible, liquid, mains, total, visible };
}

/** A food's share of the plate, in words a model draws better than a percentage. */
function share(grams: number, total: number): string {
  const part = grams / total;

  if (part >= 0.4) {
    return 'most of the plate';
  }

  if (part >= 0.2) {
    return 'a generous portion';
  }

  return part >= 0.08 ? 'a portion' : 'a small amount';
}

function names(ingredients: readonly PictureRecipeIngredient[]): string {
  return ingredients.map(ingredient => ingredient.name.toLowerCase()).join(', ');
}

/** The prompt for one dish's picture, prompt v1 word for word. */
export function buildPicturePrompt(recipe: PictureRecipe): string {
  const { aromatic, invisible, liquid, total, visible } = pictureParts(recipe);
  const foods = visible.map(ingredient => `${ingredient.name.toLowerCase()} (${share(ingredient.grams, total)})`);

  return [
    `A realistic photograph of one serving of a home-cooked dish, "${recipe.name}" (Spanish name).`,
    BLENDED.test(recipe.name) ? 'It is served blended: a smooth, creamy dish in a bowl, with any whole pieces resting on top.' : '',
    `The only foods in the dish, from most to least: ${foods.join('; ')}.`,
    liquid.length > 0 ? `It is cooked with ${names(liquid)}, which is part of the dish, not a separate glass.` : '',
    'Show each food as it looks in this dish once cooked (mixed, stewed, layered or set, as the dish name says), not as separate raw items.',
    aromatic.length > 0 ? `${names(aromatic)} only as seasoning cooked into the dish.` : '',
    invisible.length > 0 ? `Seasonings such as ${names(invisible.slice(0, 4))} are used in cooking and are not shown as separate items.` : '',
    'Nothing else is on the plate or on the table: no extra garnish, no side dishes, no other bowls or ingredients around it.',
    'One plate or bowl, centred, with generous empty table around it on every side, seen from a 45-degree angle, on a plain wooden or linen table.',
    'Natural window light, sharp focus across the whole dish, everything in focus, no bokeh, no blur.',
    'Real food with natural texture, as cooked at home, not a 3D render, not glossy or plastic.',
    'No text, no labels, no logos, no people, no hands; at most one fork.'
  ]
    .filter(line => line !== '')
    .join(' ');
}

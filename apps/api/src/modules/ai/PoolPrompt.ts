import { SNACK_SLOTS } from 'core/entities/Plan';

import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

/** Bumped whenever the wording changes, and recorded in `generation_metadata`. */
export const PROMPT_VERSION = '1.0.0';

/** Share of the day each slot carries; mirrors the scheduler's own weights. */
const SLOT_SHARE: Record<MealSlot, number> = {
  afternoon_snack: 0.09,
  breakfast: 0.25,
  dinner: 0.3,
  lunch: 0.33,
  morning_snack: 0.08,
  supper: 0.1
};

export type PromptContext = {
  readonly budget: string | null;
  readonly cookingTimeMinutes: number | null;
  readonly cuisines: readonly string[];
  readonly dietaryPatterns: readonly string[];
  readonly dislikedLabels: readonly string[];
  readonly excludeSlugs: readonly string[];
  readonly likedLabels: readonly string[];
  readonly needBySlot: ReadonlyMap<MealSlot, number>;
  readonly targets: NutritionTargets;
};

const SLOT_LABEL: Record<MealSlot, string> = {
  afternoon_snack: 'merienda',
  breakfast: 'desayuno',
  dinner: 'cena',
  lunch: 'comida',
  morning_snack: 'almuerzo (tentempié de media mañana)',
  supper: 'recena'
};

export const POOL_SYSTEM_PROMPT = [
  'Eres un cocinero que diseña platos para planes de alimentación personalizados en España.',
  'Devuelves únicamente platos compuestos con los ingredientes del catálogo que se te da.',
  'Nunca inventas un ingrediente ni un slug: si algo no está en la lista, no existe.',
  'Nunca indicas calorías ni macronutrientes: esos los calcula el sistema a partir del catálogo.',
  'Los platos deben ser realistas, cocinables y variados entre sí.'
].join(' ');

/**
 * The request, built from **structured, minimal context**.
 *
 * Two things it deliberately does not contain: any identifying information about the
 * person (no name, email, birth date or weight — the model needs targets, not a
 * patient), and any mention of the user's allergens. Restrictions are enforced by
 * *removing unsafe ingredients from the catalogue listing below*, so the model
 * cannot choose what it was never offered. The prompt is the second line of
 * defence; the gate in `PoolBuilder` is the first.
 */
export function buildPoolPrompt(context: PromptContext, safeIngredients: readonly CatalogueIngredient[]): string {
  const active = [...context.needBySlot.keys()];
  const totalShare = active.reduce((sum, slot) => sum + SLOT_SHARE[slot], 0) || 1;

  // Per-slot targets, not just a daily figure. A model told only "2000 kcal, 120 g
  // de proteína" produces dishes that hit the calories and miss the protein, and
  // no amount of portion scaling can fix a dish's composition afterwards.
  const needs = [...context.needBySlot.entries()]
    .filter(([, count]) => count > 0)
    .map(([slot, count]) => {
      const share = SLOT_SHARE[slot] / totalShare;
      const kcal = Math.round(context.targets.kcal * share);
      const protein = Math.round(context.targets.proteinG * share);
      const shape = SNACK_SLOTS.includes(slot) ? ' — tentempié: 1-3 ingredientes, sin cocinar, sin pasos' : '';

      return `- ${SLOT_LABEL[slot]}: ${count} platos distintos de ~${kcal} kcal y ~${protein} g de proteína por ración${shape}`;
    })
    .join('\n');

  const catalogue = safeIngredients.map(ingredient => `${ingredient.slug} (${ingredient.name})`).join(', ');

  return [
    'Diseña platos para un plan de alimentación de 14 días.',
    '',
    'OBJETIVOS DIARIOS DEL USUARIO (para calibrar el tamaño de los platos, no los indiques en la respuesta):',
    `- ${Math.round(context.targets.kcal)} kcal, ${Math.round(context.targets.proteinG)} g de proteína al día`,
    '',
    'IMPORTANTE: cada plato principal debe llevar una fuente de proteína (carne, pescado, huevo, lácteo o legumbre).',
    'Un plan que solo cumple las calorías pero se queda corto de proteína se descarta entero.',
    '',
    'PLATOS NECESARIOS:',
    needs,
    '',
    context.dietaryPatterns.length > 0 ? `ALIMENTACIÓN: ${context.dietaryPatterns.join(', ')}` : 'ALIMENTACIÓN: sin restricción declarada',
    context.cookingTimeMinutes ? `TIEMPO MÁXIMO POR PLATO: ${context.cookingTimeMinutes} minutos (preparación + cocción)` : '',
    context.budget ? `PRESUPUESTO: ${context.budget}` : '',
    context.cuisines.length > 0 ? `COCINAS PREFERIDAS: ${context.cuisines.join(', ')}` : '',
    context.likedLabels.length > 0 ? `LE GUSTA: ${context.likedLabels.join(', ')}` : '',
    context.dislikedLabels.length > 0 ? `NO QUIERE: ${context.dislikedLabels.join(', ')}` : '',
    context.excludeSlugs.length > 0 ? `NO REPITAS ESTOS PLATOS YA PROPUESTOS: ${context.excludeSlugs.join(', ')}` : '',
    '',
    'INGREDIENTES DISPONIBLES (usa exclusivamente estos slugs):',
    catalogue,
    '',
    'Cada plato indica sus ingredientes en gramos para el número de raciones que declares.'
  ]
    .filter(Boolean)
    .join('\n');
}

import type { CandidateDish, Catalogue } from 'core/entities/Plan';

/**
 * What a dish is a dish *of*: the food from the protein aisle that carries
 * most of its protein, named by kind rather than by cut or tin.
 *
 * Variety by dish was not enough. A fortnight of forty-seven different dishes
 * served tuna in nine meals and egg whites three times in one day — every
 * dish distinct, the plate the same. The kind is read from the slug, which
 * names the cut first and the animal after it: `pechuga-de-pavo` and
 * `pavo-picado` are both turkey, `clara-de-huevo` is egg, `atun-al-natural`
 * and `ventresca-de-atun` are both tuna.
 *
 * Only the protein aisle counts — meat, fish, seafood, eggs and pulses. A
 * yoghurt at breakfast and cheese on toast are the ordinary shape of those
 * meals, not a repetition anybody notices. Null for a dish with nothing from
 * that aisle.
 */
export function mainProtein(dish: Pick<CandidateDish, 'ingredients'>, catalogue: Catalogue): string | null {
  let main: string | null = null;
  let most = 0;

  for (const item of dish.ingredients) {
    const ingredient = catalogue.get(item.slug);

    if (ingredient?.category !== 'protein') {
      continue;
    }

    const grams = (item.grams * ingredient.proteinPer100g) / 100;

    if (grams > most) {
      most = grams;
      main = item.slug;
    }
  }

  return main === null ? null : kindOf(main);
}

/** `pechuga-de-pavo` → `pavo`; `atun-al-natural` → `atun`. */
function kindOf(slug: string): string {
  return /-de-([a-z]+)/.exec(slug)?.[1] ?? slug.split('-')[0] ?? slug;
}

/**
 * **Once a day, and in about one meal in ten** (`0051`).
 *
 * At four meals a day that is six appearances a fortnight — three a week —
 * and never twice on one day. Unlike `VARIETY_RULES` these are preferences
 * the scheduler keeps whenever the pool lets it, not rules it fails a plan
 * over: a pool that is mostly tuna still gives somebody a plan, with tuna in
 * it more often than this.
 */
export const PROTEIN_RULES = { mealsPerAppearance: 10, perDay: 1 } as const;

/** How often one main protein may appear in a plan of `meals` meals. */
export function proteinCap(meals: number): number {
  return Math.max(2, Math.ceil(meals / PROTEIN_RULES.mealsPerAppearance));
}

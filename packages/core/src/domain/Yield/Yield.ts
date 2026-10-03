/** A cooked grain or pasta as it is bought: the dry food it is cooked from, and how much it swells. */
export type CookedYield = {
  /** The catalogue's dry counterpart, or null when it has none — the food is then named "(en seco)". */
  readonly drySlug: string | null;
  /** Cooked weight per dry weight. */
  readonly yield: number;
};

/**
 * The cooked grains and pastas of the catalogue, read and bought dry (`0078`).
 *
 * A recipe stores them cooked, because the macros and the scheduler read the
 * plate; a person buys and weighs them dry, and "Cuscús cocido 600 g" reads as a
 * plate twice the size of what comes out of 240 g of the packet. The yields are
 * common cooking ratios — boiled until tender, drained or absorbed. Cooked
 * legumes are not here on purpose: in Spain they are bought cooked, in jars. A
 * cooked grain added to the catalogue reads cooked until it is added here.
 */
export const COOKED_YIELDS: Readonly<Record<string, CookedYield>> = {
  'arroz-basmati-cocido': { drySlug: 'arroz-basmati-crudo', yield: 3 },
  'arroz-blanco-cocido': { drySlug: 'arroz-largo-crudo', yield: 3 },
  'arroz-integral-cocido': { drySlug: 'arroz-integral-crudo', yield: 2.5 },
  'arroz-salvaje-cocido': { drySlug: 'arroz-salvaje-crudo', yield: 3.5 },
  'bulgur-cocido': { drySlug: 'bulgur-crudo', yield: 2.5 },
  'cebada-cocida': { drySlug: 'cebada-perlada', yield: 3 },
  'cuscus-cocido': { drySlug: 'cuscus-crudo', yield: 2.5 },
  'espelta-cocida': { drySlug: 'espelta-en-grano', yield: 2.5 },
  'fideos-de-arroz-cocidos': { drySlug: 'fideos-de-arroz-secos', yield: 2.5 },
  'mijo-cocido': { drySlug: 'mijo', yield: 3 },
  'pasta-cocida': { drySlug: null, yield: 2.3 },
  'pasta-integral-cocida': { drySlug: 'pasta-integral-seca', yield: 2.2 },
  'polenta-cocida': { drySlug: 'polenta', yield: 4 },
  'quinoa-cocida': { drySlug: 'quinoa-cruda', yield: 2.75 },
  'trigo-sarraceno-cocido': { drySlug: 'trigo-sarraceno', yield: 2.5 }
};

/**
 * What `grams` of a cooked grain or pasta weighed dry, and which food that is;
 * null for anything else. Unrounded: the meal rounds what it shows, and the
 * shopping list rounds only once it has summed.
 */
export function toDry(slug: string, grams: number): { readonly dryGrams: number; readonly drySlug: string | null } | null {
  const entry = COOKED_YIELDS[slug];

  return entry ? { dryGrams: grams / entry.yield, drySlug: entry.drySlug } : null;
}

/** "Cocido" in every agreement, and the English the catalogue's `en-GB` names use. */
const COOKED_WORD = /\s*\b(?:cocid[oa]s?|cooked)\b\s*/giu;

/**
 * A cooked food's name without the word that says it is cooked — "Pasta
 * cocida" → "Pasta", "Cooked pasta" → "Pasta" — for a line that already says
 * the weight is dry.
 */
export function withoutCooked(name: string): string {
  const stripped = name.replace(COOKED_WORD, ' ').replace(/\s+/gu, ' ').trim();

  return stripped.length === 0 ? name : stripped.charAt(0).toLocaleUpperCase() + stripped.slice(1);
}

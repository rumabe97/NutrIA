/**
 * The allergen keys a `picture.accepted` row says the judge had flagged and the owner
 * overrode (`0072`) — catalogue keys, the empty list when the judge flagged none. Null when
 * the row's detail is not that shape: the trail then shows nothing rather than a guess.
 */
export function overriddenAllergens(detail: Readonly<Record<string, unknown>> | null): readonly string[] | null {
  const allergens = detail?.allergens;

  return Array.isArray(allergens) && allergens.every((key): key is string => typeof key === 'string') ? allergens : null;
}

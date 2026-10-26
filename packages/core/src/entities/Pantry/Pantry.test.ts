import { describe, expect, it } from 'vitest';

import { addPantryItemSchema, MAX_PANTRY_LABEL_LENGTH } from 'core/entities/Pantry';

describe('the body a cupboard entry arrives as', () => {
  it('takes a word on its own: an amount nobody weighed is the commonest honest answer', () => {
    expect(addPantryItemSchema.parse({ label: 'arroz' })).toEqual({ grams: null, label: 'arroz', unit: null });
  });

  it('trims the word, because the normalised key and the index behind it are one', () => {
    expect(addPantryItemSchema.parse({ label: '  Arroz largo  ' })).toMatchObject({ label: 'Arroz largo' });
  });

  it('refuses a word longer than a food’s name, so a text column does not become a notes field', () => {
    expect(addPantryItemSchema.safeParse({ label: 'a'.repeat(MAX_PANTRY_LABEL_LENGTH + 1) }).success).toBe(false);
    expect(addPantryItemSchema.safeParse({ label: 'a'.repeat(MAX_PANTRY_LABEL_LENGTH) }).success).toBe(true);
  });

  /*
   * The floor is the column's and not a taste. `pantry_items.grams` is
   * `numeric(9,2)`, so anything under `0.005` is written as `0.00` and read
   * back as a zero that `pantryItemSchema.positive()` refuses — which would be
   * a 500 for a body this schema had just approved, discovered in the
   * repository instead of judged here.
   */
  it('refuses an amount the column would round to nothing', () => {
    expect(addPantryItemSchema.safeParse({ grams: 0.004, label: 'arroz' }).success).toBe(false);
    expect(addPantryItemSchema.safeParse({ grams: 0.01, label: 'arroz' }).success).toBe(true);
  });

  it('refuses a unit with no amount, naming the field: «gramos de arroz» says nothing', () => {
    const refused = addPantryItemSchema.safeParse({ label: 'arroz', unit: 'g' });

    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]?.path).toEqual(['unit']);
  });

  it('takes an amount with no unit: grams is the column, so the unit only ever adds to it', () => {
    expect(addPantryItemSchema.safeParse({ grams: 500, label: 'arroz' }).success).toBe(true);
  });
});

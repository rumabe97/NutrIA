import { z } from 'zod';

import { MEASUREMENT_UNITS } from 'core/entities/Plan';

/**
 * What somebody says is already in the house, before a fortnight is generated.
 *
 * A **draft, not a larder**: it is typed before the plan exists, the generation
 * spends it, and it dies with it (the owner, 2026-10-22). Nothing here is a
 * restriction — what a person *has* is not what they *may eat* — and nothing
 * here changes which dishes a plan picks (the owner, 2026-10-23). What a
 * cupboard does is shorten the shopping list.
 */

/**
 * How many things somebody may say they have.
 *
 * **Sixty, and the same on both tiers**: a technical ceiling, checked where it
 * is written, never a `tier_allowances` row — a bigger cupboard would be a
 * better-served plan, and selling cupboard size is selling plan quality
 * (`marketing`, and the owner on 2026-10-23). Sixty rather than twenty because
 * coverage of a fortnight's shopping list rises monotonically with the
 * cupboard — 7.9% at fifteen items, 17.7% at thirty, 34.9% at sixty — and all
 * four larder sizes measured produced the identical plan, so the ceiling costs
 * the plan nothing (project 022, phase 0).
 *
 * Settled, not provisional: `MAX_PREFERRED_APPLIANCES` is the shape to read it
 * as, down to the refusal being a 422 that names the field.
 */
export const MAX_PANTRY_ITEMS = 60;

/**
 * The longest a cupboard word may be, as a custom allergen's label is capped
 * (`setAllergiesSchema`). The same number for the same reason: a food's name is
 * short, and a cap is what keeps a text column from becoming a notes field.
 */
export const MAX_PANTRY_LABEL_LENGTH = 80;

export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS);

/**
 * One thing in the cupboard, as it is stored.
 *
 * `ingredientId` null is a real state and not a failure: an entry the catalogue
 * has no answer for is **kept, with the word the person used**, because
 * tomorrow the catalogue may answer it and because those words in aggregate are
 * the library's own to-do list (PRD 022, criterion 12).
 *
 * `grams` and `unit` null together mean *"I have some"*, which is a different
 * fact from *"I have all of it"* and is the honest answer for a bag of rice
 * nobody weighed.
 */
export const pantryItemSchema = z.object({
  id: z.uuid(),
  grams: z.coerce.number().positive().nullable(),
  ingredientId: z.uuid().nullable(),
  /** What the person typed or picked. Shown back to them; never compared, never sent anywhere. */
  label: z.string().min(1),
  unit: measurementUnitSchema.nullable()
});

export type PantryItem = z.infer<typeof pantryItemSchema>;

/**
 * One entry as a route takes it: a word, and the amount where somebody knows it.
 *
 * The label is text although the screen is a picker over the catalogue
 * (`/privacidad` allows exactly one hand-written field a model reads, and
 * `0100` is it — nothing typed here ever leaves the product). It is text
 * because an entry that resolves to nothing has to be storable: the resolver is
 * ours, so what somebody owns cannot be bounded by what we have already
 * catalogued.
 */
export const addPantryItemSchema = z
  .object({
    /**
     * **A hundredth of a gram is the floor, and it is the column's floor and
     * not a taste.** `pantry_items.grams` is `numeric(9,2)`, so anything under
     * `0.005` is written as `0.00` and read back as a zero that
     * `pantryItemSchema.positive()` refuses — a 500 for a body this schema had
     * just approved. The bound belongs here, where the body is judged, rather
     * than in the repository that discovers it.
     */
    grams: z.number().min(0.01).max(100_000).nullable().default(null),
    label: z.string().trim().min(1).max(MAX_PANTRY_LABEL_LENGTH),
    unit: measurementUnitSchema.nullable().default(null)
  })
  /**
   * A unit with no amount says nothing — *«tengo gramos de arroz»* — and the
   * column comment claims the pair holds, so it is refused here rather than
   * silently dropped: input nobody meant is worth a 422 naming the field, and
   * dropping it would make the stored row disagree with the request.
   */
  .refine(entry => entry.unit === null || entry.grams !== null, { message: 'A unit needs an amount', path: ['unit'] });

export type AddPantryItem = z.infer<typeof addPantryItemSchema>;

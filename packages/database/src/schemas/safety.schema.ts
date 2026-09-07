import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { allergySeverity } from './_enums';
import { ingredients } from './food.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

/**
 * The canonical allergen catalogue (EU-14 plus common extras), seeded by
 * `src/seed.ts`. Allergies reference rows here rather than free text so the
 * validator compares ids, never strings a user typed.
 */
export const allergens = pgTable('allergens', {
  id: uuid().primaryKey().defaultRandom(),
  isEuMandatory: boolean().notNull().default(false),
  /** Stable machine key, e.g. `gluten`, `peanuts`. Never localise this. */
  key: text().notNull().unique(),
  labelEs: text().notNull(),
  ...timestamps
});

/**
 * A hard constraint. `crossContaminationSensitive` additionally excludes
 * ingredients flagged `may_contain` — see `docs/ARCHITECTURE.md` § Allergy safety.
 */
export const allergies = userOwned(
  'allergies',
  {
    allergenId: uuid()
      .notNull()
      .references(() => allergens.id, { onDelete: 'restrict' }),
    crossContaminationSensitive: boolean().notNull().default(false),
    notes: text(),
    severity: allergySeverity().notNull().default('moderate')
  },
  // Every safety-profile load joins through this column, and that load happens
  // before anything produces food.
  table => [index('allergies_allergen_idx').on(table.allergenId)]
);

/** Softer than an allergy, but still excluded from generation by default. */
export const intolerances = userOwned(
  'intolerances',
  {
    allergenId: uuid()
      .notNull()
      .references(() => allergens.id, { onDelete: 'restrict' }),
    notes: text(),
    /** Some users tolerate small amounts; null means "avoid entirely". */
    toleratedGramsPerDay: text()
  },
  table => [index('intolerances_allergen_idx').on(table.allergenId)]
);

/**
 * An allergy the catalogue has no allergen row for — whatever the user typed.
 *
 * `label` is kept exactly as written because it is shown back to them and it is
 * the only record of what they actually said. It is never what gets compared:
 * matching normalises a copy and resolves to `ingredientId`, and everything
 * downstream works from that id.
 *
 * There is no `matched` column. `ingredientId is not null` **is** the matched
 * flag, and a second copy of it could outlive the thing it describes: with
 * `on delete set null`, an ingredient leaving the catalogue silently downgrades
 * the entry to best-effort, which is true, whereas a stored boolean would go on
 * claiming an enforcement that no longer exists. The failure direction decides
 * the design.
 */
export const customAllergens = userOwned(
  'custom_allergens',
  {
    ingredientId: uuid().references(() => ingredients.id, { onDelete: 'set null' }),
    label: text().notNull()
  },
  table => [index('custom_allergens_ingredient_idx').on(table.ingredientId)]
);

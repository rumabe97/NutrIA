import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { allergySeverity } from './_enums';
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
export const allergies = userOwned('allergies', {
  allergenId: uuid()
    .notNull()
    .references(() => allergens.id, { onDelete: 'restrict' }),
  crossContaminationSensitive: boolean().notNull().default(false),
  notes: text(),
  severity: allergySeverity().notNull().default('moderate')
});

/** Softer than an allergy, but still excluded from generation by default. */
export const intolerances = userOwned('intolerances', {
  allergenId: uuid()
    .notNull()
    .references(() => allergens.id, { onDelete: 'restrict' }),
  notes: text(),
  /** Some users tolerate small amounts; null means "avoid entirely". */
  toleratedGramsPerDay: text()
});

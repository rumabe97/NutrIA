import { unique } from 'drizzle-orm/pg-core';

import { appliance, equipmentStance } from './_enums';
import { userOwned } from './_utils';

/**
 * What one person said about one appliance (`0102`).
 *
 * Rows, the way a cuisine preference is rows (`cuisine_preferences`), and for
 * the same reason: a kitchen is a short list of things somebody spoke about,
 * not a fixed set of columns that would need a migration per appliance added.
 * **No row is the default kitchen** — stovetop, oven, microwave — so an account
 * that never opened the screen stores nothing at all, which is what makes the
 * whole feature optional rather than one more question at sign-up.
 *
 * `kitchen_equipment_one_per_appliance` is the real invariant and it is here
 * rather than in a read-then-insert: a person takes one stance to an appliance,
 * and two requests fired together — a double tap, two tabs — both read "no row
 * yet" under READ COMMITTED and both insert. It is also what
 * `ON CONFLICT (user_id, appliance)` matches against, so the upsert that
 * changes a stance needs it to exist (Postgres 42P10 otherwise, which reaches
 * the person as an opaque 500).
 */
export const kitchenEquipment = userOwned('kitchen_equipment', { appliance: appliance().notNull(), stance: equipmentStance().notNull() }, table => [
  unique('kitchen_equipment_one_per_appliance').on(table.userId, table.appliance)
]);

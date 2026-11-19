import { pgEnum } from 'drizzle-orm/pg-core';

export const sex = pgEnum('sex', ['female', 'male', 'other', 'prefer_not_to_say']);

export const goalType = pgEnum('goal_type', ['weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating']);

export const activityLevel = pgEnum('activity_level', ['sedentary', 'light', 'moderate', 'high', 'athlete']);

/**
 * `traditional_spanish` (`0077`) is appended last, like `plan_status`'s
 * `pending_review`: adding a value rewrites nothing, reordering would.
 */
export const dietaryPattern = pgEnum('dietary_pattern', [
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'flexitarian',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher',
  'traditional_spanish'
]);

/** Ordered as they occur in a day — `meals.slot` sorts on this. */
export const mealSlot = pgEnum('meal_slot', ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper']);

export const mealStatus = pgEnum('meal_status', ['planned', 'completed', 'skipped']);

/**
 * A plan's statuses. `active` is unique per user, and so is `pending_review`:
 * a plan a linked client's professional has not published yet (`0060`), which
 * the client never sees. **The order is not the lifecycle**: `pending_review`
 * comes before `active` in a plan's life but is appended last, because an
 * added value cannot be placed without reordering — and adding one is what
 * keeps the migration from rewriting anything. `scheduled` is a plan that waits
 * for a start date after today (`0053`); it too is appended last.
 */
export const planStatus = pgEnum('plan_status', ['draft', 'generating', 'active', 'completed', 'archived', 'failed', 'pending_review', 'scheduled']);

export const jobStatus = pgEnum('job_status', ['queued', 'running', 'succeeded', 'failed']);

/** `may_contain` is the cross-contamination tier — see `docs/ARCHITECTURE.md` § Allergy safety. */
export const allergenPresence = pgEnum('allergen_presence', ['contains', 'may_contain']);

export const allergySeverity = pgEnum('allergy_severity', ['mild', 'moderate', 'severe', 'anaphylaxis']);

/** Doubles as the shopping-list grouping (§ Shopping list). */
export const ingredientCategory = pgEnum('ingredient_category', ['produce', 'protein', 'dairy', 'pantry', 'frozen', 'bakery', 'beverages', 'other']);

export const measurementUnit = pgEnum('measurement_unit', ['g', 'ml', 'unit', 'tbsp', 'tsp', 'cup', 'slice', 'pinch']);

export const difficulty = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const sentiment = pgEnum('sentiment', ['liked', 'disliked']);

export const recipeSource = pgEnum('recipe_source', ['seed', 'ai', 'user']);

/**
 * `checkin_submitted` tells a professional their linked client answered a
 * check-in (`0059`, Phase 6) — the recipient is the professional, not the
 * client the row is about. Appended last, like `plan_status`'s
 * `pending_review`: the order is not meaningful and adding a value here is
 * non-destructive, while reordering would rewrite every row.
 */
export const notificationType = pgEnum('notification_type', [
  'plan_ready',
  'checkin_due',
  'shopping_ready',
  'meal_reminder',
  'plan_failed',
  'checkin_submitted'
]);

export const notificationChannel = pgEnum('notification_channel', ['email', 'push', 'in_app']);

export const aiRole = pgEnum('ai_role', ['user', 'assistant']);

/** Which way one macro moves on a day that eats for an event (`0043`). */
export const macroDirection = pgEnum('macro_direction', ['up', 'down', 'same']);

/** What a recorded supplement is (`0052`). Only `protein` carries protein grams. */
export const supplementKind = pgEnum('supplement_kind', ['protein', 'creatine', 'vitamins_minerals', 'omega_3', 'other']);

/**
 * Where a link between a professional and a client stands (`0059`). `paused`
 * is a practice that stopped paying (`0061`); `ended` is for good, whoever
 * ended it, and a new link is a new row.
 */
export const careLinkStatus = pgEnum('care_link_status', ['active', 'paused', 'ended']);

/**
 * Who ended a link: one of its two sides, a practice that lapsed, or an account going away.
 * `account` is reserved and has no writer: while deleting an account cascades its link rows away, nothing is left to mark.
 * `badge_lost` (`0111` § 8, project 025 phase 5): the daily sweep ended it because the
 * practitioner no longer holds the badge while the client has a condition or a medication on
 * record. `declared` (same phase, review round one): the client saved a condition or a
 * medication while linked to a practitioner without the badge, and that ended it. The client's
 * own screen explains either; to the practitioner both read as `client` (legal F4). Appended,
 * never reordered.
 */
export const careLinkEndedBy = pgEnum('care_link_ended_by', ['professional', 'client', 'lapse', 'account', 'badge_lost', 'declared']);

/**
 * What kind of a client's data a professional reached (`0059`): their entry in
 * the professional's list (a stage worked out from their data), the overview,
 * the plans, progress, the targets, the separate health line, or a plan under
 * review. What the client reads in their own trail, one row per access.
 *
 * Adding a value to this or `careAccessAction`: make the reader
 * (`careAccessEntrySchema`) tolerate unknown values one release before, or
 * rolling back after a row with the new value is written breaks the old
 * API's trail for that client.
 */
export const careAccessKind = pgEnum('care_access_kind', ['list', 'overview', 'plan', 'progress', 'targets', 'health', 'review']);

/**
 * Whether that access only read, or changed something — or, on a `health` row,
 * that the client themselves started (`granted`) or stopped (`withdrawn`)
 * sharing the health line with that professional, without ending the link.
 */
export const careAccessAction = pgEnum('care_access_action', ['read', 'write', 'granted', 'withdrawn']);

/**
 * What a link's client consented to share (`0111` § 4): `full` is the badged
 * list (project 004's, every link made before project 025), `plan` the plan
 * only. The link's scope is `full` only while the practitioner's badge also
 * stands — this column is the consent half of that, never the whole of it.
 * Repeated as `CARE_CONSENT_SCOPES` in core; `Care.test.ts` keeps them equal.
 */
export const careConsentScope = pgEnum('care_consent_scope', ['full', 'plan']);

/**
 * One step on a practitioner's badge record (`0111` § 2). `applied` is the
 * practitioner's own declaration and decides nothing; the other four are the
 * decisive rows, and the latest of them is what the badge is derived from.
 * Repeated as `BADGE_CHECK_KINDS` in core; `Professional.test.ts` keeps them equal.
 */
export const badgeCheckKind = pgEnum('badge_check_kind', ['applied', 'pass', 'fail', 'withdrawn', 'lapsed']);

/**
 * How a badge code reached the practitioner, each a contact the owner read on
 * the public register (PRD 025 scope 6): an e-mail it lists, a letter to its
 * professional address, or the owner's call to a phone it lists. The
 * college-issued e-mail was dropped by the owner on 2026-11-18 (legal C12).
 * Repeated as `BADGE_CHANNELS` in core.
 */
export const badgeChannel = pgEnum('badge_channel', ['register_email', 'post', 'phone']);

/** What a practice's price is for (PRD 025 scope 4). Repeated as `PRICE_UNITS` in core. */
export const priceUnit = pgEnum('price_unit', ['consultation', 'month', 'plan']);

/**
 * The owner's acts on an account as a practitioner (PRD 025 scope 16):
 * suspended at once, closing with 30 days' notice, or lifted. What stands is
 * the latest row. Repeated as `PRACTICE_RESTRICTION_KINDS` in core.
 */
export const practiceRestrictionKind = pgEnum('practice_restriction_kind', ['suspended', 'closing', 'lifted']);

/**
 * The appliances a person may speak about (`0102`). The authority on the
 * catalogue is `APPLIANCES` in `packages/core/src/entities/Kitchen`; the ten
 * strings are repeated here because this package sits *below* core and cannot
 * import it — the same duplication, for the same reason, as `MealShape` in
 * `profile.schema.ts`. `Kitchen.test.ts` asserts the two lists are identical,
 * so a drift fails a test rather than a query.
 *
 * Appended to, never reordered: adding a value rewrites nothing, reordering
 * would — as `plan_status`'s `pending_review` says.
 */
export const appliance = pgEnum('appliance', [
  'stovetop',
  'oven',
  'microwave',
  'air_fryer',
  'pressure_cooker',
  'blender',
  'grill',
  'steamer',
  'slow_cooker',
  'rice_cooker'
]);

/**
 * What somebody said about one appliance: it is not there, it is there, or it
 * is what they would rather cook with (`0102`).
 *
 * Not one scale: `missing` is enforced in code the way an allergy is, and
 * `prefers` is asked of the model and may never remove a dish. No row at all
 * means the default kitchen, which is why there is no `unknown` value here.
 */
export const equipmentStance = pgEnum('equipment_stance', ['missing', 'has', 'prefers']);

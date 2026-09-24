import { pgEnum } from 'drizzle-orm/pg-core';

export const sex = pgEnum('sex', ['female', 'male', 'other', 'prefer_not_to_say']);

export const goalType = pgEnum('goal_type', ['weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating', 'custom']);

export const activityLevel = pgEnum('activity_level', ['sedentary', 'light', 'moderate', 'high', 'athlete']);

export const cookingFrequency = pgEnum('cooking_frequency', ['rarely', 'sometimes', 'often', 'daily']);

export const budgetTier = pgEnum('budget_tier', ['low', 'medium', 'high']);

export const dietaryPattern = pgEnum('dietary_pattern', [
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'flexitarian',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher'
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
 * keeps the migration from rewriting anything.
 */
export const planStatus = pgEnum('plan_status', ['draft', 'generating', 'active', 'completed', 'archived', 'failed', 'pending_review']);

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
 */
export const careLinkEndedBy = pgEnum('care_link_ended_by', ['professional', 'client', 'lapse', 'account']);

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

/** Whether that access only read, or changed something. */
export const careAccessAction = pgEnum('care_access_action', ['read', 'write']);

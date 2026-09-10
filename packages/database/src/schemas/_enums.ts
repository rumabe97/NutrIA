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

/** A plan never goes backwards through these. `active` is unique per user. */
export const planStatus = pgEnum('plan_status', ['draft', 'generating', 'active', 'completed', 'archived', 'failed']);

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

export const notificationType = pgEnum('notification_type', ['plan_ready', 'checkin_due', 'shopping_ready', 'meal_reminder', 'plan_failed']);

export const notificationChannel = pgEnum('notification_channel', ['email', 'push', 'in_app']);

export const aiRole = pgEnum('ai_role', ['user', 'assistant']);

/** Which way one macro moves on a day that eats for an event (`0043`). */
export const macroDirection = pgEnum('macro_direction', ['up', 'down', 'same']);

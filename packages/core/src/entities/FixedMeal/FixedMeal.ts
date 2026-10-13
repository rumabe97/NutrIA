import { z } from 'zod';

import { MEAL_SLOTS } from 'core/entities/Plan';

/**
 * A meal somebody fixed to one day of the week, for ever — *"every Friday
 * dinner is tortilla de patata"* (`0098`, `0099`).
 *
 * It is not an event and not a swap: an event is one dated thing that changes a
 * fortnight, a swap changes one plate of one plan, and this changes the same
 * meal of the same weekday in every plan until it is removed. That is why it is
 * the one allowance `0097` calls **structural** — what it spends is not a model
 * call but the promise that every day lands inside 5% on all four macros.
 */

/**
 * The day of the week a rule lands on: **0 is Monday**, 6 is Sunday.
 *
 * ISO ordering, and not the Sunday-first one `Date.getDay` returns, because
 * every week the product shows a person starts on Monday. The one place the two
 * meet is whoever converts a date, and `weekdayOf` is that place.
 */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const weekdaySchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

/**
 * Which slots a meal may be fixed to.
 *
 * Every slot a dish can declare: somebody whose routine is a fixed breakfast
 * has the same claim on it as somebody whose routine is a fixed dinner, and the
 * measurement found the cheap slot was breakfast rather than the forbidden one
 * (`0098`: three rules all at breakfast cost one day of 1960, all at lunch ten).
 * What the product refuses is refused per dish and said out loud before the rule
 * exists — that is `pinnable`'s job, not this schema's.
 */
export const fixedMealSlotSchema = z.enum(MEAL_SLOTS);

const shape = {
  /** The recipe's slug, which is what the scheduler pins by (`PinnedMeal`). */
  dishSlug: z.string().trim().min(1),
  slot: fixedMealSlotSchema,
  weekday: weekdaySchema
};

/**
 * A stored rule, with the dish's name beside its slug.
 *
 * The name is not part of `shape` — nobody sends it, and it is the recipe's
 * rather than the rule's — but every read joins the recipe anyway, and a screen
 * that has only the slug prints a slug at somebody. Which is what it did, until
 * a probe showed `arroz-integral-salteado-con-verduras-anacardos-y-jengibre` on
 * the profile.
 */
export const fixedMealSchema = z.object({ dishName: z.string(), id: z.uuid(), ...shape });

export type FixedMeal = z.infer<typeof fixedMealSchema>;

/** What a person sends to fix a meal. The dish is named by slug; the route is what checks it can be fixed. */
export const addFixedMealSchema = z.object(shape);

export type AddFixedMeal = z.infer<typeof addFixedMealSchema>;

/**
 * The weekday of an ISO date, 0 for Monday.
 *
 * `Date.getDay` counts from Sunday, so this is the one conversion in the
 * product and every caller goes through it. A plan's day index is not a
 * weekday: it is an offset from the plan's own first day, which can be any day
 * of the week (project 015 lets a plan start up to a week ahead). Expanding a
 * rule into day indexes therefore needs the plan's start date, never the index
 * alone — `daysFor` is where that happens.
 */
export function weekdayOf(isoDate: string): Weekday {
  return ((new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7) as Weekday;
}

/**
 * Which day indexes of a plan starting on `startDate` and running `days` days a
 * rule for `weekday` lands on.
 *
 * A weekly rule over a fortnight lands on two days, and over a plan cut short by
 * a redo it may land on one — so this counts rather than assuming. It is the
 * caller's job (`0098`) precisely because the scheduler must not learn what a
 * weekday is: it is handed day indexes and nothing else.
 */
export function daysFor(weekday: Weekday, startDate: string, days: number): readonly number[] {
  const first = weekdayOf(startDate);
  const offset = (weekday - first + 7) % 7;
  const landing: number[] = [];

  for (let index = offset; index < days; index += 7) {
    landing.push(index);
  }

  return landing;
}

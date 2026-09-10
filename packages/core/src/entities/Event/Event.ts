import { z } from 'zod';

/**
 * A day that asks more of the body than the rest of the fortnight, and the
 * days before it that should eat for it (`0043`).
 *
 * Not a "goal": `goals` already means the direction of the whole plan. This is
 * one dated thing with a name the person chose — a race, a match, a Hyrox, a
 * long session — and nothing in the code cares which. What the code reads is
 * the *shape*: how many days before, and for each macro whether it goes up,
 * down or stays.
 */

/** Which way one macro moves on a loaded day. There is no "how much": the size is the code's (`core/domain/Event`). */
export const macroDirectionSchema = z.enum(['up', 'down', 'same']);

export type MacroDirection = z.infer<typeof macroDirectionSchema>;

/**
 * A carbohydrate load is one to three days. Longer than that is not a load, it
 * is a different plan, and the person who needs one needs somebody watching.
 */
export const MAX_DAYS_BEFORE = 3;
export const MAX_EVENT_NAME = 60;

const shape = {
  carbs: macroDirectionSchema,
  daysBefore: z.number().int().min(1).max(MAX_DAYS_BEFORE),
  fat: macroDirectionSchema,
  name: z.string().trim().min(1).max(MAX_EVENT_NAME),
  on: z.iso.date(),
  protein: macroDirectionSchema
};

export const eventSchema = z.object({ id: z.uuid(), ...shape });

export type Event = z.infer<typeof eventSchema>;

export const addEventSchema = z
  .object(shape)
  .refine(event => event.carbs !== 'same' || event.protein !== 'same' || event.fat !== 'same', {
    message: 'at least one macro must move, or there is nothing to load for',
    path: ['carbs']
  });

export type AddEvent = z.infer<typeof addEventSchema>;

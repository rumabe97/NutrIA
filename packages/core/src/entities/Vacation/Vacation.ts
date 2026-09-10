import { z } from 'zod';

/**
 * Long enough for a sabbatical, short enough that a typo in a year does not
 * push somebody's plan into the next decade.
 */
export const MAX_VACATION_DAYS = 90;

/**
 * A stretch of days the plan is paused for, both ends included: leaving on the
 * 12th and coming back on the 19th is eight days away, not seven.
 */
export const vacationSchema = z.object({ id: z.uuid(), endsOn: z.string(), startsOn: z.string() });

export type Vacation = z.infer<typeof vacationSchema>;

export const planVacationSchema = z
  .object({ endsOn: z.iso.date(), startsOn: z.iso.date() })
  .refine(trip => trip.endsOn >= trip.startsOn, { message: 'endsOn must not be before startsOn', path: ['endsOn'] });

export type PlanVacation = z.infer<typeof planVacationSchema>;

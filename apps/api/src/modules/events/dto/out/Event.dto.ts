import type { EventView } from 'core/controllers/Event';

/** One event, with the days that eat for it. */
export type EventDto = EventView;

/**
 * The event just declared, plus which days of the fortnight under way were
 * rebuilt for it on the spot (`0044`). Empty for a free account, for a load
 * that falls outside the active plan, and for a load whose days are all today
 * or earlier — in every one of those the event applies at the next generation,
 * which is what the screen says when the list is empty.
 */
export type AddedEventDto = EventDto & { readonly rebuiltDates: readonly string[] };

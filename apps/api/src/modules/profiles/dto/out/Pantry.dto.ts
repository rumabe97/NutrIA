import type { PantryView } from 'core/controllers/Pantry';

/**
 * The cupboard as it now stands, and the bound on it.
 *
 * Every route answers the whole list rather than the row it touched, as the
 * kitchen does: one shape for the screen to render, and no state for a client
 * to reassemble from a 201 and a cached list.
 */
export type PantryDto = PantryView;

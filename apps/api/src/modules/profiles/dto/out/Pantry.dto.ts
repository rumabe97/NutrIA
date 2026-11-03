import type { PantryCatalogueFoodView, PantryView } from 'core/controllers/Pantry';

/**
 * The cupboard as it now stands, and the bound on it.
 *
 * Every route answers the whole list rather than the row it touched, as the
 * kitchen does: one shape for the screen to render, and no state for a client
 * to reassemble from a 201 and a cached list.
 */
export type PantryDto = PantryView;

/**
 * What the picker may offer, at most fifty foods.
 *
 * A bare list and not `{ items }`, unlike `PantryDto`: this is an answer to a
 * word somebody is typing, not the state of anything, so there is nothing else
 * about it a screen would hold on to. The bound is
 * `PANTRY_CATALOGUE_PAGE`, and a screen that wants more types another letter.
 */
export type PantryCatalogueDto = readonly PantryCatalogueFoodView[];

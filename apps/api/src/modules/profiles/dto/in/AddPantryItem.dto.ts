import { addPantryItemSchema } from 'core/entities/Pantry';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * One thing somebody says is already in the house: the word, and the amount
 * where they know it.
 *
 * The schema is `core/entities/Pantry`'s own and not a second copy — whether
 * the word names anything is the resolver's answer and the controller's to ask,
 * because it needs the catalogue. An entry that resolves to nothing is accepted
 * and kept: what somebody owns is not bounded by what we have catalogued.
 *
 * **No slug and no ingredient id in the body.** The screen is a picker over the
 * catalogue, so it could send one — and then an id from a request would decide
 * what the entry is, which is the shape `0100` and `/privacidad` are written
 * against from the other side. The word is resolved here, once, in code, and
 * the catalogue slug it lands on is the only part of the entry that may ever
 * leave the product.
 */
export const AddPantryItemDto = zodDto('AddPantryItem', addPantryItemSchema);
export type AddPantryItemDto = InferDto<typeof AddPantryItemDto>;

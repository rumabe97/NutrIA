import { setShoppingItemSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A tick, and only a tick. Editing quantities or adding rows would change what
 * the list says the plan *needs*, which is a different claim and needs its own
 * thinking; a checkbox records what the shopper already picked up.
 */
export const SetShoppingItemDto = zodDto('SetShoppingItem', setShoppingItemSchema);
export type SetShoppingItemDto = InferDto<typeof SetShoppingItemDto>;

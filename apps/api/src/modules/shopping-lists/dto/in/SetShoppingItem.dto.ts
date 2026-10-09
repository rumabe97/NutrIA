import { setShoppingItemSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * What has been bought, and only that — an amount in grams, or the tick it
 * replaced, which the web build live during a deploy still sends (`0091`).
 * Editing quantities or adding rows would change what the list says the plan
 * *needs*, which is a different claim and needs its own thinking.
 */
export const SetShoppingItemDto = zodDto('SetShoppingItem', setShoppingItemSchema);
export type SetShoppingItemDto = InferDto<typeof SetShoppingItemDto>;

import { checkoutSchema } from 'core/entities/Billing';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Which price checkout opens with (`0056`). Monthly unless the person chose the yearly one. */
export const CheckoutDto = zodDto('Checkout', checkoutSchema);
export type CheckoutDto = InferDto<typeof CheckoutDto>;

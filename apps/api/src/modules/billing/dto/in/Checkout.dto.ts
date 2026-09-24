import { checkoutSchema } from 'core/entities/Billing';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Which price checkout opens with: premium's (`0056`), monthly unless the person chose yearly, or a practice's (`0061`). */
export const CheckoutDto = zodDto('Checkout', checkoutSchema);
export type CheckoutDto = InferDto<typeof CheckoutDto>;

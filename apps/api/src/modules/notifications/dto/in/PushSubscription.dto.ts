import { pushSubscriptionSchema, removePushSubscriptionSchema } from 'core/entities/Notification';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** A browser asking to be told (`0054`). Only an endpoint on a push service browsers use is taken. */
export const PushSubscriptionDto = zodDto('PushSubscription', pushSubscriptionSchema);
export type PushSubscriptionDto = InferDto<typeof PushSubscriptionDto>;

/** A browser that no longer wants to be told. */
export const RemovePushSubscriptionDto = zodDto('RemovePushSubscription', removePushSubscriptionSchema);
export type RemovePushSubscriptionDto = InferDto<typeof RemovePushSubscriptionDto>;

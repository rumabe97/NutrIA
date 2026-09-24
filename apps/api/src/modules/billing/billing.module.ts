import { Module } from '@nestjs/common';

import { BillingController } from './controllers/index.js';
import { BillingService, StripeGateway } from './services/index.js';
import { envProvider } from '../../config/index.js';

/**
 * Paying for premium through Stripe (`0056`). Unconfigured, every route answers as if there were nothing to buy.
 *
 * The service is exported for account deletion, which cancels at Stripe before the account goes.
 */
@Module({ controllers: [BillingController], exports: [BillingService], providers: [BillingService, envProvider, StripeGateway] })
export class BillingModule {}

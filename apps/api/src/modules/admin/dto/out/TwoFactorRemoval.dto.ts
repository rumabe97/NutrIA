import type { TwoFactorRemovalView } from 'core/controllers/TwoFactor';

/** When the cron may remove the factor (PLAN 011 phase 4) — nothing else of the account, not even the address mailed. */
export type TwoFactorRemovalDto = TwoFactorRemovalView;

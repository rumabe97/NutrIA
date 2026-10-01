/**
 * How long the owner's removal of a lost second factor waits (PLAN 011 phase
 * 4): 48 hours from the request. The daily cron removes it on its first run at
 * or after that instant, so in practice 48 to 72 hours — what the mail and the
 * console say.
 */
export const TWO_FACTOR_REMOVAL_DELAY_MS = 48 * 60 * 60 * 1000;

/** Who cancelled a pending removal: the owner from the console, or the account itself by entering a code. */
export const TWO_FACTOR_REMOVAL_CANCELLED_BY = ['account', 'owner'] as const;

export type TwoFactorRemovalCancelledBy = (typeof TWO_FACTOR_REMOVAL_CANCELLED_BY)[number];

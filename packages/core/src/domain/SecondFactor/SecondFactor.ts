/** What the rule reads of an account: whether it can sign in with a password, and whether its authenticator app is on. */
export interface SecondFactorStanding {
  readonly hasPassword: boolean;
  readonly twoFactorEnabled: boolean;
}

/**
 * Whether a privileged account — a professional, the admin — still lacks the
 * second factor it must have before it reads anybody's data (PLAN 011 phase 6,
 * `0074`). The one home of the rule: `ProfessionalGuard` and `AdminGuard` ask
 * it through `UserController.needsSecondFactor`, the workspace page through the
 * practice view, the console's gate on the web with `UserView`'s two fields.
 *
 * - **A password needs TOTP.** An account with a `credential` account must have
 *   `twoFactorEnabled`, however it signs in today: the password door stays
 *   open for whoever learns the password, and only the challenge closes it.
 * - **A passkey is not a substitute.** A user-verified passkey makes *its own*
 *   sign-in two factors (`0083`), but it guards nothing at the password door
 *   beside it, so a password account with a passkey and no TOTP still lacks
 *   one. With TOTP on, a passkey sign-in passes: the rule looks at the
 *   account, never at how this session was opened.
 * - **No password, nothing to add.** A Google- or Apple-only account's second
 *   factor is its provider's (PLAN 011, out of scope), and the two-factor
 *   plugin refuses to turn on for it.
 */
export function secondFactorMissing(account: SecondFactorStanding): boolean {
  return account.hasPassword && !account.twoFactorEnabled;
}

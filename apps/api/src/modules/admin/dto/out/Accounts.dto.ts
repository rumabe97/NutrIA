import type { AccountView, Paged } from 'core/controllers/User';

/** One page of accounts: address, dates and role, and nothing else (`0028`). */
export type AccountsDto = Paged<AccountView>;

/**
 * The address of the account that was opened, so the screen can name it. This
 * app composes it from what `UserController.activate` answers with, which is
 * null when nothing matched — and null is a 404 here, not an empty body.
 */
export interface ActivatedAccountDto {
  readonly email: string;
}

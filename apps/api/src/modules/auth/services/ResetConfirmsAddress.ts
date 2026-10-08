import { Logger } from '@nestjs/common';

import { UserController } from 'core/controllers/User';

import type { Context } from './PasswordPolicy.js';

const RESET = '/reset-password';

const logger = new Logger('ResetConfirmsAddress');

type Account = { readonly id: string; readonly email: string };

export type ResetConfirmation = {
  /** `hooks.after`, on a 2xx `/reset-password`: the address confirmed, once the sessions are gone. */
  readonly after: (context: Context) => Promise<void>;
  /**
   * `onPasswordReset`: the account a valid token just set a password for, kept
   * for this request's after-hook. Better Auth calls it before it revokes the
   * account's sessions, which is why nothing is confirmed here.
   */
  readonly remember: (account: Account, request: Request | undefined) => Promise<void>;
};

/**
 * A completed password reset confirms the address (PLAN 011 phase 8): whoever
 * opened the link holds the mailbox, as whoever opens a confirmation link does.
 * Better Auth's reset does not, and an unconfirmed account cannot sign in with
 * its password — so the owner of an address a stranger signed up first, with a
 * password of the stranger's, resets it and signs in with the new one.
 *
 * In `hooks.after` (invariant review, P3), not in `onPasswordReset`: Better
 * Auth calls that before `revokeSessionsOnPasswordReset` deletes the account's
 * sessions, and an address must not be confirmed while a session from before
 * the proof is still alive. Confirming it runs what confirming one runs — the
 * account opens itself, awaited, since the next request may need it open; or
 * the owner is told, which `addressConfirmed` sends after the response: the
 * reset never waits for the owner's mail.
 *
 * Keyed on the request; a call through `auth.api` has none and is confirmed at
 * once, as there is no route after it. A failure leaves the address as it was
 * and one line naming the account only: the password did change, and the next
 * sign-in sends a link.
 */
export function resetConfirmsAddress(deps: { readonly addressConfirmed: (account: Account) => Promise<void> }): ResetConfirmation {
  const pending = new WeakMap<Request, Account>();

  async function confirm(account: Account): Promise<void> {
    try {
      if (await UserController.confirmAddressByReset(account.id)) {
        await deps.addressConfirmed(account);
      }
    } catch {
      logger.error(`address_not_confirmed_on_reset ${JSON.stringify({ userId: account.id })}`);
    }
  }

  return {
    async after(context) {
      const account = context.path === RESET && context.request ? pending.get(context.request) : undefined;

      if (account && context.request) {
        pending.delete(context.request);
        await confirm(account);
      }
    },
    async remember(account, request) {
      if (request) {
        pending.set(request, account);

        return;
      }

      await confirm(account);
    }
  };
}

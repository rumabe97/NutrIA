import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { notifyOwnerOfWaitingAccount } from './AccountWaitingMail.js';

import type { EmailService } from '../../email/Email.service.js';

/**
 * What confirming an address does, decided by the owner's switch (`0031`).
 *
 * Automatic: proving the address opens the account, and nobody waits on the
 * owner. Manual: a confirmed address opens nothing and an admin turns the key
 * (`0030`). Two locks, still two meanings — what changes is who opens the
 * second one.
 *
 * The switch is read at the moment of the click, not remembered from sign-up,
 * so turning it off holds back everybody who has not confirmed yet.
 *
 * Never throws. The address is confirmed by then — that write already happened
 * — and a settings read that fails must not turn a working verification link
 * into an error page. It leaves the account waiting, which an admin can still
 * open by hand.
 */
async function activateIfAutomatic(userId: string): Promise<boolean> {
  try {
    if (!(await SettingsController.automaticActivation())) {
      return false;
    }

    const opened = await UserController.activate({ id: userId });

    console.info(`[auth] activation is automatic; account ${opened ? 'opened' : 'NOT found'} on verification (user ${userId})`);

    return opened !== null;
  } catch (error) {
    console.info(`[auth] automatic activation failed (user ${userId}): ${error instanceof Error ? error.message : 'unknown error'}`);

    return false;
  }
}

/**
 * The whole of what happens when somebody confirms their address: the account
 * opens itself, or the owner is told there is something to do.
 *
 * The notice moved here from sign-up (`0029`, amended by `0031`): mail on
 * sign-up said "an account is waiting" for accounts that were about to open
 * themselves a minute later. This is the moment an account actually lands in
 * the queue, so this is when the queue is worth reporting.
 */
export async function onAddressConfirmed(
  account: { readonly id: string; readonly email: string },
  deps: {
    readonly link: { readonly apiUrl: string; readonly secret: string };
    readonly mailer: Pick<EmailService, 'configured' | 'send'>;
    readonly ownerEmail: string | undefined;
  }
): Promise<'opened' | 'waiting'> {
  if (await activateIfAutomatic(account.id)) {
    return 'opened';
  }

  await notifyOwnerOfWaitingAccount(deps.mailer, deps.ownerEmail, account, deps.link);

  return 'waiting';
}

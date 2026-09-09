import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

/**
 * What confirming an address does, decided by the door (`0031`, amended).
 *
 * Open: the product is self-service, so proving the address opens the account
 * and nobody waits on the owner. Closed: a confirmed address opens nothing and
 * an admin turns the key (`0030`). Two fields, still two meanings — what
 * changes is who fills the second one.
 *
 * The door is read at the moment of the click, not remembered from sign-up:
 * somebody who signed up while it was open and confirms after it shut is
 * waiting, which is the whole reason for shutting it.
 *
 * Never throws. The address is confirmed either way — that write already
 * happened — and a settings read that fails must not turn a working
 * verification link into an error page. It leaves the account waiting, which
 * an admin can still open by hand.
 */
export async function activateIfRegistrationIsOpen(userId: string): Promise<boolean> {
  try {
    if (!(await SettingsController.registrationOpen())) {return false;}

    const opened = await UserController.activate({ id: userId });

    console.info(`[auth] registration is open; account ${opened ? 'opened' : 'NOT found'} on verification (user ${userId})`);

    return opened !== null;
  } catch (error) {
    console.info(`[auth] self-service activation failed (user ${userId}): ${error instanceof Error ? error.message : 'unknown error'}`);

    return false;
  }
}

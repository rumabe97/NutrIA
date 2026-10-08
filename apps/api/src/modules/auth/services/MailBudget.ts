import { Logger } from '@nestjs/common';

import { MailBudgetController } from 'core/controllers/MailBudget';
import { mailBudgetKey } from 'core/domain/MailBudget';

import type { MailBudgetKind } from 'core/domain/MailBudget';

const logger = new Logger('MailBudget');

export type MailBudget = {
  /** Runs `send` when the address's hour still has room for a mail of this kind, and counts it; otherwise one line says it was held. */
  readonly within: (kind: MailBudgetKind, recipient: { id: string; email: string }, send: () => Promise<void>) => Promise<void>;
};

/**
 * The per-address mail budget (PLAN 011 phase 8; the rule is
 * `core/domain/MailBudget`): three mails of a kind per address per hour, from
 * the doors anybody can knock at — a confirmation link, which every sign-in
 * of an unconfirmed account sends again, "somebody tried to create an
 * account with your address", and a password reset. Better Auth's own limit on those doors counts
 * per IP; this counts per address, so many IPs cannot fill one mailbox.
 *
 * Every caller runs inside a background task, after the response: the lookup
 * and the lock change nothing a client sees or can time. The reset and the
 * "somebody tried" mail are handed to `runInBackgroundOrAwait` by Better Auth;
 * the confirmation link is handed to `BackgroundTaskService` by its own
 * callback, because the anonymous `/send-verification-email` awaits that
 * callback and only pads it to a floor, never down to one.
 *
 * It fails open, as the sign-in brake does: if its row cannot be read or
 * written, the mail goes and `mail_budget_unavailable` says so. Neither line
 * carries the address or its key.
 */
export function mailBudget(secret: string): MailBudget {
  return {
    async within(kind, { id, email }, send) {
      let allowed = true;

      try {
        allowed = await MailBudgetController.spend(mailBudgetKey(kind, email, secret));
      } catch {
        logger.error('mail_budget_unavailable');
      }

      if (!allowed) {
        console.info(`[auth] ${kind} mail held: the address's hourly budget is spent (user ${id})`);

        return;
      }

      await send();
    }
  };
}

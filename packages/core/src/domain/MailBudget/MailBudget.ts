import { createHmac } from 'node:crypto';

const HOUR = 60 * 60 * 1000;

/**
 * How many mails one address may be sent, of one kind, by doors anybody can
 * knock at (PLAN 011 phase 8): the confirmation link, sent again on every
 * sign-in of an unconfirmed account, and "somebody tried to create an account
 * with your address". Better Auth holds `/send-verification-email` to three
 * mails a minute per IP; this is the same three, per address and per hour —
 * the life of a link — so a stranger with many IPs cannot fill a mailbox.
 */
export const MAIL_BUDGET = { max: 3, windowMs: HOUR } as const;

/** The mails the budget counts, each on its own: an attack on one never spends the other. */
export type MailBudgetKind = 'existing-account' | 'verification';

/** What the budget holds for one address and kind: the mails sent in the window, and when the window ends. */
export type MailsSent = { readonly count: number; readonly windowEndsAt: Date };

export type MailDecision = { readonly kind: 'held' } | { readonly kind: 'send'; readonly next: MailsSent };

/**
 * The key an address's mails of one kind are counted under: an HMAC of the
 * kind and the lower-cased address with the auth secret, never the address.
 * The label keeps it apart from the sign-in brake's key and from anything
 * else signed with the same secret.
 */
export function mailBudgetKey(kind: MailBudgetKind, email: string, secret: string): string {
  return createHmac('sha256', secret).update(`mail-budget:${kind}:${email.toLowerCase()}`).digest('hex');
}

/** One more mail: sent and counted while the window has room, held once it is spent. A window past its end starts again at one. */
export function decideMail(sent: MailsSent | undefined, now: Date): MailDecision {
  if (!sent || sent.windowEndsAt <= now) {
    return { kind: 'send', next: { count: 1, windowEndsAt: new Date(now.getTime() + MAIL_BUDGET.windowMs) } };
  }

  return sent.count < MAIL_BUDGET.max ? { kind: 'send', next: { count: sent.count + 1, windowEndsAt: sent.windowEndsAt } } : { kind: 'held' };
}

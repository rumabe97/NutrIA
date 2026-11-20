import { z } from 'zod';

/**
 * The notices the owner sends to every account, once each (project 025 phase
 * 10): a closed list, so a typo in a route cannot start a second campaign.
 * `terms-2.4.0` is the change notice of `docs/legal/textos/06-correos.md` § Z —
 * anyone adult may open a practice — sent before the `professional` switch, for
 * `/condiciones` 2.4.0 (`TERMS_VERSION`) and the policy's «Tu profesional en
 * NutrIA». A new notice is a new name here, with its own template.
 */
export const ACCOUNT_NOTICES = ['terms-2.4.0'] as const;

export type AccountNotice = (typeof ACCOUNT_NOTICES)[number];

/**
 * How many accounts one press of the console's send mails, at most, one after
 * the other: well inside a function's 300 seconds, and far below what one
 * mailbox's SMTP accepts in a day. The owner presses again for the next batch.
 */
export const NOTICE_BATCH_SIZE = 25;

/**
 * The body of the preview and of the send: the day the notice announces — the
 * day the owner means to make the change. A calendar day, `YYYY-MM-DD`; that it
 * is after today, and the same day the notice was first sent for, is the
 * controller's to check (it needs the clock and the rows).
 */
export const noticeDateSchema = z.object({ date: z.iso.date() });

export type NoticeDate = z.infer<typeof noticeDateSchema>;

/** Whether `value` names a notice on the list: a route's `:notice`, before anything is read for it. */
export function isAccountNotice(value: string): value is AccountNotice {
  return (ACCOUNT_NOTICES as readonly string[]).includes(value);
}

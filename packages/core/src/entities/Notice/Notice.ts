import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';

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
 * How many notice mails may leave in one Madrid day, every notice together. The
 * notice goes through the one SMTP mailbox every other mail needs — the
 * confirmation link, a reset, a badge code — so it may never spend that
 * mailbox's day: a press stops at this many, and a press once it is reached is
 * refused until Madrid's next midnight.
 */
export const NOTICE_DAILY_CAP = 200;

/** How far ahead the announced day may be, in Madrid days: a slip of the year must not fix a campaign for good. */
export const NOTICE_MAX_DAYS_AHEAD = 60;

/**
 * How long one press may keep starting mails, in milliseconds. A press holds
 * its lock in an open transaction that Neon closes after five idle minutes
 * (`idle_in_transaction_session_timeout`), and the function itself stops at
 * 300 seconds; one mail can take up to about 35 seconds before the mailer gives
 * up. No mail is started after this, so a press ends well inside both.
 */
export const NOTICE_PRESS_BUDGET_MS = 150_000;

/**
 * The body of the preview: the day the notice announces — the day the owner
 * means to make the change. A calendar day, `YYYY-MM-DD`; that it is after
 * today, within `NOTICE_MAX_DAYS_AHEAD`, and the same day the notice was first
 * sent for, is the controller's to check (it needs the clock and the rows).
 */
export const noticeDateSchema = z.object({ date: z.iso.date() });

export type NoticeDate = z.infer<typeof noticeDateSchema>;

/**
 * The body of a send: the day, and `after` — the cursor the previous press
 * answered, so a press starts after the accounts the last one tried and a run
 * of addresses the server refuses cannot hold the rest back. Absent, the press
 * starts from the oldest account owed.
 */
export const noticeSendSchema = noticeDateSchema.extend({ after: z.string().min(1).max(64).optional() });

export type NoticeSend = z.infer<typeof noticeSendSchema>;

/** The preview's page of recipients, as the console's other lists page (`/admin/cuentas`). */
export const noticePageSchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
});

export type NoticePage = z.infer<typeof noticePageSchema>;

/** Whether `value` names a notice on the list: a route's `:notice`, before anything is read for it. */
export function isAccountNotice(value: string): value is AccountNotice {
  return (ACCOUNT_NOTICES as readonly string[]).includes(value);
}

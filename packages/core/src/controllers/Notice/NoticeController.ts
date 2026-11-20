import { AccountNoticeRepository } from '#repositories/Notice';
import { AuditRepository } from '#repositories/Audit';
import { UserRepository } from '#repositories/User';
import { madridDayKey, madridLongDay, madridMidnight, shiftDay } from 'core/domain/Period';
import { ConflictError, InputParseError, NotFoundError, NoticeDailyCapError } from 'core/entities/Error';
import { isAccountNotice, NOTICE_BATCH_SIZE, NOTICE_DAILY_CAP, NOTICE_MAX_DAYS_AHEAD, NOTICE_PRESS_BUDGET_MS } from 'core/entities/Notice';

import type { AccountNotice, NoticeDate, NoticePage, NoticeSend } from 'core/entities/Notice';
import type { NoticeCandidate } from '#repositories/Notice';

// --- Presenters ---------------------------------------------------------------

/** The languages a notice is written in: each account's mail is in one of them. */
export const NOTICE_LOCALES = ['es-ES', 'en-GB'] as const;

export type NoticeLocale = (typeof NOTICE_LOCALES)[number];

/** One account a notice would go to, as the owner's console lists it: the address and the language it would be written in. */
export interface NoticeRecipientView {
  email: string;
  locale: string;
}

/**
 * What a send would do, with nothing sent (`POST /admin/notices/:notice/preview`):
 * the totals, the day as each language's mail will write it, and one page of the
 * accounts still owed the notice. The owner's own console, which lists addresses
 * already (`/admin/cuentas`).
 */
export interface NoticePreviewView {
  /** Accounts already told this notice: a row each in `account_notices`. */
  alreadySent: number;
  /** The day the notice was first sent for, or null while nobody has been told. A send for another day is refused. */
  campaignDate: string | null;
  /** The announced day exactly as the mail writes it, per language — for the owner to read before anything is sent. */
  dateAsWritten: Record<NoticeLocale, string>;
  /** One page of the accounts owed the notice, oldest first; `total` is `toSend`. */
  recipients: { offset: number; rows: NoticeRecipientView[]; size: number; total: number };
  /** Accounts skipped because nobody confirmed their address — it may be somebody else's typo. */
  skippedUnconfirmed: number;
  /** Accounts owed the notice: a confirmed address and no row. */
  toSend: number;
}

/**
 * What one press of the send did (`POST /admin/notices/:notice/send`): mails
 * accepted, mails not accepted (or accepted but not recorded — see `send`) and
 * to whom, accounts skipped because unconfirmed, accounts still owed after it,
 * whether the press stopped early on its time budget, and the cursor the next
 * press passes back.
 */
export interface NoticeSendView {
  /** The cursor for the next press: the last account this press tried, or null when it tried none. Pass it back as `after`. */
  after: string | null;
  failed: number;
  /** The addresses whose mail failed in this press, at most a batch — for the owner to deal with. Never logged or audited. */
  failedRecipients: { email: string }[];
  remaining: number;
  sent: number;
  skippedUnconfirmed: number;
  /** True when the press stopped starting mails on its time budget (`NOTICE_PRESS_BUDGET_MS`): press again. */
  stoppedEarly: boolean;
}

/**
 * The API's half of one mail: render the notice for this account in its own
 * language and hand it to the mail server. `accepted` is the server's answer;
 * `locale` is the language it was written in, which the row keeps.
 */
export type DeliverNotice = (account: NoticeCandidate) => Promise<{ readonly accepted: boolean; readonly locale: string }>;

// --- Rules --------------------------------------------------------------------

/** The route's `:notice`, or the 404 every unknown door gets. */
function noticeOf(raw: string): AccountNotice {
  if (!isAccountNotice(raw)) {
    throw new NotFoundError('Not Found');
  }

  return raw;
}

/**
 * The day announced must come after today, in Madrid (`textos/06` § Z: the
 * change no earlier than the next day), no more than `NOTICE_MAX_DAYS_AHEAD`
 * days ahead — a slip of the year would fix the campaign for good — and must be
 * the day the notice was first sent for: one notice, one day. Answers the day
 * it was first sent for.
 */
async function checkDate(notice: AccountNotice, date: string, now: Date): Promise<string | null> {
  const today = madridDayKey(now);

  if (date <= today) {
    throw new InputParseError('The notice must announce a day after today: it is sent before the change, never on the day', {
      date: ['not_after_today']
    });
  }

  if (date > shiftDay(today, NOTICE_MAX_DAYS_AHEAD)) {
    throw new InputParseError(`The notice may announce a day at most ${String(NOTICE_MAX_DAYS_AHEAD)} days ahead`, { date: ['too_far'] });
  }

  const campaignDate = await AccountNoticeRepository.effectiveOn(notice);

  if (campaignDate !== null && campaignDate !== date) {
    throw new InputParseError(`This notice was already sent announcing ${campaignDate}: one notice, one day`, {
      date: [`campaign_date:${campaignDate}`]
    });
  }

  return campaignDate;
}

/** How many mails this press may still send today, or the cap's refusal when none. Read under the send lock. */
async function roomToday(now: Date): Promise<number> {
  const today = madridDayKey(now);
  const tomorrow = madridMidnight(shiftDay(today, 1));
  const sent = await AccountNoticeRepository.sentBetween(madridMidnight(today), tomorrow);

  if (sent >= NOTICE_DAILY_CAP) {
    throw new NoticeDailyCapError(NOTICE_DAILY_CAP, tomorrow);
  }

  return NOTICE_DAILY_CAP - sent;
}

// --- Controller ---------------------------------------------------------------

/**
 * The owner's notice to every account (project 025 phase 10, `textos/06` § Z),
 * sent from the console in batches, once per account.
 *
 * **Who** is owed it: every account with a confirmed address and no row for
 * the notice — whatever its activation, since an account waiting for the owner
 * already accepted the terms and is covered by the policy. An unconfirmed
 * address is never mailed (it may be somebody else's typo) and is counted.
 *
 * **Once per account**: a row is written right after the mail server accepted
 * that account's mail, on its own connection, so a batch cut short keeps what
 * it recorded. The order is send, then record, on purpose. An account can
 * therefore be mailed a second, identical time in two ways, both rare: the row
 * fails to write after its mail was accepted, or the function is cut between an
 * accepted mail and its row (a deploy, a crash, the platform's own time limit).
 * In both the account stays owed and a later press mails it again — the lesser
 * failure than a notice recorded as sent that never left.
 *
 * **The shared mailbox**: at most `NOTICE_DAILY_CAP` notice mails a Madrid day,
 * every notice together, so the confirmation links, resets and badge codes that
 * leave through the same SMTP account always have room.
 */
export const NoticeController = {
  /**
   * Who a send would mail, and the counts — nothing sent, nothing written. The
   * totals come from one count; the list is one page, and only that page's
   * languages are read (`localeOf`, the language each mail would be in).
   */
  async preview(
    rawNotice: string,
    input: NoticeDate,
    page: NoticePage,
    localeOf: (userId: string) => Promise<string>,
    now: Date = new Date()
  ): Promise<NoticePreviewView> {
    const notice = noticeOf(rawNotice);
    const campaignDate = await checkDate(notice, input.date, now);
    const [counts, candidates] = await Promise.all([
      AccountNoticeRepository.counts(notice),
      AccountNoticeRepository.candidates(notice, { limit: page.size, offset: page.offset })
    ]);
    const rows = await Promise.all(candidates.map(async account => ({ email: account.email, locale: await localeOf(account.id) })));

    return {
      alreadySent: counts.alreadySent,
      campaignDate,
      dateAsWritten: { 'en-GB': madridLongDay(input.date, 'en-GB'), 'es-ES': madridLongDay(input.date, 'es-ES') },
      recipients: { offset: page.offset, rows, size: page.size, total: counts.toSend },
      skippedUnconfirmed: counts.unconfirmed,
      toSend: counts.toSend
    };
  },

  /**
   * One press: the next accounts owed the notice — at most `NOTICE_BATCH_SIZE`,
   * and no more than the daily cap leaves — after the `after` cursor the last
   * press answered (from the oldest again when nothing is owed after it), one
   * after the other, each re-read just before its mail: an account deleted
   * meanwhile is skipped, one whose address is no longer confirmed too.
   *
   * A mail the server did not accept writes no row, is counted, and its address
   * goes back in `failedRecipients`; the press carries on, and that account is
   * not tried again in it. The cursor moves past every account the press tried,
   * so a run of addresses the server always refuses is tried once a round and
   * never holds the rest back. A row that cannot be written after an accepted
   * mail is counted as failed and ends the press (the database is failing).
   *
   * No mail is started once the press has run `NOTICE_PRESS_BUDGET_MS`
   * (`stoppedEarly`). One audit row per completed press, with the counts and
   * never an address.
   *
   * A 409 when another press is running (both would pick the same accounts),
   * and `NoticeDailyCapError` once today's cap is spent.
   */
  async send(
    rawNotice: string,
    ownerId: string,
    input: NoticeSend,
    deliver: DeliverNotice,
    now: Date = new Date(),
    clock: () => number = Date.now
  ): Promise<NoticeSendView> {
    const notice = noticeOf(rawNotice);

    await checkDate(notice, input.date, now);

    const answer = await AccountNoticeRepository.exclusively(async (): Promise<NoticeSendView> => {
      const started = clock();

      // Read again under the lock: a press that finished a moment ago may have fixed the day, or spent the cap.
      await checkDate(notice, input.date, now);

      const limit = Math.min(NOTICE_BATCH_SIZE, await roomToday(now));
      const afterCursor = input.after === undefined ? [] : await AccountNoticeRepository.candidates(notice, { after: input.after, limit });
      const batch = afterCursor.length > 0 ? afterCursor : await AccountNoticeRepository.candidates(notice, { limit });

      let sent = 0;
      let after: string | null = null;
      let stoppedEarly = false;
      const failedRecipients: { email: string }[] = [];

      for (const candidate of batch) {
        if (clock() - started >= NOTICE_PRESS_BUDGET_MS) {
          stoppedEarly = true;
          break;
        }

        after = candidate.id;

        const account = await UserRepository.findById(candidate.id);

        if (!account?.emailVerified) {
          continue;
        }

        const delivered = await deliver({ id: account.id, email: account.email }).catch(() => ({ accepted: false, locale: '' }));

        if (!delivered.accepted) {
          failedRecipients.push({ email: account.email });
          continue;
        }

        try {
          await AccountNoticeRepository.record(account.id, notice, { effectiveOn: input.date, locale: delivered.locale, sentAt: new Date() });
          sent += 1;
        } catch {
          // Deleted between its mail and its row: it was told, and nothing is owed to an account that is gone.
          if (!(await UserRepository.findById(account.id).catch(() => account))) {
            sent += 1;
            continue;
          }

          failedRecipients.push({ email: account.email });
          break;
        }
      }

      const counts = await AccountNoticeRepository.counts(notice);
      const failed = failedRecipients.length;

      await AuditRepository.record({
        action: 'notice.sent',
        actorId: ownerId,
        entity: 'notice',
        entityId: notice,
        metadata: { date: input.date, failed, notice, remaining: counts.toSend, sent, skippedUnconfirmed: counts.unconfirmed }
      });

      return { after, failed, failedRecipients, remaining: counts.toSend, sent, skippedUnconfirmed: counts.unconfirmed, stoppedEarly };
    });

    if (answer === null) {
      throw new ConflictError('A notice is being sent from another press; wait for it to finish');
    }

    return answer;
  }
};

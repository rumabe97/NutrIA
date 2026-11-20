import { AccountNoticeRepository } from '#repositories/Notice';
import { AuditRepository } from '#repositories/Audit';
import { UserRepository } from '#repositories/User';
import { madridDayKey } from 'core/domain/Period';
import { ConflictError, InputParseError, NotFoundError } from 'core/entities/Error';
import { isAccountNotice, NOTICE_BATCH_SIZE } from 'core/entities/Notice';

import type { AccountNotice, NoticeDate } from 'core/entities/Notice';
import type { NoticeCandidate } from '#repositories/Notice';

// --- Presenters ---------------------------------------------------------------

/** One account a notice would go to, as the owner's console lists it: the address and the language it would be written in. */
export interface NoticeRecipientView {
  email: string;
  locale: string;
}

/**
 * What a send would do, with nothing sent (`POST /admin/notices/:notice/preview`):
 * the counts, and every account still owed the notice. The owner's own console,
 * which lists addresses already (`/admin/cuentas`).
 */
export interface NoticePreviewView {
  /** Accounts already told this notice: a row each in `account_notices`. */
  alreadySent: number;
  /** The day the notice was first sent for, or null while nobody has been told. A send for another day is refused. */
  campaignDate: string | null;
  recipients: NoticeRecipientView[];
  /** Accounts skipped because nobody confirmed their address — it may be somebody else's typo. */
  skippedUnconfirmed: number;
  /** Accounts owed the notice: a confirmed address and no row. `recipients` lists them all. */
  toSend: number;
}

/**
 * What one press of the send did (`POST /admin/notices/:notice/send`): mails
 * accepted, mails not accepted (or accepted but not recorded — see `send`),
 * accounts skipped because unconfirmed, and accounts still owed the notice after it.
 */
export interface NoticeSendView {
  failed: number;
  remaining: number;
  sent: number;
  skippedUnconfirmed: number;
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
 * change no earlier than the next day), and must be the day the notice was
 * first sent for: one notice, one day. Answers the day it was first sent for.
 */
async function checkDate(notice: AccountNotice, date: string, now: Date): Promise<string | null> {
  if (date <= madridDayKey(now)) {
    throw new InputParseError('The notice must announce a day after today: it is sent before the change, never on the day', {
      date: ['not_after_today']
    });
  }

  const campaignDate = await AccountNoticeRepository.effectiveOn(notice);

  if (campaignDate !== null && campaignDate !== date) {
    throw new InputParseError(`This notice was already sent announcing ${campaignDate}: one notice, one day`, {
      date: [`campaign_date:${campaignDate}`]
    });
  }

  return campaignDate;
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
 * it recorded. The order is send, then record, on purpose: if the record fails
 * after an accepted mail, the account stays owed and a later press mails it
 * again — a second identical mail, rare, rather than a notice that was never
 * sent but is recorded as sent, which is the worse failure.
 */
export const NoticeController = {
  /** Who a send would mail, and the counts — nothing sent, nothing written. `localeOf` is the language each mail would be in. */
  async preview(
    rawNotice: string,
    input: NoticeDate,
    localeOf: (userId: string) => Promise<string>,
    now: Date = new Date()
  ): Promise<NoticePreviewView> {
    const notice = noticeOf(rawNotice);
    const campaignDate = await checkDate(notice, input.date, now);
    const [counts, candidates] = await Promise.all([AccountNoticeRepository.counts(notice), AccountNoticeRepository.candidates(notice)]);
    const recipients = await Promise.all(candidates.map(async account => ({ email: account.email, locale: await localeOf(account.id) })));

    return { alreadySent: counts.alreadySent, campaignDate, recipients, skippedUnconfirmed: counts.unconfirmed, toSend: counts.toSend };
  },

  /**
   * One press: the next `NOTICE_BATCH_SIZE` accounts owed the notice, one after
   * the other, each re-read just before its mail — an account deleted meanwhile
   * is skipped, one whose address is no longer confirmed too. A mail the server
   * did not accept writes no row and is counted as failed; the account stays
   * owed. A row that cannot be written after an accepted mail is counted as
   * failed too and ends the press (the database is failing; the account stays
   * owed and will be mailed again — see the controller's note). One audit row
   * per press, with the counts and never an address.
   *
   * A 409 when another press of the same notice is running: both would pick the
   * same accounts.
   */
  async send(rawNotice: string, ownerId: string, input: NoticeDate, deliver: DeliverNotice, now: Date = new Date()): Promise<NoticeSendView> {
    const notice = noticeOf(rawNotice);

    await checkDate(notice, input.date, now);

    const answer = await AccountNoticeRepository.exclusively(notice, async (): Promise<NoticeSendView> => {
      // Read again under the lock: a press that finished a moment ago may have fixed the day.
      await checkDate(notice, input.date, now);

      let sent = 0;
      let failed = 0;

      for (const candidate of await AccountNoticeRepository.candidates(notice, NOTICE_BATCH_SIZE)) {
        const account = await UserRepository.findById(candidate.id);

        if (!account?.emailVerified) {
          continue;
        }

        const delivered = await deliver({ id: account.id, email: account.email }).catch(() => ({ accepted: false, locale: '' }));

        if (!delivered.accepted) {
          failed += 1;
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

          failed += 1;
          break;
        }
      }

      const counts = await AccountNoticeRepository.counts(notice);
      const view = { failed, remaining: counts.toSend, sent, skippedUnconfirmed: counts.unconfirmed };

      await AuditRepository.record({
        action: 'notice.sent',
        actorId: ownerId,
        entity: 'notice',
        entityId: notice,
        metadata: { ...view, date: input.date, notice }
      });

      return view;
    });

    if (answer === null) {
      throw new ConflictError('This notice is being sent from another press; wait for it to finish');
    }

    return answer;
  }
};

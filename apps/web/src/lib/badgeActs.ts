import type { BadgeRecordView } from 'core/controllers/Professional';

/**
 * What the owner may do on one practitioner's badge page, read off the record
 * (project 025 phase 9). The API answers a 404 to every act without its
 * precondition, so the page draws an act only when it holds (the rules are
 * `ProfessionalBadgeController`'s: `confirm` needs a code entered for an
 * application or a badge to renew; `fail` needs an application waiting;
 * `withdrawn` needs a badge that stands; a code needs an application or a badge).
 *
 * - `application`: a request waits. A code may be sent; the badge can be given
 *   once the person has entered it; the request can be refused.
 * - `standing`: a badge stands. When its yearly check is due it can be renewed
 *   (a code is optional); at any time it can be withdrawn.
 * - `nothing`: no request and no badge. There is only the record to read.
 */
export type BadgeMode = 'application' | 'nothing' | 'standing';

export interface BadgeActs {
  /** The badge can be given (or the yearly check confirmed) now. */
  canConfirm: boolean;
  /** A code can be sent. */
  canSendCode: boolean;
  mode: BadgeMode;
  /** Which removal applies, or null: `fail` for a request, `withdrawn` for a badge. */
  removal: 'fail' | 'withdrawn' | null;
}

export function badgeActs(record: Pick<BadgeRecordView, 'application' | 'badge' | 'code' | 'state'>): BadgeActs {
  if (record.application !== null) {
    return { canConfirm: record.code?.entered === true, canSendCode: true, mode: 'application', removal: 'fail' };
  }

  if (record.badge !== null && (record.state === 'badged' || record.state === 'due')) {
    return { canConfirm: record.state === 'due', canSendCode: record.state === 'due', mode: 'standing', removal: 'withdrawn' };
  }

  return { canConfirm: false, canSendCode: false, mode: 'nothing', removal: null };
}

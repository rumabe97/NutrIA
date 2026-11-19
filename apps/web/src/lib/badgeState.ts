import { interpolate } from './format';

import type { BadgeView } from 'core/controllers/Professional';
import type { Dictionary } from 'i18n/dictionaries/es-ES';

/**
 * Where a practitioner's badge stands, in the approved words of
 * `docs/legal/textos/01` § Pantallas P3 (`practice.badgeState.*`), and — after a
 * refusal, a withdrawal or a lapse — the reason in the words of its statement
 * (`textos/06` §§ V and W), so the practitioner's own page says it whatever
 * happened to the mail. `day` formats an instant as a date in the reader's
 * language.
 */

type Day = (iso: string) => string;

/** A badge that stands now: the only state in which the title may be drawn (PRD 025 criterion 5). */
export function badgeStands(badge: Pick<BadgeView, 'state'> | null): boolean {
  return badge?.state === 'badged' || badge?.state === 'due';
}

export function badgeSentence(badge: BadgeView, t: Dictionary['practice'], day: Day): string {
  const states = t.badgeState;

  switch (badge.state) {
    case 'applied':
      return states.applied;
    case 'badged':
      return interpolate(states.badged, { date: badge.checkedAt ? day(badge.checkedAt) : '' });
    case 'code_sent':
      return badge.codeEntered ? t.badgeCodeDone : interpolate(states.codeSent, { date: badge.codeExpiresAt ? day(badge.codeExpiresAt) : '' });
    case 'due':
      return interpolate(states.due, { date: badge.lapsesAt ? day(badge.lapsesAt) : '' });
    case 'lapsed':
      return states.lapsed;
    case 'refused':
      return states.refused;
    case 'withdrawn':
      return states.withdrawn;
    default:
      return states.none;
  }
}

/**
 * The reason for the owner's latest decision, or null with none to give: each
 * closed code in its statement's sentence, then the owner's own facts. The
 * register's sentence needs the register and the number it names; without
 * either, only the facts are said.
 */
export function badgeReason(badge: BadgeView, t: Dictionary['practice'], day: Day): string | null {
  const { decision } = badge;

  if (!decision) {
    return null;
  }

  const reasons = t.badgeReasons;
  let sentence: string;

  switch (decision.reason) {
    case 'not_on_register':
      sentence =
        badge.register && badge.number
          ? interpolate(reasons.not_on_register, { checkedOn: day(decision.at), number: badge.number, register: badge.register })
          : '';
      break;
    case 'not_me':
    case 'code_expired':
    case 'code_not_entered':
    case 'our_delay':
      sentence = reasons[decision.reason];
      break;
    case null:
      sentence = decision.kind === 'lapsed' ? reasons.unconfirmed : '';
      break;
    default:
      sentence = '';
  }

  const reason = [sentence, decision.facts ?? ''].filter(Boolean).join(' ');

  return reason ? interpolate(t.why, { reason }) : null;
}

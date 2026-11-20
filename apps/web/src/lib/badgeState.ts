import { asSentence } from 'core/domain/OwnerText';

import { aroundFacts } from './ownerFacts';
import { interpolate } from './format';

import type { BadgeView } from 'core/controllers/Professional';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { WithFacts } from './ownerFacts';

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
      // The screen's own variant (`textos/01` § P5): the mail's «desde hoy» is true only the day it arrives.
      return interpolate(states.withdrawnScreen, { date: badge.decision ? day(badge.decision.at) : '' });
    default:
      return states.none;
  }
}

/**
 * The reason for the owner's latest decision, or null with none to give: each
 * closed code in its statement's sentence (`textos/06` § W `reason`, § V `why` and
 * `detail`), named from what the decided check recorded (`decision.register`,
 * `decision.number`, `decision.dueAt`), then the owner's own facts, kept apart to be
 * marked with their language. Where the decision came from (own review, a notice)
 * stays in the mail.
 */
export function badgeReason(badge: BadgeView, t: Dictionary['practice'], day: Day): WithFacts | null {
  const { decision } = badge;

  if (!decision) {
    return null;
  }

  const reasons = t.badgeReasons;
  let sentence: string;

  switch (decision.reason) {
    case 'not_on_register':
      sentence =
        decision.register && decision.number
          ? interpolate(reasons.not_on_register, { checkedOn: day(decision.at), number: decision.number, register: decision.register })
          : '';
      break;
    case 'not_me':
    case 'code_expired':
      sentence = reasons[decision.reason];
      break;
    case 'code_not_entered':
    case 'our_delay':
    case null:
      sentence = decision.kind === 'lapsed' ? lapse(decision, t, day) : '';
      break;
    default:
      sentence = '';
  }

  if (!sentence && !decision.facts) {
    return null;
  }

  // The owner's facts closed as a sentence, by the one rule the mail uses (`core/domain/OwnerText`).
  return aroundFacts(
    t.why.replace('{reason}', [sentence, '{facts}'].filter(Boolean).join(' ')),
    {},
    decision.facts ? asSentence(decision.facts) : null
  );
}

/** § V: the check that was due, then which of its three details. */
function lapse(decision: NonNullable<BadgeView['decision']>, t: Dictionary['practice'], day: Day): string {
  const detail =
    decision.reason === 'code_not_entered' || decision.reason === 'our_delay' ? t.badgeReasons[decision.reason] : t.badgeReasons.unconfirmed;

  return decision.dueAt ? `${interpolate(t.badgeLapseWhy, { dueDate: day(decision.dueAt) })} ${detail}` : detail;
}

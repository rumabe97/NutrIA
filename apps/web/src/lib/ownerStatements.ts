import { aroundFacts } from './ownerFacts';
import { interpolate } from './format';

import type { BadgeCheckView } from 'core/controllers/Professional';
import type { BadgeRemovalReason, BadgeRemovalSource, ProfileHideReason, RestrictionSource } from 'core/entities/Professional';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { WithFacts } from './ownerFacts';

/**
 * The statements of reasons the owner composes in the console (project 025
 * phase 9), as the person will read them: the API's mails build the same
 * sentences from `docs/legal/textos/06` §§ W, W bis and X, and these functions
 * put the approved sentences in the same order so that what he picks is what is
 * sent. The facts are the owner's own words, kept apart (`WithFacts`) so a page
 * can mark them with their language.
 *
 * Nothing here decides anything: the closed reasons, their order and the full
 * stop after the facts are the mail's, and a test holds the two to each other.
 */

/** The owner's words as one plain line: control characters and markup out, whitespace folded — what the mail prints. */
export function plainFacts(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- the owner's words are one plain paragraph
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** The facts as a sentence of their own: closed with a full stop when the owner did not close it (`asSentence` of the mail). */
export function asSentence(text: string): string {
  const plain = plainFacts(text);

  return plain === '' || /[.!?…»"”)]$/.test(plain) ? plain : `${plain}.`;
}

/** The facts as the end of somebody else's sentence (§ W bis.2 «Lo hemos revisado y {facts}.»): no stop of their own. */
export function asClause(text: string): string {
  return plainFacts(text).replace(/[.\s]+$/, '');
}

/** A closed sentence followed by the owner's facts: the mail joins the parts with one space. */
function reasonOf(sentences: readonly string[], facts: string | null): { facts: string | null; reason: string } {
  const parts = [...sentences.filter(sentence => sentence !== ''), ...(facts === null || facts === '' ? [] : ['{facts}'])];

  return { facts: facts === null || facts === '' ? null : facts, reason: parts.join(' ') };
}

/** § W: not giving a badge, or taking it back — what the person reads first, and why. */
export function badgeRemovalStatement(
  t: Dictionary,
  input: {
    checkedOn: string;
    facts: string;
    kind: 'fail' | 'withdrawn';
    number: string;
    reason: BadgeRemovalReason;
    register: string;
    source: BadgeRemovalSource;
  }
): { what: string; why: WithFacts } {
  const reasons = t.practice.badgeReasons;
  const closed =
    input.reason === 'other'
      ? ''
      : interpolate(reasons[input.reason], { checkedOn: input.checkedOn, number: input.number, register: input.register });
  // `trim`, not `asSentence`: § W's mail adds the facts as they were written.
  const facts = input.facts.trim() === '' ? null : input.facts.trim();
  const { facts: kept, reason } = reasonOf([closed], facts);
  const statement = t.adminStatements.badge;

  return { what: statement.what[input.kind], why: aroundFacts(statement.why, { reason, source: statement.sources[input.source] }, kept) };
}

/** § X: hiding a profile — the closed reasons in the mail's order, the word quoted, the owner's facts, and whether a notice set it off. */
export function hideStatement(
  t: Dictionary,
  input: { afterNotice: boolean; facts: string; reasons: readonly ProfileHideReason[]; word: string }
): { what: string; why: WithFacts } {
  const copy = t.adminProfiles.hide;
  const word = plainFacts(input.word);
  const order = Object.keys(t.practice.profileHiddenReasons) as ProfileHideReason[];
  const closed = order.filter(reason => input.reasons.includes(reason)).map(reason => interpolate(t.practice.profileHiddenReasons[reason], { word }));
  const facts = plainFacts(input.facts) === '' ? null : asSentence(input.facts);
  const { facts: kept, reason } = reasonOf(closed, facts);

  return { what: copy.what, why: aroundFacts(copy.why, { noticeSuffix: input.afterNotice ? copy.noticeSuffix : '', reason }, kept) };
}

/** § W bis.1 and 3: the facts, § 13 and the clause read with it, and where the decision came from. */
export function restrictionStatement(
  t: Dictionary,
  input: { authority: string | null; clause: number | null; facts: string; source: RestrictionSource }
): WithFacts {
  const practice = t.practice;
  const authority = input.authority === null ? '' : plainFacts(input.authority);
  const facts = plainFacts(input.facts) === '' ? null : asSentence(input.facts);

  return aroundFacts(
    practice.restrictionWhy,
    {
      clause: input.clause === null ? '' : interpolate(practice.restrictionClause, { n: String(input.clause) }),
      reason: facts === null ? '' : '{facts}',
      source: interpolate(practice.restrictionSources[input.source], { authority })
    },
    facts
  );
}

/** What a lift tells the person, by what stood (§ W bis.2 and 4): a suspension, a close not yet carried out, or one that was. */
export type LiftKind = 'closeAfter' | 'closeBefore' | 'suspension';

export function liftStatement(t: Dictionary, input: { closeDate: string; facts: string; kind: LiftKind; suspended: boolean }): WithFacts {
  const copy = t.adminStatements.lift;
  const clause = asClause(input.facts);
  // One pass: `{why}` becomes «Lo hemos revisado y {facts}.» with its own `{facts}` left for `aroundFacts` to split at.
  const filled = interpolate(copy[input.kind], {
    closeDate: input.closeDate,
    liftedSuffix: input.suspended ? copy.liftedSuffix : '',
    why: clause === '' ? '' : copy.why
  }).trim();

  return aroundFacts(filled, {}, clause === '' ? null : clause);
}

/** A badge check's reason as the record keeps it: `code` or `code: facts`, split the way the controller joins them. */
export function parseCheckReason(stored: string | null): { code: string | null; facts: string | null } {
  if (stored === null || stored === '') {
    return { code: null, facts: null };
  }

  const split = stored.indexOf(': ');
  const head = split === -1 ? stored : stored.slice(0, split);
  const known = ['code_expired', 'code_not_entered', 'not_me', 'not_on_register', 'other', 'our_delay'];

  if (!known.includes(head)) {
    return { code: null, facts: stored };
  }

  return { code: head, facts: split === -1 ? null : stored.slice(split + 2) };
}

/** One check of the record, in the approved sentence of its closed reason, then the owner's facts. Null with nothing to say. */
export function checkReason(
  t: Dictionary,
  check: Pick<BadgeCheckView, 'checkedAt' | 'number' | 'reason' | 'register'>,
  day: (iso: string) => string
): WithFacts | null {
  const { code, facts } = parseCheckReason(check.reason);
  const reasons = t.practice.badgeReasons;
  let sentence = '';

  switch (code) {
    case 'code_expired':
    case 'code_not_entered':
    case 'not_me':
    case 'our_delay':
      sentence = reasons[code];
      break;
    case 'not_on_register':
      sentence = interpolate(reasons.not_on_register, {
        checkedOn: day(check.checkedAt),
        number: check.number ?? '',
        register: check.register ?? ''
      });
      break;
    default:
      break;
  }

  if (sentence === '' && facts === null) {
    return null;
  }

  const { facts: kept, reason } = reasonOf([sentence], facts);

  return aroundFacts(reason, {}, kept);
}

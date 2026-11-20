import { asSentence, plainFacts } from 'core/domain/OwnerText';

import { aroundFacts } from './ownerFacts';
import { interpolate } from './format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { PracticeRestrictionView, RestrictionStatementView } from 'core/controllers/Professional';
import type { WithFacts } from './ownerFacts';

type Day = (iso: string) => string;

/**
 * The statement of reasons, in the words of its mail (`textos/06` § W bis.1 `why`), from what
 * the API stored — the owner's facts kept apart, to be marked with their language (`WithFacts`).
 */
function why(statement: RestrictionStatementView, t: Dictionary['practice']): WithFacts {
  const filled = aroundFacts(
    t.restrictionWhy.replace('{reason}', '{facts}'),
    {
      clause: statement.clause === null ? '' : interpolate(t.restrictionClause, { n: statement.clause }),
      source:
        // The authority's name stays a placeholder, marked with its language on the page.
        t.restrictionSources[statement.source]
    },
    asSentence(statement.facts)
  );

  return statement.source === 'authority' ? { ...filled, authority: plainFacts(statement.authority ?? '') } : filled;
}

/**
 * What the owner has standing against a practice (PRD 025 scope 16), as the
 * practice's own page says it: the close and the suspension in the approved
 * words of their statements (`docs/legal/textos/06` § W bis.3 and § W bis.1),
 * each followed by its reasons and the way to ask for a review
 * (`practice.restrictionRedress`, `textos/01` § P5). The suspension is the
 * screen's own variant, dated, because the mail's «desde hoy» is true only the day
 * it arrives. A close whose day has come says only that, with its way back: the
 * notice's future tense would no longer be true, and a suspension under it no
 * longer matters.
 *
 * Sentences that name the address keep `{email}` for `MailtoText` to draw as a link.
 */
export function restrictionParagraphs(restriction: PracticeRestrictionView, t: Dictionary['practice'], day: Day): (string | WithFacts)[] {
  const { closing, suspended } = restriction;

  if (closing?.closed) {
    return [interpolate(t.restrictionClosed, { date: day(closing.closesAt) })];
  }

  const paragraphs: (string | WithFacts)[] = [];

  if (closing) {
    paragraphs.push(
      interpolate(t.restrictionClosing, { closeDate: day(closing.closesAt), suspendedSuffix: suspended ? t.restrictionSuspendedSuffix : '' })
    );

    if (closing.statement) {
      paragraphs.push(why(closing.statement, t), t.restrictionRedress);
    }
  }

  if (suspended) {
    paragraphs.push(interpolate(t.restrictionSuspendedScreen, { date: day(suspended.since) }));

    if (suspended.statement) {
      paragraphs.push(why(suspended.statement, t), t.restrictionRedress);
    }
  }

  return paragraphs;
}

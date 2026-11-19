import { interpolate } from './format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { PracticeRestrictionView, RestrictionStatementView } from 'core/controllers/Professional';

type Day = (iso: string) => string;

/** The statement of reasons, in the words of its mail (`textos/06` § W bis.1 `why`), from what the API stored. */
function why(statement: RestrictionStatementView, t: Dictionary['practice']): string {
  return interpolate(t.restrictionWhy, {
    clause: statement.clause === null ? '' : interpolate(t.restrictionClause, { n: statement.clause }),
    reason: statement.facts,
    source:
      statement.source === 'authority'
        ? interpolate(t.restrictionSources.authority, { authority: statement.authority ?? '' })
        : t.restrictionSources[statement.source]
  });
}

/**
 * What the owner has standing against a practice (PRD 025 scope 16), as the
 * practice's own page says it: the close and the suspension in the approved
 * words of their statements (`docs/legal/textos/06` § W bis.3 and § W bis.1),
 * each followed by its reasons. A close whose day has come says only the day:
 * the notice's future tense would no longer be true, and a suspension under it
 * no longer matters.
 */
export function restrictionParagraphs(restriction: PracticeRestrictionView, t: Dictionary['practice'], day: Day): string[] {
  const { closing, suspended } = restriction;

  if (closing?.closed) {
    return [interpolate(t.restrictionClosed, { date: day(closing.closesAt) })];
  }

  const paragraphs: string[] = [];

  if (closing) {
    paragraphs.push(
      interpolate(t.restrictionClosing, { closeDate: day(closing.closesAt), suspendedSuffix: suspended ? t.restrictionSuspendedSuffix : '' })
    );

    if (closing.statement) {
      paragraphs.push(why(closing.statement, t));
    }
  }

  if (suspended) {
    paragraphs.push(t.restrictionSuspended);

    if (suspended.statement) {
      paragraphs.push(why(suspended.statement, t));
    }
  }

  return paragraphs;
}

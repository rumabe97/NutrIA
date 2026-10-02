'use client';
import { Fragment, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from 'ui/components/Button';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { MealSizeNote } from 'components/MealSizeNote';

import { hasMealSizeAnswer, mealSizeBody, rememberMealSizeAnswer, subscribeMealSizeAnswers } from 'lib/mealSize';

interface ProfileMealSizeNoteProps {
  /** `mealSizeKey` of the biggest main meal and the shape. */
  answerKey: string;
  /** How many meals a day the shape has. */
  count: number;
  kcal: number;
}

/** The server cannot know what this browser remembers, so it draws nothing. */
function hiddenOnServer(): boolean {
  return true;
}

/**
 * The note from `/plan/generando`, on the profile, until it is dismissed.
 * Dismissed is remembered against the shape and the figure, so it comes back
 * when either changes.
 */
export function ProfileMealSizeNote({ answerKey, count, kcal }: ProfileMealSizeNoteProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const dismissed = useSyncExternalStore(subscribeMealSizeAnswers, () => hasMealSizeAnswer('dismissed', answerKey), hiddenOnServer);

  const holder = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState(false);

  function dismiss() {
    rememberMealSizeAnswer('dismissed', answerKey);
    setSaid(true);
    // The button that was pressed leaves with the note: focus goes to the holder,
    // which stays, rather than to the top of the document.
    holder.current?.focus();
  }

  return (
    <div ref={holder} tabIndex={-1}>
      {/* In the page before its text changes, so the dismissal is announced. */}
      <p className="visually-hidden" role="status">
        {said ? dictionary.mealSize.dismissed : ''}
      </p>
      {dismissed ? null : (
        <MealSizeNote
          actions={
            <Fragment>
              <CtaLink href="/onboarding/4?volver=perfil" variant="secondary">
                {dictionary.mealSize.add}
              </CtaLink>
              <Button onClick={dismiss} type="button" variant="secondary">
                {dictionary.mealSize.understood}
              </Button>
            </Fragment>
          }
          body={mealSizeBody(dictionary, locale, count, kcal)}
          heading="h3"
          title={dictionary.mealSize.title}
        />
      )}
    </div>
  );
}

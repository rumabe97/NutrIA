import { useId } from 'react';

import styles from './MealSizeNote.module.css';

import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import type { ReactNode } from 'react';

interface MealSizeNoteProps {
  /** The note's own actions, drawn under the words; none when the screen has its own row. */
  actions?: ReactNode;
  body: string;
  /** `h2` under a page's `h1`; `h3` where a section's own `h2` comes before it, as on the profile. */
  heading?: 'h2' | 'h3';
  title: string;
}

/**
 * "Your meals will be big" — said before the plan exists and again on the profile,
 * with the numbers in the words and the way out beside them. The words are
 * the caller's, so the same card serves both screens.
 */
export function MealSizeNote({ actions, body, heading: Heading = 'h2', title }: MealSizeNoteProps) {
  const dictionary = useDictionary();
  const titleId = useId();

  return (
    <Note aria-labelledby={titleId} as="section" toneLabel={dictionary.common.noteTone.info}>
      <Heading className={styles.title} id={titleId}>
        {title}
      </Heading>
      <Text tone="secondary">{body}</Text>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </Note>
  );
}

import styles from './StatementPreview.module.css';

import { Text } from 'ui/components/Text';

import { OwnerFacts } from 'components/OwnerFacts';

import type { WithFacts } from 'lib/ownerFacts';

interface StatementPreviewProps {
  /** Who gets it, and in which language. */
  note: string;
  /** **Required.** "Lo que leerá la persona". */
  title: string;
  /** The approved sentence that says what is decided, when it is a sentence of its own. */
  what?: string;
  /** The approved sentences that say why, with the owner's facts inside them. */
  why: WithFacts;
}

/**
 * The statement of reasons as the person will read it, drawn before the owner
 * confirms an act that sends one (project 025 phase 9): what he picks is an
 * approved sentence, so he sees the sentence and not a paraphrase of it. A
 * quotation, not an instruction: it sits in its own sunken block with the title
 * above it, and his facts inside it are marked with their language.
 */
export function StatementPreview({ note, title, what, why }: StatementPreviewProps) {
  return (
    <figure className={styles.preview}>
      <figcaption className={styles.title}>{title}</figcaption>
      <blockquote className={styles.quote}>
        {what ? <p>{what}</p> : null}
        <p>
          <OwnerFacts value={why} />
        </p>
      </blockquote>
      <Text size="xs" tone="secondary">
        {note}
      </Text>
    </figure>
  );
}

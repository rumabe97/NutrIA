import styles from './HowCounted.module.css';

interface HowCountedProps {
  /** One paragraph per caveat: what a figure counts, or what it does not. */
  notes: readonly string[];
  /** The disclosure's words ("Cómo se cuenta"). */
  summary: string;
}

/**
 * The caveats behind a console page's figures, folded until somebody asks (`0068`):
 * the page keeps a one-line description, and what would otherwise be a paragraph
 * over every section waits here. Only real caveats — a figure that could be read
 * wrongly without them.
 */
export function HowCounted({ notes, summary }: HowCountedProps) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </summary>
      <ul className={styles.notes}>
        {notes.map(note => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  );
}

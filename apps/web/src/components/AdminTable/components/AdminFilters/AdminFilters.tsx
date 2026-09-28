'use client';
import { useState } from 'react';

import styles from './AdminFilters.module.css';

import type { ReactNode } from 'react';

interface AdminFiltersProps {
  /** How many filters the address sets now. */
  active: number;
  /** The filters, drawn on the server. */
  children: ReactNode;
  /** The disclosure's words, with the count in them: "Filtros (2 activos)". */
  summary: string;
}

/**
 * A table's filters, folded (`0068`): with six of them the toolbar was taller than a
 * phone at large text. The search, the page size and "Aplicar" stay out; this holds
 * the rest, and says how many are on.
 *
 * A native `<details>`, so it opens and submits with the form without JavaScript. It
 * starts open when a filter is on, so what narrows the table is in view. After that the
 * person decides: turning the last filter off does not snap it shut under their hands
 * (with focus inside it), and a filter that comes on — the back button — opens it again.
 */
export function AdminFilters({ active, children, summary }: AdminFiltersProps) {
  const [open, setOpen] = useState(active > 0);
  const [seen, setSeen] = useState(active);

  // Adjusted while rendering, not in an effect, so the fold never draws closed for a frame.
  if (seen !== active) {
    setSeen(active);

    if (active > 0) {
      setOpen(true);
    }
  }

  return (
    <details className={styles.details} onToggle={event => setOpen(event.currentTarget.open)} open={open}>
      <summary className={styles.summary}>
        <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </summary>
      <div className={styles.fields}>{children}</div>
    </details>
  );
}

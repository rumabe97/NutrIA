'use client';
import { useEffect, useRef } from 'react';

import { focusIsLost, TABLE_STATUS_ID } from '../../tableStatus';

interface AdminTableStatusProps {
  /** What the table shows now: "12 en total · por fecha de alta, descendente". */
  children: string;
  className?: string;
  /**
   * Changes whenever the table does — the address and the rows on screen. After such a
   * change, if focus fell to the page (the pager link that took you to page 1 is not
   * drawn there; "Quitar la búsqueda y los filtros" is gone once nothing is filtered; a
   * row that no longer matches left with its button), it lands here.
   */
  version: string;
}

/**
 * The line over a console table: a polite live region that says how many rows match and
 * in what order, and the place focus picks up from when what held it has gone. Focusable
 * from script only (`tabIndex={-1}`): it is not a control.
 */
export function AdminTableStatus({ children, className, version }: AdminTableStatusProps) {
  const line = useRef<HTMLParagraphElement>(null);
  const seen = useRef(version);

  useEffect(() => {
    if (seen.current === version) {
      return;
    }

    seen.current = version;

    if (focusIsLost()) {
      line.current?.focus();
    }
  }, [version]);

  return (
    <p className={className} id={TABLE_STATUS_ID} ref={line} role="status" tabIndex={-1}>
      {children}
    </p>
  );
}

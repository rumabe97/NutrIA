/** The id of a console table's status line. One table per page, so one id. */
export const TABLE_STATUS_ID = 'tabla-estado';

/** Whether focus has fallen to the page: nothing, or the body, holds it. */
export function focusIsLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

/**
 * Sends focus to the line over the table ("12 en total · por alta, descendente").
 *
 * For when what held focus has gone — a row that left the table, a pager link that is
 * no longer drawn: the line is where the table's new state is said, so it is the place
 * to pick up from, and a screen reader reads it on arrival.
 */
export function focusTableStatus(): void {
  document.getElementById(TABLE_STATUS_ID)?.focus();
}

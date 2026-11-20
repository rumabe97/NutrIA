'use client';
import { useEffect, useRef } from 'react';

import styles from './NoticeRecipients.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { AdminReflowTable } from 'components/AdminReflowTable';

import { formatNumber, interpolate } from 'lib/format';

import type { NoticePreviewView } from 'core/controllers/Notice';

interface NoticeRecipientsProps {
  /** The page to read: the offset of its first row. The list belongs to the preview, so it is asked for again, never kept in the address. */
  onPage: (offset: number) => void;
  /** A page is being read. */
  pending: boolean;
  recipients: NoticePreviewView['recipients'];
}

/**
 * The accounts the notice would go to, one page at a time (the console's reflow table:
 * a table on a wide screen, a card per row on a phone). The pager is two buttons, not
 * links: the list is the answer of a preview for one day, and no address of it may
 * reach the URL, the history or a log. Once the page has arrived, focus is on the button
 * pressed, or on the other one when the end it led to has no further page.
 */
export function NoticeRecipients({ onPage, pending, recipients }: NoticeRecipientsProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminNotice;
  const words = dictionary.adminConsole.table;
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const number = (value: number) => formatNumber(value, locale);
  const { offset, rows, size, total } = recipients;
  const hasPrevious = offset > 0;
  const hasNext = offset + size < total;
  const languageOf = (value: string) => (value === 'en-GB' || value === 'es-ES' ? t.languages[value] : value);

  // The button pressed, until its page has arrived: then focus stays on it, or moves to the
  // other one when the page it led to is the last of that side (the pressed one is gone).
  const pressed = useRef<'next' | 'previous' | null>(null);

  useEffect(() => {
    const which = pressed.current;

    if (which === null) {
      return;
    }

    pressed.current = null;
    const [same, other] = which === 'next' ? [next, previous] : [previous, next];

    (same.current ?? other.current)?.focus();
  }, [offset]);

  function go(to: number, which: 'next' | 'previous') {
    pressed.current = which;
    onPage(to);
  }

  return (
    <div className={styles.recipients}>
      <AdminReflowTable
        caption={t.caption}
        columns={[
          { header: t.columns.email, key: 'email' },
          { header: t.columns.locale, key: 'locale' }
        ]}
        empty={t.nobody}
        rows={rows.map((row, index) => ({ id: String(offset + index), cells: { email: row.email, locale: languageOf(row.locale) } }))}
        showCaption={true}
      />

      {hasPrevious || hasNext ? (
        <nav aria-label={words.pager} className={styles.pager}>
          {hasPrevious ? (
            <Button
              aria-disabled={pending || undefined}
              className={styles.previous}
              onClick={() => {
                if (!pending) {
                  go(Math.max(offset - size, 0), 'previous');
                }
              }}
              ref={previous}
              size="sm"
              type="button"
              variant="secondary"
            >
              {words.previous}
            </Button>
          ) : (
            <span />
          )}
          <span className={styles.range}>
            {rows.length > 0 ? interpolate(words.range, { from: number(offset + 1), to: number(offset + rows.length), total: number(total) }) : null}
          </span>
          {hasNext ? (
            <Button
              aria-disabled={pending || undefined}
              className={styles.next}
              onClick={() => {
                if (!pending) {
                  go(offset + size, 'next');
                }
              }}
              ref={next}
              size="sm"
              type="button"
              variant="secondary"
            >
              {words.next}
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

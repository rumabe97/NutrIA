'use client';
import { useRef, useState } from 'react';

import styles from './CareAccessLog.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { CareAccessEntryView, CareAccessPageView } from 'core/controllers/Care';

interface CareAccessLogProps {
  initial: CareAccessPageView;
}

type Row = { entry: CareAccessEntryView; kind: 'entry' } | { id: string; count: number; kind: 'group'; professionalName: string };

/**
 * Consecutive `list` rows from the same professional collapse into one line
 * — a professional checking their roster a few times a day would otherwise
 * crowd out the reads that matter (LOG, Phase 3).
 */
function groupEntries(entries: readonly CareAccessEntryView[]): readonly Row[] {
  const rows: Row[] = [];

  for (const entry of entries) {
    const last = rows.at(-1);

    if (entry.kind === 'list' && last?.kind === 'group' && last.professionalName === entry.professionalName) {
      rows[rows.length - 1] = { ...last, count: last.count + 1 };
      continue;
    }

    rows.push(entry.kind === 'list' ? { id: entry.id, count: 1, kind: 'group', professionalName: entry.professionalName } : { entry, kind: 'entry' });
  }

  return rows;
}

/** The client's own access trail (PRD 004, criterion 6): who read or changed what, and when. */
export function CareAccessLog({ initial }: CareAccessLogProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.care;
  const [entries, setEntries] = useState(initial.entries);
  const [next, setNext] = useState(initial.next);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function loadMore() {
    if (!next) {
      return;
    }

    setError(undefined);
    setLoading(true);

    try {
      const page = await api<CareAccessPageView>(`/care/access-log?before=${next}`);

      setEntries(current => [...current, ...page.entries]);
      setNext(page.next);

      // The button that was just pressed unmounts the moment `next` is empty,
      // which would otherwise drop keyboard/screen-reader focus at `<body>`
      // with nothing said about why. The live region covers both cases: how
      // many arrived, or that there is nothing left to load.
      if (page.next) {
        setAnnouncement(interpolate(t.accessLogLoaded, { count: page.entries.length }));
      } else {
        setAnnouncement(t.accessLogNoMore);
        headingRef.current?.focus();
      }
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setLoading(false);
    }
  }

  const rows = groupEntries(entries);

  return (
    <Card as="section" className={styles.card}>
      <h3 className={styles.title} ref={headingRef} tabIndex={-1}>
        {t.accessLogTitle}
      </h3>
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      {rows.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t.accessLogEmpty}
        </Text>
      ) : (
        <ul className={styles.list}>
          {rows.map(row =>
            row.kind === 'group' ? (
              <li className={styles.row} key={row.id}>
                <Text size="sm" tone="secondary">
                  {interpolate(t.accessLogListCollapsed, { count: row.count, professional: row.professionalName })}
                </Text>
              </li>
            ) : (
              <li className={styles.row} key={row.entry.id}>
                <Text size="sm" tone="secondary">
                  {interpolate(row.entry.action === 'write' ? t.accessLogWrite : t.accessLogRead, {
                    kind: t.accessKinds[row.entry.kind],
                    professional: row.entry.professionalName
                  })}
                </Text>
                <Text className={styles.time} size="xs" tone="tertiary">
                  {formatInstant(Date.parse(row.entry.at), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })}
                </Text>
              </li>
            )
          )}
        </ul>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {next ? (
        <Button loading={loading} onClick={() => void loadMore()} type="button" variant="secondary">
          {t.accessLogLoadMore}
        </Button>
      ) : null}
    </Card>
  );
}

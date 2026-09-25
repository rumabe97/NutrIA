'use client';
import { useRef, useState } from 'react';

import styles from './CareAccessLog.module.css';

import { Button } from 'ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'ui/components/Collapsible';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, messageFor } from 'lib/api';
import { formatInstant, formatInstantRange, interpolate } from 'lib/format';
import { groupCareAccessEntries } from 'lib/careAccessGroups';

import type { CareAccessPageView } from 'core/controllers/Care';

interface CareAccessLogProps {
  initial: CareAccessPageView;
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

  const rows = groupCareAccessEntries(entries);

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
          {rows.map(row => {
            if (row.kind === 'entry') {
              return (
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
              );
            }

            // Newest first, as the trail reads it (`0059`): the first entry
            // in the run is the most recent, the last is the oldest, so the
            // range shown reads chronologically while the array itself does not.
            const newest = row.entries[0];
            const oldest = row.entries[row.entries.length - 1];
            const template = newest.action === 'write' ? t.accessLogWriteGroup : t.accessLogReadGroup;
            const range = formatInstantRange(Date.parse(oldest.at), Date.parse(newest.at), locale, { hour: '2-digit', minute: '2-digit' });

            return (
              <li className={styles.row} key={row.id}>
                <Collapsible>
                  <CollapsibleTrigger className={styles.groupTrigger}>
                    <Text as="span" size="sm" tone="secondary">
                      {interpolate(template, {
                        count: row.entries.length,
                        kind: t.accessKinds[newest.kind],
                        professional: newest.professionalName,
                        range
                      })}
                    </Text>
                    <span aria-hidden="true" className={styles.groupChevron} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className={styles.groupList}>
                      {row.entries.map(entry => (
                        <li className={styles.groupRow} key={entry.id}>
                          <Text size="sm" tone="secondary">
                            {interpolate(entry.action === 'write' ? t.accessLogWrite : t.accessLogRead, {
                              kind: t.accessKinds[entry.kind],
                              professional: entry.professionalName
                            })}
                          </Text>
                          <Text className={styles.time} size="xs" tone="tertiary">
                            {formatInstant(Date.parse(entry.at), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
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

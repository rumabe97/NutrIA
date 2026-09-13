'use client';
import { useState, useSyncExternalStore } from 'react';

import styles from './ShoppingActions.module.css';

import { Button, buttonClassName } from 'ui/components/Button';
import { useDictionary } from 'i18n/LocaleProvider';

import { useOffline } from 'components/OfflineProvider';

import { nearbyShopsUrl, shoppingListText } from 'lib/shoppingShare';
import { tickOf } from 'lib/pendingTicks';

import type { ShareGroup } from 'lib/shoppingShare';

type Item = ShareGroup['items'][number] & { readonly checked: boolean };

type Group = { readonly items: readonly Item[]; readonly label: string };

/** Nothing to listen to: a browser's user agent does not change while the page is open. */
function unchanging(): () => void {
  return () => undefined;
}

function userAgent(): string {
  return navigator.userAgent;
}

function noUserAgent(): string {
  return '';
}

/**
 * Two ways out of the list: sending what is left to whoever is going to the
 * shop, and a map of the shops nearby.
 *
 * Neither earns anything — the owner chose these over affiliate links — and
 * neither needs this app to know where anybody is: the list goes where the
 * person sends it, and the map finds the shops itself.
 */
export function ShoppingActions({ groups }: Readonly<{ groups: readonly Group[] }>) {
  const dictionary = useDictionary();
  const t = dictionary.shopping;
  const { offline } = useOffline();
  // Empty on the server, so hydration draws what the server did and the map link follows.
  const agent = useSyncExternalStore(unchanging, userAgent, noUserAgent);
  const [note, setNote] = useState<string>();

  async function share() {
    // What this device knows counts, including ticks still waiting for a connection (`0055`).
    const checked = new Map(groups.flatMap(group => group.items.map(item => [item.id, item.checked] as const)));
    const text = shoppingListText(t.shareTitle, groups, id => tickOf(id) ?? checked.get(id) ?? false);

    if (!text) {
      setNote(t.shareNothing);

      return;
    }

    setNote(undefined);

    if ('share' in navigator) {
      try {
        await navigator.share({ text, title: t.shareTitle });

        return;
      } catch (error: unknown) {
        // Closing the share sheet is an answer, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setNote(t.shareCopied);
    } catch {
      setNote(dictionary.errors.internal);
    }
  }

  return (
    <div className={styles.root}>
      <Button onClick={() => void share()} size="sm" type="button" variant="secondary">
        {t.share}
      </Button>
      {/* Offline, a map is a page that will not open, so it is not offered (`0053`).
          A link that leaves the site, dressed as the share button's equal, and it
          says where it goes — a new tab is a surprise only when nobody was told. */}
      {offline || !agent ? null : (
        <a
          className={buttonClassName({ size: 'sm', variant: 'secondary' })}
          href={nearbyShopsUrl(t.nearbyQuery, agent)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.nearby}
          <span className="visually-hidden">{t.nearbyOpens}</span>
        </a>
      )}
      {note ? (
        <p className={styles.note} role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}

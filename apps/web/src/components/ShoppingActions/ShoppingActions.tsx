'use client';
import { useState, useSyncExternalStore } from 'react';

import styles from './ShoppingActions.module.css';

import { Button, buttonClassName } from 'ui/components/Button';
import { toDisplay } from 'core/domain/ShoppingList';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { useOffline } from 'components/OfflineProvider';

import { boughtOf } from 'lib/pendingTicks';
import { formatQuantity } from 'lib/format';
import { nearbyShopsUrl, shoppingListText } from 'lib/shoppingShare';

import type { ShareGroup } from 'lib/shoppingShare';

type Item = ShareGroup['items'][number] & {
  readonly boughtGrams: number;
  readonly displayUnit: Parameters<typeof toDisplay>[1];
  readonly gramsPerUnit: number | null;
  /** What the days on screen need of this row (`0091`). */
  readonly neededGrams: number;
  readonly totalGrams: number;
};

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
  const locale = useLocale();
  const t = dictionary.shopping;
  const { offline } = useOffline();
  // Empty on the server, so hydration draws what the server did and the map link follows.
  const agent = useSyncExternalStore(unchanging, userAgent, noUserAgent);
  const [note, setNote] = useState<string>();

  async function share() {
    // What this device knows counts, including marks still waiting for a connection (`0055`).
    // A row leaves the message once the days on screen are covered; one half
    // bought stays, carrying **what is left** rather than what the range needs —
    // whoever is sent to the shop would otherwise buy the part already in the
    // trolley a second time.
    const left = groups.map(group => ({
      ...group,
      items: group.items.map(item => {
        const remaining = Math.max(item.neededGrams - boughtOf(item.id, item), 0);

        return remaining >= item.neededGrams
          ? item
          : {
              ...item,
              quantity: formatQuantity(toDisplay(remaining, item.displayUnit, item.gramsPerUnit).quantity, item.displayUnit, locale, dictionary)
            };
      })
    }));
    const text = shoppingListText(t.shareTitle, left, id => {
      const row = left.flatMap(group => group.items).find(item => item.id === id);

      return row !== undefined && row.neededGrams > 0 && boughtOf(id, row) >= row.neededGrams;
    });

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

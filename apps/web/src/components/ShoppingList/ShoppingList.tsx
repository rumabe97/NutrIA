'use client';
import { Fragment, useState, useSyncExternalStore } from 'react';

import styles from './ShoppingList.module.css';

import { Button } from 'ui/components/Button';
import { rangeList } from 'core/domain/ShoppingList';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { ShoppingActions } from 'components/ShoppingActions';
import { ShoppingItem } from 'components/ShoppingItem';
import { ShoppingProgress } from 'components/ShoppingProgress';
import { ShoppingRange } from 'components/ShoppingRange';

import { categoryLabel } from 'lib/generation';
import { daysIn, planDays, rememberRange, resolveRange, serverRange, storedRange, subscribeToRange, WHOLE_PLAN } from 'lib/shoppingRange';
import { formatQuantity, interpolate } from 'lib/format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { RangeChoice, ShoppingListItem } from 'lib/shoppingRange';
import type { ReactNode } from 'react';

export type ShoppingListView = { id: string; items: readonly ShoppingListItem[]; planId: string };

/** Category order follows how a supermarket is walked, matching the API's own sort. */
const ORDER = ['produce', 'protein', 'dairy', 'bakery', 'frozen', 'pantry', 'beverages', 'other'];

interface ShoppingListProps {
  list: ShoppingListView;
  /** What the screen says under its title, with a `{range}` placeholder for the days it covers. */
  subtitle: string;
  /** Drawn between the title and the subtitle: the choice of list, when there are two. */
  switcher?: ReactNode;
}

/**
 * The shopping screen's body, for the plan under way and for the one waiting.
 *
 * A client component because the reader chooses which days the list is for
 * (`0091`), and that choice must cost nothing: every row arrives carrying what
 * each day of the plan owes it, so filtering is arithmetic on data already
 * here. No request, no new address — which is what keeps this screen working in
 * a supermarket with no signal (`0053`).
 *
 * The quantities come from `rangeList` in the domain, the same function the
 * server computes with, so the two can never disagree about what a week needs.
 */
export function ShoppingList({ list, subtitle, switcher }: ShoppingListProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.shopping;
  // The whole plan on the server and on the first client render; what this
  // device last chose arrives right after, so hydration draws what was sent.
  const stored = useSyncExternalStore(subscribeToRange, storedRange, serverRange);
  // Only once the reader has picked something. Without this, hydration swapping
  // the server's range for this device's would announce a range nobody chose.
  const [announce, setAnnounce] = useState(false);
  // Something a row could not say itself — said once, in the one region already mounted.
  const [notice, setNotice] = useState('');
  const days = planDays(list.items);
  const range = resolveRange(stored, days);
  const chosen = daysIn(range, days);
  const rows = rangeList({ items: list.items }, chosen);
  const groups = ORDER.map(category => ({ category, items: rows.filter(item => item.category === category) })).filter(
    group => group.items.length > 0
  );
  // Built once, from the range's own quantities: the stored `displayQuantity` is
  // the whole plan's, and a message saying 1.2 kg for a week would be wrong.
  const shown = groups.flatMap(group => group.items);
  const emptied = chosen.length === 0 ? t.rangeNoDays : t.rangeEmpty;
  // What the region says: why the screen is empty, or what the range now holds.
  const announcement = shown.length === 0 ? emptied : interpolate(t.rangeAnnounced, { count: shown.length, range: rangeName(range.choice, t) });
  const shareGroups = groups.map(group => ({
    items: group.items.map(item => ({
      id: item.id,
      boughtGrams: item.boughtGrams,
      displayUnit: item.range.displayUnit,
      gramsPerUnit: item.gramsPerUnit,
      name: item.name,
      neededGrams: item.range.totalGrams,
      quantity: formatQuantity(item.range.displayQuantity, item.range.displayUnit, locale, dictionary),
      totalGrams: item.totalGrams
    })),
    label: categoryLabel(group.category, dictionary)
  }));

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      {switcher}
      <Text tone="secondary">{interpolate(subtitle, { range: rangeName(range.choice, t) })}</Text>

      {/*
        Picking a range changes the rows, the quantities and the count, and a
        radio announces only itself — so a blind shopper would hear "Semana 1,
        selected" and nothing about the nineteen rows that just left (WCAG 4.1.3).
        The region is always mounted and starts empty: one that arrives already
        holding its text is not read at all, which is most of why live regions
        are thought unreliable.
      */}
      <div aria-atomic="true" aria-live="polite" className="visually-hidden">
        {notice === '' ? (announce ? announcement : '') : notice}
      </div>

      {/* No breakdown, no filter: every list stored before the days travelled with
          the rows reads as the whole plan, so a control here could do nothing. */}
      {days.length > 1 ? (
        <ShoppingRange
          days={days}
          onChange={next => {
            setAnnounce(true);
            setNotice('');
            rememberRange(next);
          }}
          value={range}
        />
      ) : null}

      {notice === '' ? null : (
        <Text className={styles.notice} size="sm" tone="secondary">
          {notice}
        </Text>
      )}

      {/* Counted on the device, so a mark still waiting for a connection counts too (`0055`). */}
      <div className={styles.progress}>
        <ShoppingProgress
          items={shown.map(item => ({ id: item.id, boughtGrams: item.boughtGrams, neededGrams: item.range.totalGrams, totalGrams: item.totalGrams }))}
        />
      </div>

      {/* In the aisles' order and the reader's words, so a message reads like the list on screen. */}
      <ShoppingActions groups={shareGroups} />

      {/* Only when a narrower range is what emptied the screen. An empty list read
          for the whole plan is a different thing and says nothing new here, exactly
          as before; the button would offer the reader where they already are.
          `role="status"` is on the sentence alone — a live region holding a button
          re-announces the button every time the range changes. */}
      {groups.length === 0 && range.choice !== 'fortnight' ? (
        <div className={`${styles.empty} motion-enter`}>
          {/* Visible text, read where it sits. What is *announced* is the region
              above, which exists before its words do. */}
          <Text tone="secondary">{emptied}</Text>
          <Button
            onClick={() => {
              setAnnounce(true);
              rememberRange(WHOLE_PLAN);
              // This button unmounts the moment it is pressed, and focus would
              // fall to <body> with nothing said. It lands on the segment that
              // is now chosen, which announces itself.
              document.getElementById('shopping-range-fortnight')?.focus();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t.rangeShowWhole}
          </Button>
        </div>
      ) : null}

      {groups.map(group => (
        <section className={`${styles.group} motion-enter`} key={group.category}>
          <h2 className={styles.groupTitle}>{categoryLabel(group.category, dictionary)}</h2>
          <ul className={styles.items}>
            {group.items.map(item => (
              <ShoppingItem
                boughtGrams={item.boughtGrams}
                displayQuantity={item.range.displayQuantity}
                displayUnit={item.range.displayUnit}
                gramsPerUnit={item.gramsPerUnit}
                id={item.id}
                key={item.id}
                name={item.name}
                neededGrams={item.range.totalGrams}
                onNotice={setNotice}
                totalGrams={item.totalGrams}
              />
            ))}
          </ul>
        </section>
      ))}
    </Fragment>
  );
}

/** What the subtitle calls each range, so the screen never claims days it is not showing. */
function rangeName(choice: RangeChoice, t: Dictionary['shopping']): string {
  if (choice === 'week1') {
    return t.rangeNameWeek1;
  }

  if (choice === 'week2') {
    return t.rangeNameWeek2;
  }

  return choice === 'days' ? t.rangeNameDays : t.rangeNameWhole;
}

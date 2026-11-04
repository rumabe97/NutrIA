'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './PantryPicker.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { MAX_PANTRY_LABEL_LENGTH } from 'core/entities/Pantry';

import { api, ApiError, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { PantryCatalogueFoodView, PantryView } from 'core/controllers/Pantry';

/** Typing waits this long for a pause before it asks: a word is one request, not one per key. */
const SEARCH_DELAY_MS = 250;
/** The catalogue answers fifty; a phone is shown this many until somebody asks for the rest. */
const SHOWN_AT_FIRST = 8;

interface PantryPickerProps {
  /** As `GET /pantry` answers it: the whole cupboard, and the bound. */
  pantry: PantryView;
}

/**
 * What is already in the house, said before a fortnight is generated (project
 * 022, phase 3b).
 *
 * **A picker over our catalogue and never a free-text box.** What somebody types
 * only filters `POST /pantry/catalogue`; what is sent as an entry is the `name`
 * a row came back with, byte for byte — the route's matching and the add's
 * resolver share one index, so a string reshaped here would be a string the
 * resolver may not answer. Nothing typed is ever an entry, and nothing typed
 * leaves the search request (`docs/legal/pantry.md` § 4, § 5.4 point 8).
 *
 * **The catalogue is not filtered by anything about the person.** A picker that
 * silently hid somebody's declared allergen would perform exactly the inference
 * criterion 8 forbids: the screen offers the same foods to everybody.
 *
 * **Nothing is kept in the browser.** The cupboard lives on the server behind
 * the session; there is no `localStorage`, no IndexedDB and no cached copy,
 * because `/privacidad`'s enumeration of what is stored on the device would then
 * be wrong (`docs/legal/pantry.md` § 2.2).
 *
 * **The bound is read from the payload** and said before it is reached, the way
 * `KitchenPicker` does.
 *
 * **A plain search field and a list of buttons, not an ARIA combobox.** The
 * control people most often cannot use is the combobox; a field that filters a
 * list beneath it is read, tabbed and zoomed like the page around it, and works
 * the same under a thumb and a screen reader.
 *
 * An entry nothing in the library cooks — `slug: null` or `cookedWith: false` —
 * says so in the first person plural and **stays**: it is a fact about us, not a
 * warning about the person's choice (§ 5.4, point 9).
 */
export function PantryPicker({ pantry }: PantryPickerProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.pantry;
  const headingId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const entryListRef = useRef<HTMLUListElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [cupboard, setCupboard] = useState(pantry);
  const [query, setQuery] = useState('');
  const [grams, setGrams] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [results, setResults] = useState<readonly PantryCatalogueFoodView[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string>();
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState('');
  /**
   * Where focus belongs once the render that moved the lists has happened, and
   * which row it was on when it was lost; a ref, so setting it is not itself a
   * render.
   */
  const pendingFocus = useRef<{ kind: 'added' | 'expanded' | 'removed'; row: number } | null>(null);
  const full = cupboard.items.length >= cupboard.maxItems;

  /** What the cupboard's size says, which goes in the announcement and not in a live region of its own. */
  function boundSays(next: PantryView): string {
    return next.items.length >= next.maxItems
      ? interpolate(t.boundFull, { max: next.maxItems })
      : interpolate(t.bound, { count: next.items.length, max: next.maxItems });
  }

  useEffect(() => {
    let current = true;
    // The first ask, before anybody has typed, is the top of the catalogue and
    // goes at once; a typed word waits for a pause.
    const timer = setTimeout(
      () => {
        setSearching(true);

        api<readonly PantryCatalogueFoodView[]>('/pantry/catalogue', { body: { q: query }, method: 'POST' })
          .then(found => {
            if (current) {
              setResults(found);
              setSearchError(undefined);
            }
          })
          .catch((failure: unknown) => {
            if (current) {
              setSearchError(messageFor(failure, dictionary));
            }
          })
          .finally(() => {
            if (current) {
              setSearching(false);
            }
          });
      },
      query === '' ? 0 : SEARCH_DELAY_MS
    );

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dictionary, query]);

  /**
   * Focus is moved in the render **after** the one that changed the list, never
   * in the same tick as the state change.
   *
   * Three of this component's controls disappear exactly when they are used:
   * the last entry's remove button, *«ver más»*, and the whole search field
   * when the cupboard fills. A `focus()` beside the `setState` lands on a node
   * React is about to drop, and focus falls to `BODY` — all three measured in
   * Chrome by `accessibility` on 2026-11-04. It also kept the announcement and
   * the focus move in the same tick, which VoiceOver often answers by dropping
   * the message.
   */
  useEffect(() => {
    const intent = pendingFocus.current;

    if (intent === null) {
      return;
    }

    pendingFocus.current = null;

    // Never a disabled one: a `loading` button is disabled while its request is
    // in flight, and `focus()` on it does nothing at all.
    const buttonsIn = (list: HTMLUListElement | null): readonly HTMLButtonElement[] => [
      ...(list?.querySelectorAll<HTMLButtonElement>('button[data-row]:not([disabled])') ?? [])
    ];
    const rowOf = (button: HTMLButtonElement): number => Number(button.dataset['row']);
    const walk = (buttons: readonly HTMLButtonElement[], from: number): HTMLButtonElement | undefined =>
      // The next one after the row just used, then the one before it: somebody
      // who added the sixth food is not sent back to the top of the list.
      buttons.find(button => rowOf(button) >= from) ?? [...buttons].reverse().find(button => rowOf(button) < from);
    // Where the next press belongs: the rows just revealed for an expansion,
    // the next thing addable after an add, the next entry after a removal.
    // `added` starts **after** the row pressed, because that row keeps its index
    // and now reads «añadido»; `removed` starts **at** it, because the row that
    // follows has just taken the index the removed one had.
    const target =
      intent.kind === 'expanded'
        ? (buttonsIn(resultsRef.current).find(button => rowOf(button) >= SHOWN_AT_FIRST) ?? buttonsIn(resultsRef.current)[0])
        : intent.kind === 'removed'
          ? walk(buttonsIn(entryListRef.current), intent.row)
          : walk(buttonsIn(resultsRef.current), intent.row + 1);

    // The search field is gone on the add that filled the cupboard, so the
    // card's own heading is the floor. Never nothing.
    (target ?? searchRef.current ?? titleRef.current)?.focus();
    // The two renders worth following: the cupboard changing (an add, a
    // removal) and the list being expanded. Both are the render in which the
    // control focus was on may have stopped existing.
  }, [cupboard, showAll]);

  function amountFrom(): number | null | undefined {
    // `type="number"` answers `''` for anything it cannot parse, so "abc" would
    // otherwise add the food with no amount and no word said about it
    // (`accessibility`, 2026-11-04). `badInput` is the browser's own answer to
    // what it is still holding.
    if (amountRef.current?.validity.badInput) {
      return undefined;
    }

    if (grams.trim() === '') {
      return null;
    }

    const amount = Number(grams);

    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
  }

  async function add(food: PantryCatalogueFoodView, row: number): Promise<void> {
    const amount = amountFrom();

    if (amount === undefined) {
      setAmountError(t.amountInvalid);
      // The error is drawn at the field, which on a phone or at 400% zoom can
      // be several screens above the row just pressed. `Input` already
      // announces it politely; this is so it is also **seen**. It bends the
      // house preference for announcing without moving focus, deliberately:
      // the field is the thing to correct, and a message nobody sees is not a
      // message.
      amountRef.current?.focus();

      return;
    }

    setAmountError(undefined);
    setError(undefined);
    setBusy(food.name);

    try {
      // The row's own `name`, exactly as it came: no trim, no case, nothing.
      const next = await api<PantryView>('/pantry', {
        body: amount === null ? { label: food.name } : { grams: amount, label: food.name },
        method: 'POST'
      });

      setCupboard(next);
      setGrams('');
      setAnnouncement(`${interpolate(t.addedStatus, { name: food.name })} ${boundSays(next)}`);
      pendingFocus.current = { kind: 'added', row };
    } catch (failure) {
      // A 422 naming `label` is the cupboard being full, which another tab can cause.
      setError(
        failure instanceof ApiError && failure.status === 422 && failure.fieldErrors['label']
          ? interpolate(t.boundFull, { max: cupboard.maxItems })
          : messageFor(failure, dictionary)
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, label: string, row: number): Promise<void> {
    setError(undefined);
    setBusy(id);

    try {
      const next = await api<PantryView>(`/pantry/${id}`, { method: 'DELETE' });

      setCupboard(next);
      setAnnouncement(`${interpolate(t.removedStatus, { name: label })} ${boundSays(next)}`);
      pendingFocus.current = { kind: 'removed', row };
    } catch (failure) {
      setError(messageFor(failure, dictionary));
    } finally {
      setBusy(null);
    }
  }

  const shown = showAll ? results : results.slice(0, SHOWN_AT_FIRST);

  return (
    <Card aria-labelledby={headingId} as="section" className={styles.card}>
      <h2 className={styles.title} id={headingId} ref={titleRef} tabIndex={-1}>
        {t.title}
      </h2>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>
      <Text className={styles.keeps} size="sm" tone="secondary">
        {t.keeps}
      </Text>

      {cupboard.items.length > 0 ? (
        <div className={styles.group}>
          <h3 className={styles.subtitle}>{t.entries}</h3>
          <ul className={styles.list} ref={entryListRef}>
            {cupboard.items.map((item, index) => (
              <li className={styles.row} key={item.id}>
                <span className={styles.what}>
                  <span className={styles.name}>
                    {item.label}
                    {item.grams === null ? null : ` · ${formatNumber(item.grams, locale, { maximumFractionDigits: 1 })} ${dictionary.units.gram}`}
                  </span>
                  {item.slug === null || !item.cookedWith ? (
                    <Text as="span" size="xs" tone="tertiary">
                      {t.notCooked}
                    </Text>
                  ) : null}
                </span>
                <Button
                  aria-label={interpolate(t.removeFor, { name: item.label })}
                  data-row={index}
                  loading={busy === item.id}
                  onClick={() => void remove(item.id, item.label, index)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t.remove}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Mounted with the count already in it: the bound is said before it is
          reached. **Not a live region**, though it changes on every add: it
          would then announce beside the add's own message, and the same thing
          twice is what `accessibility` asked to stop (2026-11-04). The count
          travels inside that one message instead. */}
      <Text size="xs" tone="secondary">
        {full ? interpolate(t.boundFull, { max: cupboard.maxItems }) : interpolate(t.bound, { count: cupboard.items.length, max: cupboard.maxItems })}
      </Text>

      {/* A full cupboard takes the search with it: the list above still removes,
          and the line above says what would bring it back. */}
      {full ? null : (
        <div className={styles.group}>
          <Input
            autoComplete="off"
            label={t.search}
            maxLength={MAX_PANTRY_LABEL_LENGTH}
            onChange={event => {
              setQuery(event.target.value);
              setShowAll(false);
            }}
            ref={searchRef}
            spellCheck={false}
            type="search"
            value={query}
          />
          <Input
            error={amountError}
            hint={t.amountHint}
            inputMode="decimal"
            label={t.amount}
            min="0.01"
            onChange={event => {
              setGrams(event.target.value);
              setAmountError(undefined);
            }}
            // A focused number field otherwise takes a page scroll as a value
            // change, which is how somebody adds "40 g" of something they meant
            // to scroll past.
            onWheel={event => {
              if (document.activeElement === event.currentTarget) {
                event.currentTarget.blur();
              }
            }}
            ref={amountRef}
            step="any"
            type="number"
            value={grams}
          />

          {/* Seen, and not announced: a search that says it is searching and
              then that it has updated has told somebody using a screen reader
              nothing they can act on. */}
          {searching || (!searchError && results.length === 0) ? (
            <Text size="sm" tone="secondary">
              {searching ? t.searching : t.noResults}
            </Text>
          ) : null}

          {/* Announced, and only the outcome, with the figure that makes it
              worth hearing — including when the field is cleared, which said
              nothing at all before. */}
          <Text className="visually-hidden" role="status" size="sm">
            {searching || searchError ? '' : results.length === 0 ? t.noResults : interpolate(t.resultsFound, { count: results.length })}
          </Text>
          {searchError ? (
            <Text className={styles.failure} role="alert" size="sm">
              {searchError}
            </Text>
          ) : null}

          {shown.length > 0 ? (
            <ul aria-label={t.resultsList} className={styles.list} ref={resultsRef}>
              {shown.map((food, index) => {
                const held = cupboard.items.some(item => item.label === food.name);

                return (
                  <li className={styles.row} key={food.slug}>
                    <span className={styles.name}>{food.name}</span>
                    {held ? (
                      <Text as="span" size="sm" tone="secondary">
                        {t.added}
                      </Text>
                    ) : (
                      <Button
                        aria-label={interpolate(t.addFor, { name: food.name })}
                        data-row={index}
                        loading={busy === food.name}
                        onClick={() => void add(food, index)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {t.add}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!showAll && results.length > SHOWN_AT_FIRST ? (
            <Button
              onClick={() => {
                pendingFocus.current = { kind: 'expanded', row: SHOWN_AT_FIRST };
                setShowAll(true);
              }}
              size="sm"
              type="button"
              variant="tertiary"
            >
              {interpolate(t.showMore, { count: results.length - SHOWN_AT_FIRST })}
            </Button>
          ) : null}
        </div>
      )}

      {error ? (
        <Text className={styles.failure} role="alert" size="sm">
          {error}
        </Text>
      ) : null}

      {/* `role="status"` is already a polite live region, and both attributes
          together make some pairings announce it twice (`accessibility`,
          2026-10-16, the note in `KitchenPicker`). */}
      <div className="visually-hidden" role="status">
        {announcement}
      </div>
    </Card>
  );
}

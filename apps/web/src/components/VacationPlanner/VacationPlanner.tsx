'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './VacationPlanner.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';

import type { VacationView } from 'core/controllers/Vacation';

/**
 * Declaring a trip, and cancelling one (`0032`).
 *
 * The plan is paused rather than rewritten: the days after the trip move with
 * it, so nothing is missed and nothing is lost. The copy says exactly that,
 * because a screen that only says "vacaciones" leaves the person guessing
 * whether their fortnight is about to be thrown away.
 */
export function VacationPlanner({ trips }: { trips: readonly VacationView[] }) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.vacations;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'added' | 'back' | 'removed'>();
  const [error, setError] = useState<string>();
  const today = new Date().toISOString().slice(0, 10);

  // The button that was pressed disables itself while the request is out, and
  // a disabled element cannot hold focus — so without this, focus falls to the
  // page body and the next Tab starts from the top. The heading is where the
  // list and the form both hang from, and it is not an input, so landing on it
  // opens no keyboard on a phone. The same defect and the same fix as
  // `EventPlanner`.
  function settle(what: 'added' | 'back' | 'removed') {
    setOutcome(what);
    titleRef.current?.focus();
    router.refresh();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setOutcome(undefined);
    setError(undefined);

    try {
      await api('/vacations', { body: { endsOn, startsOn }, method: 'POST' });
      setStartsOn('');
      setEndsOn('');
      settle('added');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function cancel(id: string, away: boolean) {
    setPending(true);
    setOutcome(undefined);
    setError(undefined);

    try {
      await api(`/vacations/${id}`, { method: 'DELETE' });
      // "He vuelto" ends a trip under way today; "Quitar" deletes one not yet
      // begun. Two buttons, two outcomes, and the announcement says which.
      settle(away ? 'back' : 'removed');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  const day = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });

  return (
    <section className={styles.root}>
      <h2 className={styles.title} ref={titleRef} tabIndex={-1}>
        {t.title}
      </h2>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      {trips.length > 0 ? (
        <ul className={styles.list}>
          {trips.map(trip => (
            <li className={styles.row} key={trip.id}>
              <span className={styles.when}>
                <span className={styles.dates}>{interpolate(t.range, { from: day(trip.startsOn), to: day(trip.endsOn) })}</span>
                <Text as="span" size="xs" tone="tertiary">
                  {interpolate(trip.away ? t.awayNow : t.days, { count: String(trip.days) })}
                </Text>
              </span>
              {/* Every row's button says the same two words; the label says which
                  trip it belongs to, so a rotor list of them is navigable. */}
              <Button
                aria-label={interpolate(trip.away ? t.backEarlyFor : t.cancelFor, { from: day(trip.startsOn), to: day(trip.endsOn) })}
                disabled={pending}
                onClick={() => void cancel(trip.id, trip.away)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {trip.away ? t.backEarly : t.cancel}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <form className={styles.form} onSubmit={event => void submit(event)}>
        <Input label={t.from} min={today} onChange={event => setStartsOn(event.target.value)} required={true} type="date" value={startsOn} />
        <Input label={t.to} min={startsOn || today} onChange={event => setEndsOn(event.target.value)} required={true} type="date" value={endsOn} />
        <Button disabled={pending || !startsOn || !endsOn} loading={pending} type="submit">
          {t.add}
        </Button>
      </form>

      {outcome ? (
        <Text role="status" size="sm" tone="secondary">
          {t[outcome]}
        </Text>
      ) : null}

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </section>
  );
}

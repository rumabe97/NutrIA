'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './EventPlanner.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Select, SelectOption } from 'ui/components/Select';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';

import type { EventView } from 'core/controllers/Event';
import type { MacroDirection } from 'core/entities/Event';

const MACROS = ['carbs', 'protein', 'fat'] as const;
const DIRECTIONS: readonly MacroDirection[] = ['same', 'up', 'down'];

/**
 * Declaring a day that asks more of the body, and removing one (`0043`).
 *
 * The person chooses the shape and only the shape: how many days before, and
 * for each macro whether it goes up, down or stays. There is no field for how
 * much, on purpose — the size of a load is decided in code, in one place, and
 * a number typed here is the one thing that could make a day eat wrong.
 *
 * The copy says it applies to the *next* plan. A screen that let somebody add a
 * race for Saturday and then showed this week's plan unchanged would look
 * broken; saying so is cheaper than the support message.
 */
export function EventPlanner({ events }: { events: readonly EventView[] }) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.events;
  const [name, setName] = useState('');
  const [on, setOn] = useState('');
  const [daysBefore, setDaysBefore] = useState('2');
  const [shape, setShape] = useState<Record<(typeof MACROS)[number], MacroDirection>>({ carbs: 'up', fat: 'same', protein: 'same' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const today = new Date().toISOString().slice(0, 10);
  const nothingMoves = MACROS.every(macro => shape[macro] === 'same');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    try {
      await api('/events', { body: { ...shape, daysBefore: Number(daysBefore), name, on }, method: 'POST' });
      setName('');
      setOn('');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError(undefined);

    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  const day = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const direction = (macro: (typeof MACROS)[number], value: MacroDirection) =>
    value === 'same' ? null : `${t[macro]} ${value === 'up' ? '↑' : '↓'}`;

  return (
    <section className={styles.root}>
      <h2 className={styles.title}>{t.title}</h2>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      {events.length > 0 ? (
        <ul className={styles.list}>
          {events.map(event => (
            <li className={styles.row} key={event.id}>
              <span className={styles.what}>
                <span className={styles.name}>
                  {event.name} · {day(event.on)}
                </span>
                <Text as="span" size="xs" tone="tertiary">
                  {event.daysBefore === 1 ? t.daysBeforeOne : interpolate(t.daysBeforeMany, { count: String(event.daysBefore) })}
                  {' · '}
                  {MACROS.map(macro => direction(macro, event[macro]))
                    .filter(Boolean)
                    .join(' · ')}
                  {event.loading ? ` · ${t.loading}` : ''}
                </Text>
              </span>
              <Button
                aria-label={interpolate(t.cancelFor, { name: event.name })}
                disabled={pending}
                onClick={() => void remove(event.id)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t.cancel}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <form className={styles.form} onSubmit={event => void submit(event)}>
        <Input
          label={t.name}
          maxLength={60}
          onChange={event => setName(event.target.value)}
          placeholder={t.namePlaceholder}
          required={true}
          value={name}
        />
        <Input label={t.on} min={today} onChange={event => setOn(event.target.value)} required={true} type="date" value={on} />
        {/* Radix's Select root is not labelable, so each one carries a visible
            label by id — the way the component documents it. */}
        <div className={styles.field}>
          <span className={styles.label} id="event-days-before">
            {t.daysBefore}
          </span>
          <Select aria-labelledby="event-days-before" onValueChange={setDaysBefore} value={daysBefore}>
            {['1', '2', '3'].map(count => (
              <SelectOption indicator={null} key={count} value={count}>
                {count === '1' ? t.daysBeforeOne : interpolate(t.daysBeforeMany, { count })}
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className={styles.shape}>
          {MACROS.map(macro => (
            <div className={styles.field} key={macro}>
              <span className={styles.label} id={`event-${macro}`}>
                {t[macro]}
              </span>
              <Select
                aria-labelledby={`event-${macro}`}
                onValueChange={value => setShape(current => ({ ...current, [macro]: value as MacroDirection }))}
                value={shape[macro]}
              >
                {DIRECTIONS.map(value => (
                  <SelectOption indicator={null} key={value} value={value}>
                    {t[value]}
                  </SelectOption>
                ))}
              </Select>
            </div>
          ))}
        </div>
        <Button disabled={pending || !name || !on || nothingMoves} loading={pending} type="submit">
          {t.add}
        </Button>
      </form>

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </section>
  );
}

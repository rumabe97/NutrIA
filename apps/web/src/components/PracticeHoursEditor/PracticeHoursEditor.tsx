'use client';
import { useEffect, useId, useRef } from 'react';

import styles from './PracticeHoursEditor.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { PROFILE_HOURS_RANGES_MAX } from 'core/entities/Professional';

import { interpolate } from 'lib/format';

export type HoursRange = { from: string; to: string };

interface PracticeHoursEditorProps {
  /** The sentence for the refused day, already naming it. */
  error?: string;
  /** The day the server refused, if any (`fieldErrors.hours.<day>…`): its fields are marked and named in `error`. */
  errorDay: number | null;
  hours: HoursRange[][];
  onChange: (hours: HoursRange[][]) => void;
}

/** Where focus goes once the list has changed: a range's «Desde», or a day's «Añadir». */
type FocusTarget = { day: number; index: null } | { day: number; index: number };

/**
 * The profile's hours (PRD 025 scope 4, `0110` decision 9 — display only): seven
 * days from Monday, each closed or holding up to six ranges.
 *
 * **Focus follows what the person did** (accessibility review, phase 8): a range
 * added takes focus on its «Desde»; a range removed hands focus to the one before
 * it, or to its day's «Añadir» when it was the first. At six ranges «Añadir» stays
 * where it was, `aria-disabled`, with the limit said beside it, so focus is never
 * dropped by a control that vanished.
 *
 * Each range is a fieldset named «Lunes, horario 2», and its «Quitar este horario»
 * carries the same words after its visible ones, so a list of buttons read out of
 * context still says which range each removes.
 */
export function PracticeHoursEditor({ error, errorDay, hours, onChange }: PracticeHoursEditorProps) {
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<FocusTarget | null>(null);
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;
  const titleId = `${id}-title`;

  useEffect(() => {
    const target = focusNext.current;

    if (!target) {
      return;
    }

    focusNext.current = null;

    const selector =
      target.index === null
        ? `[data-add-day="${String(target.day)}"]`
        : `[data-day="${String(target.day)}"][data-range="${String(target.index)}"] input`;

    root.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [hours]);

  function change(day: number, index: number, edge: keyof HoursRange, value: string) {
    onChange(hours.map((ranges, d) => (d === day ? ranges.map((range, i) => (i === index ? { ...range, [edge]: value } : range)) : ranges)));
  }

  function add(day: number) {
    const ranges = hours[day] ?? [];

    if (ranges.length >= PROFILE_HOURS_RANGES_MAX) {
      return;
    }

    focusNext.current = { day, index: ranges.length };
    onChange(hours.map((dayRanges, d) => (d === day ? [...dayRanges, { from: '09:00', to: '14:00' }] : dayRanges)));
  }

  function remove(day: number, index: number) {
    focusNext.current = index > 0 ? { day, index: index - 1 } : { day, index: null };
    onChange(hours.map((ranges, d) => (d === day ? ranges.filter((_range, i) => i !== index) : ranges)));
  }

  return (
    <Card aria-labelledby={titleId} as="section" className={styles.card}>
      <h2 className={styles.title} id={titleId}>
        {t.profileHours}
      </h2>
      <div ref={root}>
        <ul className={styles.days}>
          {hours.map((ranges, day) => {
            const name = dictionary.fixedMeals.weekdays[day] ?? '';
            const inSentence = dictionary.fixedMeals.weekdaysInSentence[day] ?? name;
            const full = ranges.length >= PROFILE_HOURS_RANGES_MAX;
            const fullId = `${id}-full-${String(day)}`;
            const refused = errorDay === day;
            const describedBy = [refused ? errorId : '', noteId].filter(Boolean).join(' ');

            return (
              <li className={styles.day} key={name}>
                <div className={styles.dayHead}>
                  <span className={styles.dayName}>{name}</span>
                  {ranges.length === 0 ? (
                    <Text as="span" className={styles.closed} size="sm" tone="secondary">
                      {t.profileHoursClosed}
                    </Text>
                  ) : null}
                  <Button
                    aria-describedby={full ? fullId : undefined}
                    aria-disabled={full || undefined}
                    aria-label={interpolate(t.profileHoursAdd, { day: inSentence })}
                    className={styles.add}
                    data-add-day={day}
                    onClick={() => add(day)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {dictionary.common.add}
                  </Button>
                  {full ? (
                    <Text as="span" className={styles.full} id={fullId} size="xs" tone="secondary">
                      {interpolate(t.profileHoursFull, { max: PROFILE_HOURS_RANGES_MAX })}
                    </Text>
                  ) : null}
                </div>
                {ranges.map((range, index) => {
                  const which = interpolate(t.profileHoursRangeOf, { day: name, n: index + 1 });

                  return (
                    // The index is the range's place in a list only this form reorders.
                    // eslint-disable-next-line react/no-array-index-key
                    <fieldset className={styles.range} data-day={day} data-range={index} key={index}>
                      <legend className="visually-hidden">{which}</legend>
                      <Input
                        aria-invalid={refused || undefined}
                        describedBy={describedBy}
                        label={t.profileHoursFrom}
                        onChange={event => change(day, index, 'from', event.target.value)}
                        type="time"
                        value={range.from}
                      />
                      <Input
                        aria-invalid={refused || undefined}
                        describedBy={describedBy}
                        label={t.profileHoursTo}
                        onChange={event => change(day, index, 'to', event.target.value)}
                        type="time"
                        value={range.to}
                      />
                      <Button className={styles.remove} onClick={() => remove(day, index)} size="sm" type="button" variant="tertiary">
                        {t.profileHoursRemove}
                        <span className="visually-hidden">{` (${which})`}</span>
                      </Button>
                    </fieldset>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </div>
      {error ? (
        <Text className={styles.error} id={errorId} size="xs">
          {error}
        </Text>
      ) : null}
      <Text id={noteId} size="xs" tone="tertiary">
        {t.profileHoursNote}
      </Text>
    </Card>
  );
}

'use client';
import { Fragment, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './FixedMealPlanner.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Select, SelectOption } from 'ui/components/Select';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { CountedStanding } from 'core/domain/Allowance';
import type { FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { MealSlot } from 'core/entities/Plan';

/** A dish the API says can be fixed here. */
type Fixable = { readonly name: string; readonly slug: string };

type FixedMealPlannerProps = {
  readonly rules: readonly FixedMeal[];
  /** The slots this person actually eats; a meal they do not eat is not offered. */
  readonly slots: readonly MealSlot[];
  readonly standing: CountedStanding;
};

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * How many dishes are listed at once, and how many more each press adds.
 *
 * Eight is about a phone's worth without scrolling past the button that adds
 * more. The list is sorted by name and a search narrows it, so the eight on
 * screen are a real answer rather than an arbitrary prefix.
 */
const PAGE = 8;

/** Lower-cased and without accents, for a search that matches what a phone keyboard types. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * A meal fixed to one day of the week, for ever (`0098`, `0099`).
 *
 * **The dish list is asked for, not guessed.** Which dishes can be fixed to a
 * slot depends on this person's allergies, their way of eating, the size of
 * that meal and the season, so the screen chooses a day and a meal first and
 * then asks the API what fits. A picker that offered every dish and then
 * quietly served something else once a fortnight would be worse than one that
 * never offered it — which is `0098`'s whole reason for `pinnable` existing.
 *
 * It is one rule per weekday, and a day already taken is not offered: the
 * database refuses a second one, and being refused after a tap is a worse way
 * to learn a rule than not being offered the day.
 */
export function FixedMealPlanner({ rules, slots, standing }: FixedMealPlannerProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.fixedMeals;
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [weekday, setWeekday] = useState<string>('');
  const [slot, setSlot] = useState<string>('');
  const [dish, setDish] = useState<string>('');
  const [fixable, setFixable] = useState<readonly Fixable[]>();
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'added' | 'removed'>();
  const [error, setError] = useState<string>();

  const taken = new Set(rules.map(rule => rule.weekday));
  const free = WEEKDAYS.filter(day => !taken.has(day));
  const chosen = fixable?.find(candidate => candidate.slug === dish);
  // Accent-insensitive on both sides: somebody typing "limon" on a phone
  // keyboard is looking for "limón", and a search that disagrees reads as a
  // library that does not have it.
  const needle = plain(query);
  const matching = needle === '' ? (fixable ?? []) : (fixable ?? []).filter(candidate => plain(candidate.name).includes(needle));

  // As `VacationPlanner`: the button that was pressed disables itself while the
  // request is out, and a disabled element cannot hold focus, so without this
  // the next Tab starts from the top of the page. The heading is not an input,
  // so landing on it opens no keyboard on a phone.
  function settle(what: 'added' | 'removed') {
    setOutcome(what);
    titleRef.current?.focus();
    router.refresh();
  }

  /** Asked again whenever the day or the meal changes: the answer depends on both. */
  async function offer(nextWeekday: string, nextSlot: string) {
    setDish('');
    setFixable(undefined);
    setQuery('');
    setShown(PAGE);
    setError(undefined);

    if (!nextWeekday || !nextSlot) {
      return;
    }

    setPending(true);

    try {
      setFixable(await api<readonly Fixable[]>(`/fixed-meals/fixable?weekday=${nextWeekday}&slot=${nextSlot}`));
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setOutcome(undefined);
    setError(undefined);

    try {
      await api('/fixed-meals', { body: { dishSlug: dish, slot, weekday: Number(weekday) }, method: 'POST' });
      setWeekday('');
      setSlot('');
      setDish('');
      setFixable(undefined);
      setQuery('');
      setShown(PAGE);
      settle('added');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function remove(ruleId: string) {
    setPending(true);
    setOutcome(undefined);
    setError(undefined);

    try {
      await api(`/fixed-meals/${ruleId}`, { method: 'DELETE' });
      settle('removed');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card as="section" className={styles.root}>
      <h3 className={styles.title} ref={titleRef} tabIndex={-1}>
        {t.title}
      </h3>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      {rules.length > 0 ? (
        <ul className={styles.list}>
          {rules.map(rule => (
            <li className={styles.row} key={rule.id}>
              <span className={styles.when}>
                <span className={styles.rule}>{interpolate(t.rule, { day: t.weekdays[rule.weekday], meal: t.slots[rule.slot] })}</span>
                <Text as="span" size="xs" tone="tertiary">
                  {rule.dishName}
                </Text>
              </span>
              {/* Every row's button says the same word; the label says which rule it belongs to. */}
              <Button
                aria-label={interpolate(t.removeFor, { day: t.weekdays[rule.weekday], meal: t.slots[rule.slot] })}
                disabled={pending}
                onClick={() => void remove(rule.id)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t.remove}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Text size="xs" tone="tertiary">
        {standing.remaining === 0
          ? // "Ya tienes tus 1 comidas fijas" is what the plural alone gives on
            // the free tier, which is every account until somebody pays.
            standing.limit === 1
            ? t.fullOne
            : interpolate(t.full, { limit: standing.limit })
          : interpolate(standing.remaining === 1 ? t.leftOne : t.left, { limit: standing.limit, remaining: standing.remaining })}
      </Text>

      {standing.allowed && free.length > 0 ? (
        <form className={styles.form} onSubmit={event => void submit(event)}>
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-day`}>
              {t.day}
            </span>
            <Select
              aria-labelledby={`${id}-day`}
              onValueChange={value => {
                setWeekday(value);
                void offer(value, slot);
              }}
              placeholder={t.dayPlaceholder}
              value={weekday}
            >
              {free.map(day => (
                <SelectOption indicator="✓" key={day} value={String(day)}>
                  {t.weekdays[day]}
                </SelectOption>
              ))}
            </Select>
          </div>

          <div className={styles.field}>
            <span className={styles.label} id={`${id}-meal`}>
              {t.meal}
            </span>
            <Select
              aria-labelledby={`${id}-meal`}
              onValueChange={value => {
                setSlot(value);
                void offer(weekday, value);
              }}
              placeholder={t.mealPlaceholder}
              value={slot}
            >
              {slots.map(each => (
                <SelectOption indicator="✓" key={each} value={each}>
                  {t.slots[each]}
                </SelectOption>
              ))}
            </Select>
          </div>

          {/* Only once both are chosen: the dishes depend on the pair, and an
              empty list before that would read as "nothing fits".

              A listbox was the wrong control here and it shipped: a popover of a
              hundred and fifty names on a phone, nothing to type into, and the
              only way to reach the last one was to scroll past the rest. A field
              you can type in, with the matches under it a page at a time, is
              what a list this long needs. */}
          {fixable && fixable.length === 0 ? (
            <Text size="xs" tone="tertiary">
              {t.noneFit}
            </Text>
          ) : null}

          {fixable && fixable.length > 0 ? (
            <div className={styles.dish}>
              {chosen ? (
                <div className={styles.chosen}>
                  <span className={styles.chosenName}>
                    <Text as="span" size="xs" tone="tertiary">
                      {t.dish}
                    </Text>
                    <span className={styles.rule}>{chosen.name}</span>
                  </span>
                  <Button onClick={() => setDish('')} size="sm" type="button" variant="secondary">
                    {t.change}
                  </Button>
                </div>
              ) : (
                <Fragment>
                  <Input
                    autoComplete="off"
                    hint={interpolate(fixable.length === 1 ? t.countOne : t.count, { count: fixable.length })}
                    label={t.dish}
                    onChange={event => {
                      setQuery(event.target.value);
                      setShown(PAGE);
                    }}
                    placeholder={t.searchPlaceholder}
                    type="search"
                    value={query}
                  />

                  {/* The count is what changes as somebody types, so it is the
                      thing a screen reader should hear — not each row arriving. */}
                  <Text aria-live="polite" className={styles.matches} role="status" size="xs" tone="tertiary">
                    {matching.length === 0
                      ? interpolate(t.noMatch, { query })
                      : interpolate(matching.length === 1 ? t.matchOne : t.match, { count: matching.length })}
                  </Text>

                  {matching.length > 0 ? (
                    <ul className={styles.options}>
                      {matching.slice(0, shown).map(candidate => (
                        <li key={candidate.slug}>
                          <button className={styles.option} onClick={() => setDish(candidate.slug)} type="button">
                            {candidate.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {matching.length > shown ? (
                    <Button onClick={() => setShown(shown + PAGE)} size="sm" type="button" variant="secondary">
                      {interpolate(t.more, { count: matching.length - shown })}
                    </Button>
                  ) : null}
                </Fragment>
              )}
            </div>
          ) : null}

          <Button disabled={pending || !weekday || !slot || !dish} loading={pending} type="submit">
            {t.add}
          </Button>
        </form>
      ) : null}

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
    </Card>
  );
}

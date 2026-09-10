'use client';
import { Fragment, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './EventPlanner.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Select, SelectOption } from 'ui/components/Select';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { MacroShift } from 'components/MacroShift';

import { api, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';

import type { EventView } from 'core/controllers/Event';
import type { MacroDirection } from 'core/entities/Event';

const MACROS = ['carbs', 'protein', 'fat'] as const;
const DIRECTIONS: readonly MacroDirection[] = ['same', 'up', 'down'];

/** A cap and what is left of it — the pair `mealSwaps` already answers with. */
export type EventStanding = { limit: number; remaining: number };

/**
 * How many more events a plan will still take, and whether one may still be
 * added with the plan under way.
 *
 * TODO(events-allowance): narrow local shape, pending the per-tier caps being
 * added to the API (3 events per plan on free, 10 on premium; the mid-plan
 * addition premium only). Every screen here expects `GET /meal-plans/allowances`
 * to answer with one field, `events`, of this shape:
 * `{ limit, remaining, midPlan: { limit, remaining } | null }` — `midPlan`
 * null on a tier without it. Both pages read exactly that field off the
 * response and the tier off the existing `tier`. Until the field exists it is
 * absent, the props arrive `null`, no count shows and the day view draws no
 * form. Reconcile the names with `AllowancesView` in `core/controllers/Plan`
 * once the API side lands; this is the only place they are spelled.
 */
export type EventAllowance = EventStanding & {
  /** Additions with the plan under way — the rebuild of the loaded days that `0043` left out. */
  midPlan: EventStanding | null;
};

interface EventPlannerProps {
  /**
   * The cap that binds where the form stands — the plan's on the generation
   * screen, the mid-plan one under a day — or `null` when the API has not said.
   */
  allowance?: EventStanding | null;
  events: readonly EventView[];
  /**
   * `generation` is the screen before a plan is built, where an event costs
   * nothing and the copy says "this plan". `plan` is under a day of a plan
   * under way, where adding one rebuilds the days before it, and the copy
   * says that instead.
   */
  variant: 'generation' | 'plan';
}

/**
 * Declaring a day that asks more of the body, and removing one (`0043`).
 *
 * The person chooses the shape and only the shape: how many days before, and
 * for each macro whether it goes up, down or stays. There is no field for how
 * much, on purpose — the size of a load is decided in code, in one place, and
 * a number typed here is the one thing that could make a day eat wrong.
 *
 * An event belongs to a fortnight, not to the person, so this form stands in
 * the two places a fortnight is: the screen that is about to build one, and
 * the day view of one under way. The copy says what happens in each, because
 * a screen that let somebody add a race for Saturday and then showed an
 * unchanged plan would look broken; saying so is cheaper than the support
 * message.
 */
export function EventPlanner({ allowance, events, variant }: EventPlannerProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.events;
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState('');
  const [on, setOn] = useState('');
  const [daysBefore, setDaysBefore] = useState('2');
  const [shape, setShape] = useState<Record<(typeof MACROS)[number], MacroDirection>>({ carbs: 'up', fat: 'same', protein: 'same' });
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const [outcome, setOutcome] = useState<'added' | 'removed'>();
  const [error, setError] = useState<string>();
  const today = new Date().toISOString().slice(0, 10);
  const nothingMoves = MACROS.every(macro => shape[macro] === 'same');
  // One spinner per request: the submit shows it while adding, a row's own
  // button while removing, and the other buttons are merely disabled.
  const adding = pending && removing === undefined;
  // Where the form is standing decides what the copy promises.
  const copy =
    variant === 'plan'
      ? { added: t.addedMidPlan, full: t.midPlanFull, intro: t.midPlanIntro, left: t.midPlanLeft, leftOne: t.midPlanLeftOne, title: t.title }
      : { added: t.addedNow, full: t.full, intro: t.nowIntro, left: t.left, leftOne: t.leftOne, title: t.nowTitle };
  const capped = allowance ? allowance.remaining <= 0 : false;

  // The button that was pressed disables itself while the request is out, and
  // a disabled element cannot hold focus — so without this, focus falls to the
  // page body and the next Tab starts from the top. The heading is where the
  // list and the form both hang from, and it is not an input, so landing on it
  // opens no keyboard on a phone.
  function settle(what: 'added' | 'removed') {
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
      await api('/events', { body: { ...shape, daysBefore: Number(daysBefore), name, on }, method: 'POST' });
      setName('');
      setOn('');
      settle('added');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  async function remove(eventId: string) {
    setPending(true);
    setRemoving(eventId);
    setOutcome(undefined);
    setError(undefined);

    try {
      await api(`/events/${eventId}`, { method: 'DELETE' });
      settle('removed');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
      setRemoving(undefined);
    }
  }

  const day = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const daysBeforeLabel = (count: number | string) =>
    String(count) === '1' ? t.daysBeforeOne : interpolate(t.daysBeforeMany, { count: String(count) });
  /*
   * The count of what is left, or — when there is none — why there is no form.
   * `role="status"` announces it when it changes rather than on arrival: a live
   * region is silent for the render that creates it, which is exactly right.
   */
  const capacity = allowance
    ? capped
      ? interpolate(copy.full, { limit: allowance.limit })
      : allowance.remaining === 1
        ? interpolate(copy.leftOne, { limit: allowance.limit })
        : interpolate(copy.left, { limit: allowance.limit, remaining: allowance.remaining })
    : undefined;

  return (
    <section className={styles.root}>
      <h2 className={styles.title} ref={titleRef} tabIndex={-1}>
        {copy.title}
      </h2>
      <Text size="sm" tone="secondary">
        {copy.intro}
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
                  {daysBeforeLabel(event.daysBefore)}
                  {MACROS.filter(macro => event[macro] !== 'same').map(macro => (
                    <Fragment key={macro}>
                      {' · '}
                      <MacroShift direction={event[macro] === 'up' ? 'up' : 'down'} label={t[macro].toLowerCase()} />
                    </Fragment>
                  ))}
                  {event.loading ? ` · ${t.loading}` : ''}
                </Text>
              </span>
              {/* Every row's button says the same word; the label says which
                  event it belongs to — name *and* date, because two "partido"s
                  a week apart are two different rows. */}
              <Button
                aria-label={interpolate(t.cancelFor, { date: day(event.on), name: event.name })}
                disabled={pending}
                loading={removing === event.id}
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

      {/* A cap that is reached takes the form with it: the list above still
          removes, and the line says what would bring the form back. A form
          whose submit can only refuse is a control that does nothing. */}
      {capped ? (
        <Text role="status" size="sm" tone="secondary">
          {capacity}
        </Text>
      ) : (
        /* One question per row, top to bottom. The fields are labelled blocks
           of different heights and the fieldset is a block of its own, so
           laying them out as wrapping flex items made the break points depend
           on how long the words happened to be — "Días antes" landed beside
           "Grasa" and the submit sat in the middle of the macros. A grid
           decides. */
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
              label by id — the way the component documents it. The ids come from
              `useId`, so a second copy of this form on a page would not steal
              the first one's labels. */}
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-days`}>
              {t.daysBefore}
            </span>
            <Select aria-labelledby={`${id}-days`} onValueChange={setDaysBefore} value={daysBefore}>
              {['1', '2', '3'].map(count => (
                <SelectOption indicator="✓" key={count} value={count}>
                  {daysBeforeLabel(count)}
                </SelectOption>
              ))}
            </Select>
          </div>
          {/* Three pickers named "Hidratos", "Proteína", "Grasa" are three
              unexplained comboboxes to a screen reader; the group is what says
              they are one question. The legend is hidden, not dropped — a
              fieldset announces it on entry — and the visible caption below is
              the same words for the eye, marked `aria-hidden` so the question is
              not asked twice. The box around all three is the rest of the
              answer: it is what makes them read as one thing on a phone. */}
          <fieldset className={styles.shape}>
            <legend className="visually-hidden">{t.shapeLabel}</legend>
            <span aria-hidden="true" className={styles.shapeCaption}>
              {t.shapeLabel}
            </span>
            <div className={styles.pickers}>
              {MACROS.map(macro => (
                <div className={styles.field} key={macro}>
                  <span className={styles.macroLabel} id={`${id}-${macro}`}>
                    {t[macro]}
                  </span>
                  <Select
                    aria-labelledby={`${id}-${macro}`}
                    onValueChange={value => setShape(current => ({ ...current, [macro]: value as MacroDirection }))}
                    value={shape[macro]}
                  >
                    {DIRECTIONS.map(value => (
                      <SelectOption indicator="✓" key={value} value={value}>
                        {t[value]}
                      </SelectOption>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            {/* A disabled button explains nothing; this is the rule it is
                enforcing, said where the pickers are and announced when it
                starts to apply. */}
            {nothingMoves ? (
              <Text role="status" size="xs" tone="tertiary">
                {t.nothingMoves}
              </Text>
            ) : null}
          </fieldset>

          {capacity ? (
            <Text role="status" size="xs" tone="tertiary">
              {capacity}
            </Text>
          ) : null}

          <Button className={styles.submit} disabled={pending || !name || !on || nothingMoves} loading={adding} type="submit">
            {t.add}
          </Button>
        </form>
      )}

      {outcome ? (
        <Text role="status" size="sm" tone="secondary">
          {outcome === 'added' ? copy.added : t.removed}
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

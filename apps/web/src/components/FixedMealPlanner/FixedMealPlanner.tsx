'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import styles from './FixedMealPlanner.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { MAX_DISH_REQUEST } from 'core/domain/DishRequest';
import { Select, SelectOption } from 'ui/components/Select';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { CountedStanding } from 'core/domain/Allowance';
import type { FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { FixedMealHonourability } from 'core/controllers/FixedMeal';
import type { MealSlot } from 'core/entities/Plan';
import type { NotFixable } from 'core/domain/FixableReason';

/** A dish the API says can be fixed here. */
type Fixable = { readonly name: string; readonly slug: string };

/** A dish the library has that this person is not offered, and why (report `0011` § 2). */
type NotOffered = { readonly actionable: boolean; readonly name: string; readonly slug: string; readonly why: NotFixable };

type FixedMealPlannerProps = {
  /** The minutes they said they can cook, so "it takes longer" can say longer than what. Null only if the answer is missing. */
  readonly cookingMinutes: number | null;
  /** What is left of this month's dish requests — the second half of this screen (report `0011` § 4 a). */
  readonly dishRequests: CountedStanding;
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

/**
 * How long after the last keystroke the screen asks *why* the search found
 * nothing.
 *
 * Not free: the answer is assembled from this person's whole library, their
 * safety profile and the day's targets, so it is one real request — never one
 * per letter. Half a second is after typing has stopped and before the reader
 * has decided the library does not have it.
 */
const EXPLAIN_AFTER_MS = 500;

/**
 * The same reason said once, with every dish it took under it.
 *
 * Three dishes of the same name are usually refused for the same thing — the
 * owner's search returned three, all of them too slow — and a reason repeated
 * three times with its own link three times is a wall where one sentence and one
 * way forward would do. `Map` keeps the order the API ranked them in, which puts
 * what somebody can act on first.
 */
function grouped(found: readonly NotOffered[]): readonly { readonly names: readonly string[]; readonly why: NotFixable }[] {
  const byReason = new Map<NotFixable, string[]>();

  for (const each of found) {
    byReason.set(each.why, [...(byReason.get(each.why) ?? []), each.name]);
  }

  return [...byReason].map(([why, names]) => ({ names, why }));
}

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
 * It is one rule per **meal** of a weekday (`0101`): a day may hold a fixed
 * lunch and a fixed dinner, and the meal already spoken for is not offered
 * again — the database refuses a second one, and being refused after a tap is a
 * worse way to learn a rule than not being offered the meal. A day leaves the
 * list only when every meal this person eats already carries a rule.
 *
 * **The second rule of a day is offered a shorter list, and that is the
 * feature.** Two dishes each fittable on its own can leave a day unable to
 * reach its four macros, measured at 204 of 280 such days; the API offers only
 * the ones that still leave it solvable (`pinnable`'s `held`), so the list
 * shrinks and the sentence beside it says why.
 *
 * **A search that finds nothing now says why** (report `0011`). The owner searched for
 * *patatas a la riojana*, a dish his library has, and the screen showed him a
 * shorter list and said nothing: the dish took 50 minutes against a profile
 * that said 30. Three things answer that silence, in this order — the reasons
 * the library itself gives, the field that asks us to write the dish, and the
 * sentence that says asking is premium.
 */
export function FixedMealPlanner({ cookingMinutes, dishRequests, rules, slots, standing }: FixedMealPlannerProps) {
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
  const [reasons, setReasons] = useState<readonly NotOffered[]>();
  /** The name asked of us — the query until somebody edits it, and then their own words. */
  const [wish, setWish] = useState<string>();
  const [asked, setAsked] = useState<string>();
  const [asking, setAsking] = useState(false);
  /** Kept apart from the card's own error: this one belongs under the button that caused it. */
  const [askProblem, setAskProblem] = useState<string>();
  /**
   * Which standing rules the next plan could not honour (021 phase 5b).
   *
   * `undefined` until the list has been looked at, and `judged: false` when the
   * answer could not be computed — neither of them means the rules are fine, so
   * neither says anything on the screen.
   */
  const [honour, setHonour] = useState<FixedMealHonourability>();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'added' | 'removed'>();
  const [error, setError] = useState<string>();
  const explaining = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listRef = useRef<HTMLUListElement>(null);
  /** Whether the rules have been on screen, which is what buys the second request. */
  const looked = useRef(false);
  /** What the search field holds right now, to tell a late answer from the current question. */
  const typed = useRef('');

  // A meal of a day, not a day: since `0101` a day may hold more than one rule,
  // so what is spoken for is the meal — and a day leaves the list only when
  // every meal this person eats already carries one.
  const taken = new Set(rules.map(rule => `${rule.weekday}:${rule.slot}`));
  // Filtered by the rules on screen rather than cleared and asked again: a
  // judgement is about the rules it was made for, and the one that has just
  // been removed is the only one it can be wrong about. Dropping the whole
  // answer and losing the second request left three unhonourable rules
  // unmarked, under a «Quitada» that read as "that fixed it"
  // (`accessibility`, 2026-10-16). The API's order — actionable first, then by
  // weekday — survives the filter and the `Map`; the rows stay in the order the
  // list was in, because a list that re-sorts itself under the reader when a
  // background answer lands is a jump, not an explanation.
  const marks = (honour?.unhonoured ?? []).filter(each => rules.some(rule => rule.id === each.id));
  const unhonoured = new Map(marks.map(each => [each.id, each]));
  const free = WEEKDAYS.filter(day => slots.some(each => !taken.has(`${day}:${each}`)));
  const open = weekday === '' ? slots : slots.filter(each => !taken.has(`${weekday}:${each}`));
  // What the day the person is looking at already holds, which is why the dish
  // list can be shorter than the library and is worth saying out loud.
  const alsoFixed = weekday === '' ? [] : rules.filter(rule => String(rule.weekday) === weekday && rule.slot !== slot);
  const chosen = fixable?.find(candidate => candidate.slug === dish);
  // Accent-insensitive on both sides: somebody typing "limon" on a phone
  // keyboard is looking for "limón", and a search that disagrees reads as a
  // library that does not have it.
  const needle = plain(query);
  const matching = needle === '' ? (fixable ?? []) : (fixable ?? []).filter(candidate => plain(candidate.name).includes(needle));
  const wished = (wish ?? query).trim();
  // The library has nothing for them here: either nothing fits this meal at all,
  // or they searched for something it does not have. Both end in the same place.
  const missing =
    Boolean(weekday) && Boolean(slot) && fixable !== undefined && !chosen && (fixable.length === 0 || (needle.length >= 3 && matching.length === 0));

  /**
   * Which of these rules the next plan could not honour, and why.
   *
   * Its own request, and asked only once the rules are on screen: answering it
   * assembles a whole generation's context — 75–90 ms against the local
   * library, beside the 2 ms the rules themselves cost — and the profile has to
   * open no slower than it did before this existed (021 phase 5b). An answer
   * that cannot be had leaves the list exactly as it was: a card shouting about
   * a failed background read would be louder than the thing it explains.
   */
  async function judge() {
    try {
      setHonour(await api<FixedMealHonourability>('/fixed-meals/honourability'));
    } catch {
      // As `explain`: the mark is not the feature, and its absence is the
      // screen this phase started from rather than a new fault.
    }
  }

  /*
   * An `IntersectionObserver` rather than a fetch on mount, as `Reveal`: this
   * card sits far down a long profile, and somebody who never scrolls to it
   * never pays for the answer. It fires once and disconnects — the answer is
   * refreshed by a rule being added or removed, not by scrolling past twice.
   */
  useEffect(() => {
    const element = listRef.current;

    if (!element || looked.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        looked.current = true;
        observer.disconnect();
        void judge();
      },
      // Asked a screen before the list is reached, not as it arrives. A mark
      // landing late grows every row under it — measured, 110–183 px — and the
      // thing it pushes down is a row of buttons that delete. At the largest
      // font size the list can also still be below the fold when the card's
      // heading is on screen, and that reader needs the mark most
      // (`accessibility`, 2026-10-16).
      { rootMargin: '400px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
    // The list has to exist before it can be observed, and only a rule
    // arriving brings it into existence. Re-judging the rules themselves is
    // `settle`'s, not this effect's.
  }, [rules.length]);

  // As `VacationPlanner`: the button that was pressed disables itself while the
  // request is out, and a disabled element cannot hold focus, so without this
  // the next Tab starts from the top of the page. The heading is not an input,
  // so landing on it opens no keyboard on a phone.
  function settle(what: 'added' | 'removed') {
    setOutcome(what);
    titleRef.current?.focus();
    router.refresh();

    // Removing a rule can be exactly what makes another one honourable again
    // (`clashes_with_fixed` is a statement about a pair), so the judgement is
    // made again — and kept until the new one lands, or for ever if it never
    // does. A mark that was true a second ago is a far smaller fault than a
    // card that quietly stops saying anything.
    if (looked.current) {
      void judge();
    }
  }

  /** Asked again whenever the day or the meal changes: the answer depends on both. */
  async function offer(nextWeekday: string, nextSlot: string) {
    clearTimeout(explaining.current);
    setDish('');
    setFixable(undefined);
    setQuery('');
    setShown(PAGE);
    setReasons(undefined);
    setWish(undefined);
    setAsked(undefined);
    setAskProblem(undefined);
    setError(undefined);
    typed.current = '';

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

  /** Every keystroke in the search, and the one request a pause in it is worth. */
  function searched(value: string) {
    setQuery(value);
    setShown(PAGE);
    setReasons(undefined);
    typed.current = value;
    clearTimeout(explaining.current);

    if (plain(value).length >= 3) {
      explaining.current = setTimeout(() => void explain(value), EXPLAIN_AFTER_MS);
    }
  }

  /**
   * Why the library's own dishes of that name are not offered here.
   *
   * Only ever asked when the offered list answered nothing, which is the state
   * that used to say nothing at all.
   */
  async function explain(value: string) {
    const wanted = plain(value);

    if ((fixable ?? []).some(candidate => plain(candidate.name).includes(wanted))) {
      return;
    }

    try {
      // A read, sent as a POST: what somebody typed goes in the body, because a
      // query string reaches the platform's access log and that log is not ours
      // to redact.
      const found = await api<readonly NotOffered[]>('/fixed-meals/not-offered', {
        body: { query: value, slot, weekday: Number(weekday) },
        method: 'POST'
      });

      // An answer for "rioja" can land after "riojana" is on screen, and the
      // field is the only thing that says which question is still open.
      if (plain(typed.current) === wanted) {
        setReasons(found);
      }
    } catch {
      // An explanation is not the feature. If it cannot be had, the screen is
      // what it was before this existed — an alert about a missing reason would
      // be louder than the thing it explains.
    }
  }

  /**
   * Asks us to write a dish the library does not have.
   *
   * What goes out is the field below and nothing else: no profile, no health,
   * no plan. The notice beside it says so, because this is the one field in the
   * product whose content a model reads.
   */
  async function ask() {
    if (wished.length === 0) {
      return;
    }

    setAsking(true);
    setAsked(undefined);
    setAskProblem(undefined);
    setOutcome(undefined);

    try {
      const written = await api<Fixable>('/fixed-meals/request', { body: { name: wished, slot, weekday: Number(weekday) }, method: 'POST' });

      // Into the same list the picker chooses from, and chosen: the dish exists
      // now, and the press that fixes it is the one that was always there.
      setFixable([...(fixable ?? []), written].sort((a, b) => a.name.localeCompare(b.name)));
      setDish(written.slug);
      setReasons(undefined);
      setWish(undefined);
      setAsked(written.name);
      // What is left of the month is a server prop, and one was just spent.
      router.refresh();
    } catch (caught) {
      setAskProblem(askError(caught));
    } finally {
      setAsking(false);
    }
  }

  /**
   * The three refusals this call has of its own.
   *
   * None of them is the generic sentence: "nothing came back" is not a
   * conflict to the reader, and a spent month is not the same as a spent
   * fortnight. Everything else falls through to the shared copy.
   */
  function askError(caught: unknown): string {
    if (!(caught instanceof ApiError)) {
      return messageFor(caught, dictionary);
    }

    switch (caught.code) {
      case 'CONFLICT':
        return t.askNothing;

      case 'INVALID_INPUT':
        return t.askNotAName;

      case 'QUOTA_EXCEEDED':
        return interpolate(t.askSpent, { limit: dishRequests.limit });

      default:
        return messageFor(caught, dictionary);
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
      setReasons(undefined);
      setWish(undefined);
      setAsked(undefined);
      setAskProblem(undefined);
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

  /**
   * Where a reason a person can act on is acted on: the onboarding step that
   * owns that field, as the profile's own edit links point at it.
   *
   * Four of the five actionable reasons have a field behind them. The fifth —
   * `too_big_or_small` — has none: the way forward is another meal, and its own
   * sentence says so. The other four are statements, and a link under a
   * refusal would read as a way round it.
   *
   * The kitchen is the newest of them (`0102`). It was left without a route on
   * purpose when the reason arrived, because the step it points at did not
   * exist yet — a reason marked `actionable` sorting to the top with nothing to
   * do is worse than a reason that waits one phase.
   */
  function wayForward(why: NotFixable): { readonly href: string; readonly label: string } | undefined {
    switch (why) {
      case 'disliked':
        return { href: '/onboarding/5?volver=perfil', label: t.reasonFix.disliked };

      case 'excluded':
        return { href: '/onboarding/6?volver=perfil', label: t.reasonFix.excluded };

      case 'missing_equipment':
        return { href: '/onboarding/8?volver=perfil', label: t.reasonFix.missing_equipment };

      case 'too_slow':
        return { href: '/onboarding/7?volver=perfil', label: t.reasonFix.too_slow };

      default:
        return undefined;
    }
  }

  /** `too_slow` is the only reason that names a number, and it names the one they wrote. */
  function sentenceFor(why: NotFixable): string {
    return why === 'too_slow' && cookingMinutes !== null ? interpolate(t.tooSlowMinutes, { minutes: cookingMinutes }) : t.reasons[why];
  }

  /**
   * What changed under a rule that is no longer being honoured.
   *
   * Its own sentences, never `reasons`: those answer *why this dish is not
   * offered to you now, as you look for one*, and this answers *a rule you set
   * some time ago is not being honoured any more, and here is what changed*.
   * Same cause, different tense, different thing to do next (021 phase 5b).
   */
  function changedFor(why: NotFixable): string {
    return why === 'too_slow' && cookingMinutes !== null
      ? interpolate(t.unhonouredTooSlowMinutes, { minutes: cookingMinutes })
      : t.unhonouredReasons[why];
  }

  return (
    <Card as="section" className={styles.root}>
      <h3 className={styles.title} ref={titleRef} tabIndex={-1}>
        {t.title}
      </h3>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      {/* Over the list and not under it: it explains the marks, and an
          explanation read after the things it explains points backwards at rows
          somebody has already passed (`accessibility`, 2026-10-16).

          Only ever when there is something to report. `judged: false` means
          nobody could answer, and an account whose rules are all being honoured
          is the ordinary case — neither of them earns a sentence, and "all in
          order" would be a claim nobody checked (021 phase 5b). */}
      {honour?.judged && marks.length > 0 ? (
        <Text className={styles.unhonoured} role="status" size="xs" tone="secondary">
          {marks.length === 1 ? t.unhonouredCountOne : interpolate(t.unhonouredCount, { count: marks.length })}
        </Text>
      ) : null}

      {rules.length > 0 ? (
        <ul className={styles.list} ref={listRef}>
          {rules.map(rule => {
            // By the rule's own id, which the row already carries: matching on
            // the weekday and the slot would be two rules deep in the only
            // place where being wrong is worst.
            const broken = unhonoured.get(rule.id);
            const fix = broken ? wayForward(broken.why) : undefined;

            return (
              <li className={broken ? `${styles.row} ${styles.broken}` : styles.row} key={rule.id}>
                <span className={styles.when}>
                  <span className={styles.rule}>{interpolate(t.rule, { day: t.weekdays[rule.weekday], meal: t.slots[rule.slot] })}</span>
                  <Text as="span" size="xs" tone="tertiary">
                    {rule.dishName}
                  </Text>

                  {/* A word and a sentence, not a colour: forced colours erase
                      a border and a tint, and a row that said it only in amber
                      would say nothing there. */}
                  {broken ? (
                    <Fragment>
                      <span className={styles.mark}>{t.unhonouredMark}</span>
                      <Text as="span" size="xs" tone="secondary">
                        {changedFor(broken.why)}
                      </Text>
                      {fix ? (
                        <Link className={styles.fix} href={fix.href}>
                          {fix.label}
                        </Link>
                      ) : null}
                    </Fragment>
                  ) : null}
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
            );
          })}
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
              {open.map(each => (
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
          {/* Two different emptinesses, and they are not the same sentence: the
              library has nothing for that meal, or it has nothing that works
              beside the rule the day already holds. The second is the ordinary
              answer on a three-meal day with two rules, not an edge case. */}
          {fixable && fixable.length === 0 ? (
            <Text size="xs" tone="tertiary">
              {alsoFixed.length > 0 ? interpolate(t.noneBeside, { meal: t.slots[alsoFixed[0].slot].toLowerCase() }) : t.noneFit}
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
                    hint={
                      alsoFixed.length > 0
                        ? interpolate(fixable.length === 1 ? t.countBesideOne : t.countBeside, {
                            count: fixable.length,
                            meal: t.slots[alsoFixed[0].slot].toLowerCase()
                          })
                        : interpolate(fixable.length === 1 ? t.countOne : t.count, { count: fixable.length })
                    }
                    label={t.dish}
                    onChange={event => searched(event.target.value)}
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

          {/* What the silence used to be: the dishes of that name the library
              does have, each with the one thing standing between them and this
              meal — and, for the three that are a field somebody filled in, the
              way back to that field. */}
          {missing && reasons && reasons.length > 0 ? (
            <div className={styles.why}>
              <Text aria-live="polite" role="status" size="xs" tone="tertiary">
                {interpolate(reasons.length === 1 ? t.whyCountOne : t.whyCount, { count: reasons.length })}
              </Text>
              <ul className={styles.reasons}>
                {grouped(reasons).map(group => {
                  const fix = wayForward(group.why);

                  return (
                    <li className={styles.reason} key={group.why}>
                      <ul className={styles.named}>
                        {group.names.map(name => (
                          <li className={styles.rule} key={name}>
                            {name}
                          </li>
                        ))}
                      </ul>
                      <Text as="span" size="xs" tone="secondary">
                        {sentenceFor(group.why)}
                      </Text>
                      {fix ? (
                        <Link className={styles.fix} href={fix.href}>
                          {fix.label}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {missing ? (
            <div className={styles.ask}>
              <h4 className={styles.askTitle}>{t.askTitle}</h4>

              {dishRequests.allowed ? (
                <Fragment>
                  <Text size="xs" tone="secondary">
                    {t.askIntro}
                  </Text>

                  <Input
                    autoComplete="off"
                    label={t.askLabel}
                    maxLength={MAX_DISH_REQUEST}
                    onChange={event => setWish(event.target.value)}
                    // Enter here asks for the dish; it does not fix a meal that
                    // has not been chosen yet. The form's own button is still
                    // the only way to do that.
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void ask();
                      }
                    }}
                    placeholder={t.askPlaceholder}
                    type="text"
                    value={wish ?? query}
                  />

                  {/* Beside the field whose content leaves the product, not at
                      the top of a card somebody scrolled past. It is a standing
                      sentence and not a hint: a hint disappears the moment
                      there is text in the field. */}
                  <Text className={styles.notice} size="xs" tone="secondary">
                    {t.askNotice}
                  </Text>

                  {/* Secondary on purpose: this card's primary action is
                      fixing the meal, and two filled buttons in one card leave
                      a reader to work out which one is the point. */}
                  <Button
                    className={styles.askButton}
                    disabled={asking || pending || wished.length === 0}
                    loading={asking}
                    onClick={() => void ask()}
                    type="button"
                    variant="secondary"
                  >
                    {t.ask}
                  </Button>

                  {askProblem ? (
                    <Text className={styles.error} role="alert" size="xs">
                      {askProblem}
                    </Text>
                  ) : null}

                  <Text size="xs" tone="tertiary">
                    {interpolate(dishRequests.remaining === 1 ? t.askLeftOne : t.askLeft, {
                      limit: dishRequests.limit,
                      remaining: dishRequests.remaining
                    })}
                  </Text>
                </Fragment>
              ) : (
                <Text size="xs" tone="tertiary">
                  {/* A tier that was never allowed any is a different sentence
                      from a month that has spent them all. Told before anybody
                      types a name, not after. */}
                  {dishRequests.limit === 0 ? t.askPremium : interpolate(t.askSpent, { limit: dishRequests.limit })}
                </Text>
              )}
            </div>
          ) : null}

          <Button disabled={pending || !weekday || !slot || !dish} loading={pending} type="submit">
            {t.add}
          </Button>
        </form>
      ) : null}

      {asked ? (
        <Text role="status" size="sm" tone="secondary">
          {interpolate(t.asked, { name: asked })}
        </Text>
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

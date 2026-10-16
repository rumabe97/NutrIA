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
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, ApiError, messageFor } from 'lib/api';
import { formatList, interpolate } from 'lib/format';

import type { CountedStanding } from 'core/domain/Allowance';
import type { FixedMeal, Weekday } from 'core/entities/FixedMeal';
import type { FixedMealHonourability } from 'core/controllers/FixedMeal';
import type { MealSlot } from 'core/entities/Plan';
import type { NotFixable } from 'core/domain/FixableReason';

/** A dish the API says can be fixed here. */
type Fixable = { readonly name: string; readonly slug: string };

/**
 * What fixing the dish somebody just picked would cost (`0103`).
 *
 * Asked of **one** dish, never of the list: asking the day's arithmetic of the
 * whole library is the 4.02 s `0103` removed, and the dish somebody chose
 * answers in 82 ms. `acceptable` is the domain's own judgement of whether this
 * is a reason they may overrule — the screen never decides that itself, because
 * a second place deciding it is how the two come to disagree.
 */
type Consequence = { readonly acceptable: boolean; readonly fixable: false; readonly why: NotFixable } | { readonly fixable: true };

/** A dish the library has that this person is not offered, and why (report `0011` § 2). */
type NotOffered = { readonly actionable: boolean; readonly name: string; readonly slug: string; readonly why: NotFixable };

type FixedMealPlannerProps = {
  /** The minutes they said they can cook, so "it takes longer" can say longer than what. Null only if the answer is missing. */
  readonly cookingMinutes: number | null;
  /** What is left of this month's dish requests — the second half of this screen (report `0011` § 4 a). */
  readonly dishRequests: CountedStanding;
  /**
   * How many meals of one weekday may be fixed — the server's own number
   * (`FixedMealsView.maxPerDay`, `0103`), never a figure repeated here: a
   * number in a dictionary is a number that will disagree with the server.
   */
  readonly maxPerDay: number;
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
 * worse way to learn a rule than not being offered the meal. A weekday holds at
 * most `maxPerDay` of them (`0103`), and one that is full is **drawn and not
 * choosable** rather than gone: a Monday that disappears is a question, and the
 * answer to it is the words beside it.
 *
 * **A day's arithmetic is a warning somebody may accept, not a refusal**
 * (`0103`). The offer no longer hides the dishes a day cannot reach its macros
 * with — that filter was both the owner's refusal and the 4 s it cost — so the
 * list is the plate fit, and the day's arithmetic is asked of the one dish
 * somebody taps. What comes back is read **above the button that confirms it**:
 * the sentence says the day may not reach its numbers and that the call is
 * theirs, the button says so too, and the reason travels in `accept` when they
 * press it. A dialog that trained people to tap through would be the thing the
 * record says not to build. The one reason that cannot be accepted
 * (`too_big_or_small`, which the generation would drop anyway) states its
 * refusal in the same place, with the button dead.
 *
 * **A search that finds nothing now says why** (report `0011`). The owner searched for
 * *patatas a la riojana*, a dish his library has, and the screen showed him a
 * shorter list and said nothing: the dish took 50 minutes against a profile
 * that said 30. Three things answer that silence, in this order — the reasons
 * the library itself gives, the field that asks us to write the dish, and the
 * sentence that says asking is premium.
 */
export function FixedMealPlanner({ cookingMinutes, dishRequests, maxPerDay, rules, slots, standing }: FixedMealPlannerProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
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
  /**
   * What the dish on screen would cost, as the API answered it for that dish
   * (`0103`), with the slug it was asked about.
   *
   * The slug travels with the answer because a tap, «Cambiar» and a second tap
   * can all happen before the first answer lands, and a verdict shown under the
   * wrong dish is the worst thing this card could say.
   */
  const [consequence, setConsequence] = useState<{ readonly slug: string; readonly verdict: Consequence }>();
  const [checking, setChecking] = useState(false);
  /** The server refused the add because a screen that was behind had not read the warning. */
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'added' | 'removed'>();
  const [error, setError] = useState<string>();
  const explaining = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listRef = useRef<HTMLUListElement>(null);
  /** Whether the rules have been on screen, which is what buys the second request. */
  const looked = useRef(false);
  /**
   * Which consequence request is the current one.
   *
   * A count rather than the slug it is about: the same dish picked again after
   * the day changed is the same slug, and the first answer — Monday's — would
   * otherwise land under Tuesday's choice until the second one replaced it. The
   * server would still refuse the wrong accept, but a sentence that flashes the
   * wrong cost is exactly what this card must not do.
   */
  const checks = useRef(0);
  const chosenRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Whether the search field is coming back from a chosen dish, which is the only time it takes focus. */
  const returning = useRef(false);
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
  // The other list, and it is not the same news (`0103`): these rules **are
  // served**, and what misses its numbers is the day. Saying «no se está
  // cumpliendo» over one of them would be false, on the same screen, seconds
  // after somebody accepted exactly that trade — which is why the API answers
  // the two facts separately rather than in one field.
  //
  // Per **day** and not per rule, so every rule of a day that misses is in it:
  // the rows are marked by id, and the sentence over them counts days.
  const drifting = (honour?.outOfBand ?? []).filter(each => rules.some(rule => rule.id === each.id));
  const driftingRules = new Set(drifting.map(each => each.id));
  const driftingDays = new Set(drifting.map(each => each.weekday));
  // A weekday that has reached the two a day may hold (`0103`). Still listed,
  // and not choosable: a day gone from the list is a question nobody can answer.
  const filled = new Set(WEEKDAYS.filter(day => rules.filter(rule => rule.weekday === day).length >= maxPerDay));
  const listed = WEEKDAYS.filter(day => filled.has(day) || slots.some(each => !taken.has(`${day}:${each}`)));
  const free = listed.filter(day => !filled.has(day));
  const open = weekday === '' ? slots : slots.filter(each => !taken.has(`${weekday}:${each}`));
  // What the day the person is looking at already holds. Since `0103` it no
  // longer shortens the dish list — it is why a dish they pick may come back
  // with a warning on it, and that is what is worth saying out loud.
  const alsoFixed = weekday === '' ? [] : rules.filter(rule => String(rule.weekday) === weekday && rule.slot !== slot);
  const chosen = fixable?.find(candidate => candidate.slug === dish);
  // The answer is only ever read beside the dish it was asked about.
  const verdict = consequence?.slug === dish ? consequence.verdict : undefined;
  // What they may accept, and what they may not. `acceptable` is the API's, so
  // a reason that stops being acceptable stops being offered a way past here
  // without this file changing.
  const warning = verdict && !verdict.fixable && verdict.acceptable ? verdict.why : undefined;
  const refused = verdict && !verdict.fixable && !verdict.acceptable ? verdict.why : undefined;
  // A sentence for the warning, and the reason's own if this build knows the
  // reason but not yet its warning — the acceptable reasons are a list, and a
  // screen that printed nothing would hide the one thing it must say.
  const warned: Partial<Record<NotFixable, string>> = t.warnings;
  const warningText = warning === undefined ? undefined : (warned[warning] ?? t.reasons[warning]);
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

  /*
   * The press that chooses a dish unmounts the list that press was in, so
   * without this focus falls to the body and the next Tab starts from the top
   * of the page — `settle`'s problem and `settle`'s answer. It lands on the row
   * that replaced the list, which is the dish they chose, with what it costs
   * right under it (`0103`).
   */
  useEffect(() => {
    if (dish !== '') {
      chosenRef.current?.focus();

      return;
    }

    // And the other direction, which was the same defect mirrored: «Cambiar»
    // unmounts the row that held focus, so `activeElement` was `body` and the
    // next Tab restarted at «Saltar al contenido» (`warn-a11y`, 2026-10-16).
    // Only when coming back from a dish — on the first render there is nothing
    // to return from, and a card far down a long profile must not pull focus
    // into a search field nobody asked for.
    if (returning.current) {
      returning.current = false;
      searchRef.current?.focus();
    }
  }, [dish]);

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
    setConsequence(undefined);
    setStale(false);
    setChecking(false);
    typed.current = '';
    checks.current += 1;

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

  /**
   * A dish is picked, so what it would cost is asked — once, for that dish.
   *
   * The press that follows is the one that fixes the meal, and by then the
   * sentence above it says what fixing it costs (`0103`). Nothing is sent here:
   * this is a read, and a POST only so a dish somebody is considering never
   * lands in an access log.
   */
  function choose(slug: string) {
    setDish(slug);
    setConsequence(undefined);
    setStale(false);
    setError(undefined);
    void check(slug);
  }

  /** Back to the list. The verdict goes with the dish it was about, and so does the note about a screen that was behind. */
  function unchoose() {
    returning.current = true;
    setDish('');
    setConsequence(undefined);
    setStale(false);
  }

  /** The consequence request itself, shared by a tap and by a 409 that says this screen was behind. */
  async function check(slug: string) {
    const mine = ++checks.current;

    setChecking(true);

    try {
      const verdict = await api<Consequence>('/fixed-meals/consequence', {
        body: { dishSlug: slug, slot, weekday: Number(weekday) },
        method: 'POST'
      });

      if (checks.current === mine) {
        setConsequence({ slug, verdict });
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'FIXED_MEAL_DAY_FULL') {
        dayFilled();

        return;
      }

      // Said out loud rather than swallowed, because it changes what the next
      // press means: unlike the search's explanation, this is the sentence the
      // button was going to be read against. The button stays — the server is
      // the gate, and its 409 puts the warning where it belongs.
      if (checks.current === mine) {
        setError(t.checkFailed);
      }
    } finally {
      if (checks.current === mine) {
        setChecking(false);
      }
    }
  }

  /**
   * That weekday filled up between this screen and the server (`0103`).
   *
   * The day is cleared before the refresh, because the `Select` would otherwise
   * be holding a value that the list it is drawn from no longer has.
   */
  function dayFilled() {
    setWeekday('');
    setSlot('');
    void offer('', '');
    setError(interpolate(t.dayFull, { limit: maxPerDay }));
    router.refresh();
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
      // A dish we just wrote is chosen, so it is asked the same question a
      // tapped one is (`0103`): the button under it must say what fixing it
      // costs, whoever put it there.
      setConsequence(undefined);
      setStale(false);
      void check(written.slug);
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

      // One of the three routes that refuse a full day (`0103`). The day goes
      // with the sentence: a dish written against a day that cannot hold it
      // would leave somebody looking at a name and a dead button.
      case 'FIXED_MEAL_DAY_FULL':
        dayFilled();

        return interpolate(t.dayFull, { limit: maxPerDay });

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
      // The reason travels only when its sentence is on screen above the
      // button that was pressed (`0103`). Nothing is ever accepted on
      // somebody's behalf: with no warning read, this is an empty list and the
      // server is free to refuse.
      await api('/fixed-meals', { body: { accept: warning ? [warning] : [], dishSlug: dish, slot, weekday: Number(weekday) }, method: 'POST' });
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
      setConsequence(undefined);
      setStale(false);
      settle('added');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'FIXED_MEAL_DAY_FULL') {
        dayFilled();

        return;
      }

      if (caught instanceof ApiError && caught.code === 'FIXED_MEAL_WARNING') {
        // The server is the only real gate, and this screen was behind it:
        // somebody chose before the day held what it holds now. So the warning
        // goes where it should have been read — above the button — and the next
        // press is theirs. Never accepted here on their behalf, which is the
        // whole point of the record.
        setStale(true);
        // Before the re-check disables the button: Chrome moves focus off a
        // disabled element, which left the person who pressed it at the top of
        // the page while the sentence they had to read was halfway down it
        // (`warn-a11y`, 2026-10-16). The row the warning belongs to is where
        // the choose path lands too.
        chosenRef.current?.focus();
        void check(dish);

        return;
      }

      // A refusal now names its reason on the wire (`0103`), so the screen says
      // which one rather than «revisa los datos marcados».
      const why = refusedReason(caught);

      setError(why === undefined ? messageFor(caught, dictionary) : sentenceFor(why));
    } finally {
      setPending(false);
    }
  }

  /**
   * The reason a refusal names, when it is one this build knows (`0103`).
   *
   * `fieldErrors.dishSlug` carries a `NotFixable` now, and a string off the
   * wire is still a string: it is checked against the sentences this build has
   * before it is used as a key, because `t.reasons['…']` for an unknown one
   * would print nothing at somebody.
   */
  function refusedReason(caught: unknown): NotFixable | undefined {
    if (!(caught instanceof ApiError) || caught.code !== 'INVALID_INPUT') {
      return undefined;
    }

    const named = caught.fieldErrors.dishSlug?.[0];

    return named !== undefined && named in t.reasons ? (named as NotFixable) : undefined;
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
      <div className={styles.notices} role="status">
        {honour?.judged && marks.length > 0 ? (
          <Text className={styles.unhonoured} size="xs" tone="secondary">
            {marks.length === 1 ? t.unhonouredCountOne : interpolate(t.unhonouredCount, { count: marks.length })}
          </Text>
        ) : null}

        {/* Its own sentence, because it is its own news: these are served,
              and what misses its numbers is the day (`0103`). Folded into the
              one above it, it would tell somebody a rule had been dropped —
              which is exactly what they were promised would not happen. Counted
              in days, which is how the API answers it and what the sentence
              says. */}
        {honour?.judged && driftingDays.size > 0 ? (
          <Text className={styles.drifted} size="xs" tone="secondary">
            {driftingDays.size === 1 ? t.outOfBandCountOne : interpolate(t.outOfBandCount, { count: driftingDays.size })}
          </Text>
        ) : null}
      </div>

      {rules.length > 0 ? (
        <ul className={styles.list} ref={listRef}>
          {rules.map(rule => {
            // By the rule's own id, which the row already carries: matching on
            // the weekday and the slot would be two rules deep in the only
            // place where being wrong is worst.
            const broken = unhonoured.get(rule.id);
            // Served, and its day misses its numbers for it (`0103`). Not a
            // fault, so the row keeps its ordinary border, says a different
            // word and offers no way forward — there is nothing to put right.
            // Never drawn beside the mark above: a rule the plan does not carry
            // cannot also be the reason a day it is absent from misses.
            const drifts = !broken && driftingRules.has(rule.id);
            // The mark goes on every row of the day, because every one of them
            // is served and every one contributes to the miss — but the
            // sentence is the day's, so it is said on the first of them rather
            // than twice in a row into a screen reader (`warn-a11y`,
            // 2026-10-16). First in the order the **rows** are in, which is
            // `rules`: the API's order is its own, and a sentence that landed
            // on the second row would sit under a mark that had not explained
            // itself yet.
            const saysWhy = drifts && rules.find(each => each.weekday === rule.weekday && driftingRules.has(each.id))?.id === rule.id;
            const fix = broken ? wayForward(broken.why) : undefined;

            return (
              <li className={broken ? `${styles.row} ${styles.broken}` : drifts ? `${styles.row} ${styles.marked}` : styles.row} key={rule.id}>
                <span className={styles.when}>
                  <span className={styles.rule}>{interpolate(t.rule, { day: t.weekdays[rule.weekday], meal: t.slots[rule.slot] })}</span>
                  <Text as="span" size="xs" tone="tertiary">
                    {rule.dishName}
                  </Text>

                  {/* A word and a sentence, not a colour: forced colours erase
                      a border and a tint, and a row that said it only in amber
                      would say nothing there. */}
                  {drifts ? (
                    <Fragment>
                      <span className={styles.driftMark}>{t.outOfBandMark}</span>
                      {saysWhy ? (
                        <Text as="span" size="xs" tone="secondary">
                          {t.outOfBandNote}
                        </Text>
                      ) : null}
                    </Fragment>
                  ) : null}

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
              aria-describedby={filled.size > 0 ? `${id}-day-full` : undefined}
              aria-labelledby={`${id}-day`}
              onValueChange={value => {
                setWeekday(value);
                void offer(value, slot);
              }}
              placeholder={t.dayPlaceholder}
              value={weekday}
            >
              {/* A full day is drawn and not choosable, with the reason in the
                  words rather than in a grey (`0103`): a day that vanished
                  would send somebody looking for Monday, and a disabled row
                  that says nothing is the same silence a tint away. */}
              {listed.map(day => (
                <SelectOption
                  className={filled.has(day) ? styles.fullDay : undefined}
                  disabled={filled.has(day)}
                  indicator="✓"
                  key={day}
                  value={String(day)}
                >
                  {filled.has(day) ? interpolate(t.dayFullOption, { day: t.weekdays[day], limit: maxPerDay }) : t.weekdays[day]}
                </SelectOption>
              ))}
            </Select>

            {/* Inside the field, under the chooser, and on the trigger's
                `aria-describedby`: Radix really does skip a disabled option
                with the arrow keys — measured, the walk goes Martes…Domingo and
                never highlights Lunes — so the words inside the option are
                pointer-only and this is the keyboard's whole channel
                (`warn-a11y`, 2026-10-16). It names the days for the same
                reason: «no se puede elegir» without saying which leaves
                somebody to infer it from an absence. Between the two fields it
                would have been a full-width row in a wrapping flex line, which
                drops «Qué comida» to a line of its own. */}
            {filled.size > 0 ? (
              <Text className={styles.dayNote} id={`${id}-day-full`} size="xs" tone="tertiary">
                {interpolate(t.dayFullHint, {
                  days: formatList(
                    [...filled].map(day => t.weekdays[day].toLowerCase()),
                    locale
                  ),
                  limit: maxPerDay
                })}
              </Text>
            ) : null}
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
          {/* One emptiness now, and one sentence for it: since `0103` the offer
              is the plate fit, so nothing here means the library has nothing
              for that meal. It no longer means "nothing that works beside the
              rule the day already holds" — that is a warning on a dish, not an
              absence. */}
          {fixable && fixable.length === 0 ? (
            <Text size="xs" tone="tertiary">
              {t.noneFit}
            </Text>
          ) : null}

          {fixable && fixable.length > 0 ? (
            <div className={styles.dish}>
              {/* The list no longer gets shorter when the day already holds a
                  rule (`0103`), so this says what happens instead: the warning
                  comes when a dish is picked, before anything is fixed. */}
              {!chosen && alsoFixed.length > 0 ? (
                <Text className={styles.notice} size="xs" tone="secondary">
                  {interpolate(t.beside, { meal: t.slots[alsoFixed[0].slot].toLowerCase() })}
                </Text>
              ) : null}

              {chosen ? (
                <Fragment>
                  <div className={styles.chosen} ref={chosenRef} tabIndex={-1}>
                    <span className={styles.chosenName}>
                      <Text as="span" size="xs" tone="tertiary">
                        {t.dish}
                      </Text>
                      <span className={styles.rule}>{chosen.name}</span>
                    </span>
                    <Button onClick={unchoose} size="sm" type="button" variant="secondary">
                      {t.change}
                    </Button>
                  </div>

                  {/* What this dish costs, between the dish and the button that
                      fixes it — a row of its own and not inside the one above,
                      which is a flex row with a button in it and no room for a
                      sentence (`0103`).

                      Mounted the moment a dish is tapped, holding
                      «Comprobando…», and then the warning replaces that text: a
                      live region that arrives already full is often never
                      announced. */}
                  <div
                    aria-busy={checking}
                    className={
                      warningText ? `${styles.consequence} ${styles.warned}` : refused ? `${styles.consequence} ${styles.denied}` : styles.consequence
                    }
                    role="status"
                  >
                    {checking ? (
                      <Text as="span" size="xs" tone="tertiary">
                        {t.checking}
                      </Text>
                    ) : (
                      <Fragment>
                        {stale ? (
                          <Text as="span" size="xs" tone="secondary">
                            {t.warningStale}
                          </Text>
                        ) : null}

                        {/* A word, then the sentence, then the button that says
                            the same thing: forced colours erases a tint, and a
                            warning that was only amber would say nothing there. */}
                        {warningText ? (
                          <Fragment>
                            <span className={styles.mark}>{t.warningMark}</span>
                            <Text as="span" size="xs" tone="secondary">
                              {warningText}
                            </Text>
                          </Fragment>
                        ) : null}

                        {/* No way past, and nothing that reads like one: this is
                            the plate fit, which the generation would drop
                            whatever anybody accepted (`0103`). The button below
                            is dead while it is on screen. */}
                        {refused ? (
                          <Fragment>
                            <span className={styles.refusal}>{t.refusalMark}</span>
                            <Text as="span" size="xs" tone="secondary">
                              {sentenceFor(refused)}
                            </Text>
                          </Fragment>
                        ) : null}
                      </Fragment>
                    )}
                  </div>
                </Fragment>
              ) : (
                <Fragment>
                  <Input
                    autoComplete="off"
                    hint={interpolate(fixable.length === 1 ? t.countOne : t.count, { count: fixable.length })}
                    label={t.dish}
                    onChange={event => searched(event.target.value)}
                    placeholder={t.searchPlaceholder}
                    ref={searchRef}
                    type="search"
                    value={query}
                  />

                  {/* The count is what changes as somebody types, so it is the
                      thing a screen reader should hear — not each row arriving. */}
                  <Text className={styles.matches} role="status" size="xs" tone="tertiary">
                    {matching.length === 0
                      ? interpolate(t.noMatch, { query })
                      : interpolate(matching.length === 1 ? t.matchOne : t.match, { count: matching.length })}
                  </Text>

                  {matching.length > 0 ? (
                    <ul className={styles.options}>
                      {matching.slice(0, shown).map(candidate => (
                        <li key={candidate.slug}>
                          <button className={styles.option} onClick={() => choose(candidate.slug)} type="button">
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
              <Text role="status" size="xs" tone="tertiary">
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

          {/* Dead while the consequence is being asked and while a refusal is
              on screen; the label changes when a warning is, so what is pressed
              says what it costs (`0103`). `loading` stays the request this
              button sent — the check was started by the tap on the dish, and
              «Comprobando…» is that one's own feedback. */}
          <Button disabled={pending || checking || !weekday || !slot || !dish || refused !== undefined} loading={pending} type="submit">
            {warningText ? t.addAnyway : t.add}
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

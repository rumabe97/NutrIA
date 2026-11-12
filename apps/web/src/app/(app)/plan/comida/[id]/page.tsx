import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { DishActions } from 'components/DishActions';
import { DishArrival } from 'components/DishArrival';
import { DishShare } from 'components/DishShare';
import { EmptyState } from 'components/EmptyState';
import { MacroSummary } from 'components/MacroSummary';
import { MealAccompaniments } from 'components/MealAccompaniments';
import { MealEquipment } from 'components/MealEquipment';
import { MealPicture } from 'components/MealPicture';
import { MealStatus } from 'components/MealStatus';
import { MealSwap } from 'components/MealSwap';
import { RecipeVerdict } from 'components/RecipeVerdict';

import { difficultyLabel, slotLabel } from 'lib/generation';
import { dishTransitionNames } from 'lib/dishTransition';
import { formatDate, formatNumber, formatQuantity, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { resumesOn } from 'lib/vacation';
import { serverApi, serverApiResult } from 'lib/server-api';
import { swapOffered } from 'lib/mealSwap';

import { appMetadata } from '../../../../_shared/metadata';

import type { AllowancesView, MealDetailView, PlanView } from 'core/controllers/Plan';
import type { FullProfileView } from 'core/controllers/Profile';
import type { Macros } from 'lib/dayRings';
import type { MealStatus as Status } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { VacationView } from 'core/controllers/Vacation';

const NO_BREAK_SPACE = ' ';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/comida');
}

/**
 * What the meal's day was built to hit, for its share of the day: the day's own targets
 * on a day that eats for an event, the plan's otherwise — both read off the plan being
 * lived. A meal of an earlier plan has neither at hand, and is measured against the
 * person's targets in effect. Null when nothing is known: the page then shows the dish's
 * figures alone.
 */
function dayTargets(meal: MealDetailView, plan: PlanView | null, profile: FullProfileView | null): Macros | null {
  if (plan?.id === meal.planId) {
    const day = plan.days.find(candidate => candidate.dayIndex === meal.dayIndex);
    const targets = day?.targets ?? plan.strategy;

    if (targets) {
      return targets;
    }
  }

  return profile?.targets?.effective ?? null;
}

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await redirectIfOnboardingIncomplete();

  const { id } = await params;
  const [dictionary, locale, answer, allowances, trips, plan, profile] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApiResult<MealDetailView>(`/meal-plans/meals/${id}`),
    serverApi<AllowancesView>('/meal-plans/allowances'),
    serverApi<readonly VacationView[]>('/vacations'),
    // Only for the day's targets, which the meal's own view does not carry.
    serverApi<PlanView | null>('/meal-plans/active'),
    serverApi<FullProfileView>('/profile')
  ]);
  const meal = answer.body;

  // A meal of a fortnight premium opens (`0021` § *Amended*). The meal's page is
  // the other way into an earlier plan — from the shopping list, from a link
  // somebody kept — so it explains the same thing the plan's own screen does
  // rather than showing a 404 for something that is theirs and still there.
  if (answer.code === 'PREMIUM_ONLY') {
    return (
      <EmptyState body={dictionary.plan.lockedBody} title={dictionary.plan.lockedTitle}>
        <CtaLink href="/perfil" size="lg">
          {dictionary.plan.historyLockedCta}
        </CtaLink>
        <CtaLink href="/plan" size="lg" variant="secondary">
          {dictionary.plan.title}
        </CtaLink>
      </EmptyState>
    );
  }

  if (!meal) {
    notFound();
  }

  const away = trips?.find(trip => trip.away);
  // Its day has not come. Offering the control anyway is offering something the
  // API will refuse, which is how a screen teaches somebody not to trust it.
  const notYet = meal.date > new Date().toISOString().slice(0, 10);

  const totalMinutes = meal.prepMinutes + meal.cookMinutes;
  // Only a meal of the plan being lived can be marked or swapped (0021); one of
  // an earlier plan is shown as it was, and the way back leads to that plan.
  const editable = meal.planStatus === 'active';
  const targets = dayTargets(meal, plan, profile);
  const names = dishTransitionNames(meal.id);

  /*
   * What can be done with this meal: eaten or skipped, and another dish — only for a meal
   * still to come, since a plate already eaten is not something to change. The state is
   * the message; the buttons carry it, and nothing is explained under them. Paused means
   * paused (`0032`): marking a meal you are not eating records something that did not
   * happen, and a swap spends an allowance on a fortnight nobody is living. The API
   * refuses all three; the sentence says why nothing is offered.
   */
  const controls = editable && !away;
  const actions = controls ? (
    <DishActions>
      {/* Marking waits for the day; swapping does not — changing tomorrow's
          dinner today is the whole point of a plan you can steer. */}
      {notYet ? (
        <Text size="sm" tone="tertiary">
          {interpolate(dictionary.meal.notYet, { date: formatDate(meal.date, locale, { day: 'numeric', month: 'long' }) })}
        </Text>
      ) : (
        <MealStatus mealId={meal.id} status={meal.status as Status} />
      )}
      {allowances &&
      swapOffered({ allowanceKnown: true, away: Boolean(away), mealStatus: meal.status, offline: false, planStatus: meal.planStatus }) ? (
        <MealSwap
          compact={true}
          limit={allowances.mealSwaps.limit}
          mealId={meal.id}
          remaining={allowances.mealSwaps.remaining}
          totalMinutes={totalMinutes}
        />
      ) : null}
    </DishActions>
  ) : (
    <Text className={styles.readOnly} size="sm" tone="tertiary">
      {away
        ? interpolate(dictionary.vacations.pausedUntil, { date: formatDate(resumesOn(away.endsOn), locale, { day: 'numeric', month: 'long' }) })
        : dictionary.meal.readOnly}
    </Text>
  );

  return (
    <div className={styles.page} data-actions={controls || undefined}>
      {/* Tells a card's View Transition that this page has arrived (`lib/dishTransition`). */}
      <DishArrival />

      <Link className={styles.back} href={editable ? '/plan' : `/plan/historial/${meal.planId}`}>
        {editable ? dictionary.meal.back : dictionary.meal.backToHistory}
      </Link>

      <div className={styles.overview}>
        {/* The dish first, as itself: its picture large — or its designed state, which
            most dishes have today — with its slot and name on a strip over the picture's
            foot. A generated picture says so: the mark on it, its name and the caption
            (`0066`). The picture and the name share their View Transition names with
            the card that opened this page. */}
        <div className={`${styles.hero} motion-enter`}>
          <MealPicture
            name={meal.name}
            path={meal.illustrationPath}
            recipeId={meal.recipeId}
            slot={meal.slot}
            status={meal.pictureStatus}
            transitionName={names.picture}
          >
            <span className={styles.slot}>{interpolate(dictionary.meal.dayOf, { day: meal.dayIndex, slot: slotLabel(meal.slot, dictionary) })}</span>
            {/* The dish and its method were written by a model — every recipe in the library was, the
                seed included — so both carry the machine-readable mark (AI Act art. 50.2). */}
            <h1 className={styles.title} data-ai-generated="true" style={{ viewTransitionName: names.title }}>
              {meal.name}
            </h1>
          </MealPicture>
        </div>

        <div className={`${styles.side} motion-list`}>
          {actions}

          <div className={styles.facts}>
            {totalMinutes > 0 ? (
              <span className={styles.fact}>
                <svg aria-hidden="true" className={styles.factIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="5.75" />
                  <path d="M8 5v3.2l2 1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {interpolate(dictionary.meal.totalMinutes, { minutes: totalMinutes })}
              </span>
            ) : (
              <span className={styles.fact}>{dictionary.meal.noCooking}</span>
            )}
            <span className={styles.fact}>{difficultyLabel(meal.difficulty, dictionary)}</span>
            {meal.cuisine ? <span className={styles.fact}>{meal.cuisine}</span> : null}
          </div>

          {/* What the dish cannot be cooked without (`0102`), where the minutes and
              the difficulty are: it belongs to the same question — can I make this
              tonight — and it is read before the ingredients, not after them. */}
          <MealEquipment dictionary={dictionary} equipment={meal.equipment} />

          {/* Its share of the day, as rings with the figures and percentages in words;
              with no target known, the dish's figures as they were. Either way the
              note on where the figures come from stays with them. */}
          {targets ? (
            <div className={styles.macros}>
              <DishShare
                dictionary={dictionary}
                dish={{ carbsG: meal.carbsG, fatG: meal.fatG, kcal: meal.kcal, proteinG: meal.proteinG }}
                locale={locale}
                targets={targets}
              />
            </div>
          ) : (
            <MacroSummary carbsG={meal.carbsG} fatG={meal.fatG} kcal={meal.kcal} note={dictionary.macros.note} proteinG={meal.proteinG} />
          )}
        </div>
      </div>

      <section className={styles.section}>
        {/* The quantities below are already scaled to this meal's portion; the heading's
            line says for how many, as the sheet draws it. */}
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{dictionary.meal.ingredients}</h2>
          <Text size="sm" tone="secondary">
            {interpolate(dictionary.meal.servingNote, {
              servings: formatNumber(Math.round(meal.servings * 100) / 100, locale),
              unit: meal.servings === 1 ? dictionary.meal.servingUnitOne : dictionary.meal.servingUnitOther
            })}
          </Text>
        </div>

        <ul className={`${styles.ingredients} motion-list`}>
          {meal.ingredients.map(ingredient => (
            <li className={styles.ingredient} key={ingredient.name}>
              <div className={styles.ingredientLine}>
                {/* Cooked grains and pastas are weighed dry in the kitchen, so the line
                    gives the dry weight first and the cooked one the plate ends up with. */}
                {ingredient.dry ? (
                  <span className={styles.ingredientName}>
                    {interpolate(dictionary.meal.dryLine, {
                      dry: formatQuantity(ingredient.dry.grams, 'g', locale, dictionary).replace(' ', NO_BREAK_SPACE),
                      name: ingredient.dry.name
                    })}{' '}
                    {/* One unbreakable piece: the line breaks before the cooked weight, never inside it. */}
                    <span className={styles.cooked}>
                      {interpolate(dictionary.meal.cookedNote, { cooked: formatQuantity(ingredient.grams, 'g', locale, dictionary) })}
                    </span>
                  </span>
                ) : (
                  <Fragment>
                    <span className={styles.ingredientName}>{ingredient.name}</span>
                    <span className={styles.quantity}>{formatQuantity(ingredient.grams, 'g', locale, dictionary)}</span>
                  </Fragment>
                )}
              </div>
              {/* What to buy instead when the shop has none — already filtered for
                  this person's allergens and scaled to this portion, so the line
                  can be followed as written. Staples have none, on purpose. */}
              {ingredient.alternatives.length > 0 ? (
                <Text as="span" className={styles.alternatives} size="sm" tone="secondary">
                  {dictionary.meal.alternatives}:{' '}
                  {ingredient.alternatives
                    .map(alternative => `${alternative.name} (${formatQuantity(alternative.grams, 'g', locale, dictionary)})`)
                    .join(' · ')}
                </Text>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Between what goes in and how it is made: the four numbers a cook checks before
          starting, and where the dish's figures come from when no target was known. */}
      <section className={styles.section}>
        <Card as="dl" className={styles.spec}>
          {[
            { label: dictionary.meal.prep, value: interpolate(dictionary.meal.minutes, { value: formatNumber(meal.prepMinutes, locale) }) },
            {
              label: dictionary.meal.cook,
              value:
                meal.cookMinutes > 0 ? interpolate(dictionary.meal.minutes, { value: formatNumber(meal.cookMinutes, locale) }) : dictionary.meal.none
            },
            { label: dictionary.meal.servingsLabel, value: formatNumber(Math.round(meal.servings * 100) / 100, locale) },
            { label: dictionary.meal.difficultyLabel, value: difficultyLabel(meal.difficulty, dictionary) }
          ].map(item => (
            <div className={styles.specItem} key={item.label}>
              <dt className={styles.specLabel}>{item.label}</dt>
              <dd className={styles.specValue}>{item.value}</dd>
            </div>
          ))}
        </Card>
        {targets ? (
          <Text className={styles.figuresNote} size="xs" tone="tertiary">
            {dictionary.macros.note}
          </Text>
        ) : null}
      </section>

      {/* After the dish's own ingredients and before its method: what is eaten
          beside the plate, with the energy it adds to the meal. */}
      <MealAccompaniments dictionary={dictionary} locale={locale} mealKcal={meal.kcal} sides={meal.accompaniments} />

      {meal.steps.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{dictionary.meal.steps}</h2>
          <ol className={styles.steps} data-ai-generated="true">
            {meal.steps.map(step => (
              <li className={styles.step} key={step.text}>
                {/* The step, then what the cook watches for and how long it takes —
                    the two things a method leaves out when it is written to be
                    short rather than to be followed. */}
                <div className={styles.stepBody}>
                  <Text>{step.text}</Text>
                  {step.cue || step.minutes ? (
                    <Text as="span" className={styles.stepCue} size="sm" tone="secondary">
                      {step.cue ? <span>{step.cue}</span> : null}
                      {step.cue && step.minutes ? <span aria-hidden="true"> · </span> : null}
                      {step.minutes ? (
                        <span className={styles.stepTime}>{interpolate(dictionary.meal.minutes, { value: formatNumber(step.minutes, locale) })}</span>
                      ) : null}
                    </Text>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* The verdict comes last, after the recipe: it is asked of someone who has
          cooked or eaten the dish, and that is where they are when they reach it. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{dictionary.meal.verdictTitle}</h2>
        {away ? null : <RecipeVerdict recipeId={meal.recipeId} verdict={meal.verdict} />}
      </section>
    </div>
  );
}

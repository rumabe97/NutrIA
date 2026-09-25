import { Fragment } from 'react';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CareAccessLog } from 'components/CareAccessLog';
import { CareLinkCard } from 'components/CareLinkCard';
import { DeleteAccount } from 'components/DeleteAccount';
import { FeedbackForm } from 'components/FeedbackForm';
import { HealthPanel } from 'components/HealthPanel';
import { LocaleSwitcher } from 'components/LocaleSwitcher';
import { PremiumCard } from 'components/PremiumCard';
import { ProfileConsentCard } from 'components/ProfileConsentCard';
import { ProfileSection } from 'components/ProfileSection';
import { PushToggle } from 'components/PushToggle';
import { ReminderToggle } from 'components/ReminderToggle';
import { TargetsPanel } from 'components/TargetsPanel';
import { Tour } from 'components/Tour';
import { VacationPlanner } from 'components/VacationPlanner';

import { MEAL_SLOTS } from 'core/entities/Plan';

import { formatNumber, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { BillingStatusView } from 'core/controllers/Billing';
import type { CareAccessPageView, CareLinkView } from 'core/controllers/Care';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FullProfileView } from 'core/controllers/Profile';
import type { HealthView } from 'core/controllers/Health';
import type { Metadata } from 'next';
import type { NotificationSettingsView } from 'core/controllers/Notification';
import type { UserView } from 'core/controllers/User';
import type { VacationView } from 'core/controllers/Vacation';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/perfil');
}

function list(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.join(', ') : empty;
}

/**
 * What is kept out and what is only asked for, said separately.
 *
 * A dislike the catalogue can act on is a promise — "pescado" leaves every fish
 * out of the plan. One it cannot resolve is a line in a prompt, which a model
 * may ignore. One list showing both as the same thing is the lie: the reader
 * has no way to tell which half they are in (0025).
 */
function avoidValue(disliked: readonly { enforced: boolean; label: string }[], t: Dictionary['profile']): string | undefined {
  if (disliked.length === 0) {
    return undefined;
  }

  const enforced = disliked.filter(item => item.enforced).map(item => item.label);
  const asked = disliked.filter(item => !item.enforced).map(item => item.label);

  return [
    enforced.length > 0 ? interpolate(t.youAvoidEnforced, { labels: enforced.join(', ') }) : '',
    asked.length > 0 ? interpolate(t.youAvoidBestEffort, { labels: asked.join(', ') }) : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export default async function ProfilePage({ searchParams }: Readonly<{ searchParams: Promise<{ premium?: string }> }>) {
  // The profile screen and onboarding edit the same tables. Someone who has not
  // finished belongs in the flow that is filling them in, not in a read-only
  // view of half of them.
  await redirectIfOnboardingIncomplete();

  // Health data is fetched here and only here. It is not folded into
  // `/profile`, which the dashboard also loads — a medication has no business
  // travelling to a screen that does not show it.
  const [dictionary, locale, user, profile, health, notifications, push, billing, trips, careLink, accessLog, query] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<UserView>('/users/me'),
    serverApi<FullProfileView>('/profile'),
    serverApi<HealthView>('/health-data'),
    serverApi<NotificationSettingsView>('/notifications/settings'),
    // Null when push is not set up on the API (`0054`), and then no switch is offered for it.
    serverApi<{ readonly publicKey: string | null }>('/notifications/push'),
    // Unavailable unless payments are set up and open to this person (`0056`); then no card is drawn.
    serverApi<BillingStatusView>('/billing'),
    serverApi<readonly VacationView[]>('/vacations'),
    // Null with no active or paused link — not behind the `professional` switch,
    // because consent is revocable whatever it says.
    serverApi<CareLinkView | null>('/care/links/me'),
    // The client's own trail (`0059`): what was read about them stays theirs to
    // see whatever the switch says, so this is fetched whether or not a link exists.
    serverApi<CareAccessPageView>('/care/access-log'),
    searchParams
  ]);
  const t = dictionary.profile;
  const kg = (value: number) => `${formatNumber(value, locale)} ${dictionary.units.kilogram}`;
  const person = profile?.profile;
  const goal = profile?.goal;
  const preferences = profile?.preferences;
  const foodPreferences = profile?.foodPreferences ?? [];

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text tone="secondary">{t.subtitle}</Text>

      {/* Persistent and not dismissable. A notice you can close is a notice that
          is absent for everyone who closed it once, and this one is the whole of
          what the product is willing to say about a recorded condition. */}
      {health?.supervisionRecommended ? (
        <p className={styles.supervision} role="note">
          {t.supervision}
        </p>
      ) : null}

      <div className={`${styles.sections} motion-list`}>
        {/* What the plan is built from: the figures, the health record, trips
            that pause it, and what paying adds. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sectionPlan}</h2>

          {profile?.targets ? <TargetsPanel targets={profile.targets} /> : null}

          {health ? <HealthPanel health={health} /> : null}

          <VacationPlanner trips={trips ?? []} />

          {billing?.available ? (
            <Card>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>{t.premiumTitle}</h3>
              </div>
              {/* `?premium=gracias` is where Stripe's checkout sends somebody back to. */}
              <PremiumCard justPaid={query.premium === 'gracias'} status={billing} />
            </Card>
          ) : null}
        </section>

        {/* The link to a professional, if any (PRD 004, criterion 4), and the
            trail of who read what — shown whether or not a link exists, because
            what was once read about somebody stays theirs to see. */}
        {careLink || (accessLog && accessLog.entries.length > 0) ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.sectionCare}</h2>

            {careLink ? <CareLinkCard link={careLink} /> : null}

            {accessLog ? <CareAccessLog initial={accessLog} /> : null}
          </section>
        ) : null}

        {/* What was answered at the start, each block with its way back to the step that owns it. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sectionData}</h2>

          <ProfileSection
            editHref="/onboarding/1?volver=perfil"
            rows={[
              { label: t.name, value: user?.name },
              { label: t.email, value: user?.email },
              { label: t.emailVerified, value: user?.emailVerified ? t.emailVerifiedYes : t.emailVerifiedNo }
            ]}
            title={t.account}
          />

          <ProfileSection
            editHref="/onboarding/1?volver=perfil"
            rows={[
              { label: t.displayName, value: person?.displayName },
              { label: dictionary.onboarding.fields.birthDate, value: person?.birthDate },
              { label: t.height, value: person?.heightCm ? `${formatNumber(person.heightCm, locale)} cm` : undefined },
              // Shown because it changes the plan (`0034`): a figure somebody can
              // see is a figure they can correct.
              {
                label: dictionary.onboarding.fields.country,
                value: person?.country ? dictionary.onboarding.options.countries[person.country as 'ES' | 'GB'] : undefined
              }
            ]}
            title={t.personalData}
          />

          <ProfileSection
            editHref="/onboarding/2?volver=perfil"
            rows={[
              { label: t.goal, value: goal ? dictionary.goals[goal.type] : undefined },
              { label: t.startingWeight, value: goal?.startingWeightKg ? kg(goal.startingWeightKg) : undefined },
              { label: t.targetWeight, value: goal?.targetWeightKg ? kg(goal.targetWeightKg) : undefined },
              {
                label: t.pace,
                value: goal?.paceKgPerWeek ? interpolate(dictionary.units.perWeek, { value: formatNumber(goal.paceKgPerWeek, locale) }) : undefined
              }
            ]}
            title={t.goal}
          />

          <ProfileSection
            editHref="/onboarding/6?volver=perfil"
            rows={[
              {
                label: t.allergies,
                value: list(
                  (profile?.allergies ?? []).map(allergy => allergy.allergenLabel),
                  t.none
                )
              },
              {
                label: t.intolerances,
                value: list(
                  (profile?.intolerances ?? []).map(intolerance => intolerance.allergenLabel),
                  t.none
                )
              },
              { label: t.dietaryPatterns, value: list(profile?.dietaryPatterns ?? [], t.noRestriction) }
            ]}
            title={t.restrictions}
          />

          <ProfileSection
            editHref="/onboarding/4?volver=perfil"
            rows={[
              {
                // The meals they eat, named, with the ones they eat differently
                // said so. A count would hide the whole point of the answer (`0036`).
                label: dictionary.onboarding.fields.mealShape,
                value: preferences?.mealShape
                  ? MEAL_SLOTS.filter(slot => preferences.mealShape[slot] !== 'off')
                      .map(slot => {
                        const size = preferences.mealShape[slot];

                        return size === 'normal'
                          ? dictionary.onboarding.options.mealSlots[slot]
                          : `${dictionary.onboarding.options.mealSlots[slot]} (${dictionary.onboarding.options.mealSizes[size].toLowerCase()})`;
                      })
                      .join(', ')
                  : undefined
              },
              { label: t.activity, value: preferences?.activityLevel ? dictionary.activity[preferences.activityLevel] : undefined },
              {
                label: t.cookingTime,
                value: preferences?.cookingTimeMinutes
                  ? interpolate(t.minutes, { value: formatNumber(preferences.cookingTimeMinutes, locale) })
                  : undefined
              }
            ]}
            title={t.howYouEat}
          />

          <ProfileSection
            editHref="/onboarding/5?volver=perfil"
            rows={[
              {
                label: t.youLike,
                value: list(
                  foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
                  t.unset
                )
              },
              {
                label: t.youAvoid,
                value: avoidValue(
                  foodPreferences.filter(item => item.sentiment === 'disliked'),
                  t
                )
              },
              { label: t.cuisines, value: list(profile?.cuisines ?? [], t.unset) }
            ]}
            title={t.preferences}
          />

          {/* Controls what the sections above run on: your body, your goal and
              your restrictions (`docs/legal/textos/05-consentimientos-cliente.md`
              § A), not the account itself. */}
          <ProfileConsentCard />
        </section>

        {/* How the product speaks to this person: which reminders, and in which language. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sectionNotices}</h2>

          <Card>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>{t.reminders}</h3>
            </div>
            <ReminderToggle enabled={notifications?.checkInEmail ?? true} />
            {push?.publicKey ? <PushToggle publicKey={push.publicKey} /> : null}
          </Card>

          <LocaleSwitcher />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sectionHelp}</h2>

          <Tour replay={true} />

          <FeedbackForm />
        </section>

        {/* Last, on its own, and named for what it does. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sectionDanger}</h2>

          <Card className={styles.danger}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>{t.dangerTitle}</h3>
            </div>
            <Text size="sm" tone="secondary">
              {t.deleteAllBody}
            </Text>
            <DeleteAccount />
          </Card>
        </section>
      </div>
    </Fragment>
  );
}

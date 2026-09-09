import { Fragment } from 'react';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { DeleteAccount } from 'components/DeleteAccount';
import { HealthPanel } from 'components/HealthPanel';
import { LocaleSwitcher } from 'components/LocaleSwitcher';
import { ProfileSection } from 'components/ProfileSection';
import { TargetsPanel } from 'components/TargetsPanel';

import { formatNumber, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { FullProfileView } from 'core/controllers/Profile';
import type { HealthView } from 'core/controllers/Health';
import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

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
  if (disliked.length === 0) {return undefined;}

  const enforced = disliked.filter(item => item.enforced).map(item => item.label);
  const asked = disliked.filter(item => !item.enforced).map(item => item.label);

  return [
    enforced.length > 0 ? interpolate(t.youAvoidEnforced, { labels: enforced.join(', ') }) : '',
    asked.length > 0 ? interpolate(t.youAvoidBestEffort, { labels: asked.join(', ') }) : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export default async function ProfilePage() {
  // The profile screen and onboarding edit the same tables. Someone who has not
  // finished belongs in the flow that is filling them in, not in a read-only
  // view of half of them.
  await redirectIfOnboardingIncomplete();

  // Health data is fetched here and only here. It is not folded into
  // `/profile`, which the dashboard also loads — a medication has no business
  // travelling to a screen that does not show it.
  const [dictionary, locale, user, profile, health] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<UserView>('/users/me'),
    serverApi<FullProfileView>('/profile'),
    serverApi<HealthView>('/health-data')
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
        {profile?.targets ? <TargetsPanel targets={profile.targets} /> : null}

        {health ? <HealthPanel health={health} /> : null}

        <LocaleSwitcher />

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
            { label: t.height, value: person?.heightCm ? `${formatNumber(person.heightCm, locale)} cm` : undefined }
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
            { label: t.allergies, value: list((profile?.allergies ?? []).map(allergy => allergy.allergenLabel), t.none) },
            { label: t.intolerances, value: list((profile?.intolerances ?? []).map(intolerance => intolerance.allergenLabel), t.none) },
            { label: t.dietaryPatterns, value: list(profile?.dietaryPatterns ?? [], t.noRestriction) }
          ]}
          title={t.restrictions}
        />

        <ProfileSection
          editHref="/onboarding/4?volver=perfil"
          rows={[
            {
              label: dictionary.onboarding.fields.mealsPerDay,
              value: preferences?.mealsPerDay ? formatNumber(preferences.mealsPerDay, locale) : undefined
            },
            { label: t.snacks, value: preferences?.includesSnacks ? t.yes : t.no },
            { label: t.activity, value: preferences?.activityLevel ? dictionary.activity[preferences.activityLevel] : undefined },
            {
              label: t.cookingTime,
              value: preferences?.cookingTimeMinutes ? interpolate(t.minutes, { value: formatNumber(preferences.cookingTimeMinutes, locale) }) : undefined
            }
          ]}
          title={t.howYouEat}
        />

        <ProfileSection
          editHref="/onboarding/5?volver=perfil"
          rows={[
            { label: t.youLike, value: list(foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label), t.unset) },
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

        <div className={`${styles.card} ${styles.danger}`}>
          <div className={styles.cardHead}>
            <Text weight="semibold">{t.dangerTitle}</Text>
          </div>
          <Text size="sm" tone="secondary">
            {t.deleteAllBody}
          </Text>
          <DeleteAccount />
        </div>
      </div>
    </Fragment>
  );
}

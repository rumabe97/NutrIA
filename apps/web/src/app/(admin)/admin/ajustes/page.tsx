import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { AllowanceField } from 'components/AllowanceField';
import { Card } from 'components/Card';
import { FlagSwitch } from 'components/FlagSwitch';
import { PushTestButton } from 'components/PushTestButton';

import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AllowancesView, SettingsView } from 'core/controllers/Settings';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/ajustes');
}

/**
 * Every switch that runs the service, in one place (`0068`): who gets in, what
 * the product offers, and what it sends. Each switch keeps the sentence it had
 * on the old page, which says what is true *now* rather than what it does.
 *
 * The API answers `/admin/settings` with a 404 to anybody but an admin, so a
 * missing answer is the same 404 here — whatever the gate above has done yet.
 */
export default async function AdminSettingsPage() {
  const [dictionary, settings, allowances] = await Promise.all([
    getDictionary(),
    serverApi<SettingsView>('/admin/settings'),
    serverApi<AllowancesView>('/admin/settings/allowances')
  ]);

  if (!settings || !allowances) {
    notFound();
  }

  const t = dictionary.admin;
  const words = dictionary.adminSettings;
  const limits = dictionary.adminAllowances;
  const { flags } = settings;
  // The five, in the order the console reads them rather than the registry's:
  // what people use most first, then the two that cannot be raised from here —
  // the structural one and the one that spends money — last, where their
  // warnings are the last things read before either is moved.
  const rows = [
    { cost: limits.costSwaps, label: limits.labelSwaps, name: 'mealSwapsPerPlan', why: limits.whySwaps },
    { cost: limits.costEvents, label: limits.labelEvents, name: 'eventsPerPlan', why: limits.whyEvents },
    { cost: limits.costMidPlan, label: limits.labelMidPlan, name: 'midPlanEventsPerPlan', why: limits.whyMidPlan },
    { cost: limits.costFixedMeals, label: limits.labelFixedMeals, name: 'fixedMeals', why: limits.whyFixedMeals },
    { cost: limits.costRedos, label: limits.labelRedos, name: 'planRedosPerFortnight', why: limits.whyRedos }
  ] as const;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{words.title}</h1>
        <Text className={styles.intro} tone="secondary">
          {words.intro}
        </Text>
      </header>

      {/* Who gets in: an account on its own, and a dietitian into their practice (`0030`, `0059`). */}
      <section aria-labelledby="ajustes-acceso" className={styles.group}>
        <h2 className={styles.subtitle} id="ajustes-acceso">
          {words.access}
        </h2>
        <Card as="ul" className={styles.rows}>
          <li className={styles.row}>
            <FlagSwitch
              enabled={flags.automaticActivation ?? true}
              flag="automaticActivation"
              label={t.automaticActivation}
              offHint={t.manualHint}
              onHint={t.automaticHint}
            />
          </li>
          <li className={styles.row}>
            <FlagSwitch
              enabled={flags.professional ?? false}
              flag="professional"
              label={t.professionalLabel}
              offHint={t.professionalOffHint}
              onHint={t.professionalHint}
            />
          </li>
        </Card>
      </section>

      {/* What the product offers: the paid tier at all, and dish pictures drawn on first view (`0066`). */}
      <section aria-labelledby="ajustes-producto" className={styles.group}>
        <h2 className={styles.subtitle} id="ajustes-producto">
          {words.product}
        </h2>
        <Card as="ul" className={styles.rows}>
          <li className={styles.row}>
            <FlagSwitch enabled={flags.premium ?? false} flag="premium" label={t.premiumLabel} offHint={t.premiumOffHint} onHint={t.premiumHint} />
          </li>
          <li className={styles.row} id="imagenes">
            <FlagSwitch
              enabled={flags.dishPictures ?? false}
              flag="dishPictures"
              label={t.picturesLabel}
              offHint={t.picturesOffHint}
              onHint={t.picturesHint}
            />
          </li>
          <li className={styles.row} id="acompanamientos">
            <FlagSwitch
              enabled={flags.accompaniments ?? false}
              flag="accompaniments"
              label={t.accompanimentsLabel}
              offHint={t.accompanimentsOffHint}
              onHint={t.accompanimentsHint}
            />
          </li>
        </Card>
      </section>

      {/*
        What each subscription allows (`0097`). The numbers live in the code as
        the default and the fallback; these fields move them, inside bounds the
        console is not told but shown — each with the reason it is the bound,
        because a ceiling with no reason beside it is how ten events were
        written for a fortnight that admits seven.
      */}
      <section aria-labelledby="ajustes-limites" className={styles.group}>
        <h2 className={styles.subtitle} id="ajustes-limites">
          {limits.title}
        </h2>
        <Text className={styles.intro} tone="secondary">
          {limits.intro}
        </Text>
        <Card as="ul" className={styles.rows}>
          {rows.map(row => (
            <li className={styles.row} key={row.name}>
              <Text size="sm">{row.label}</Text>
              <Text size="xs" tone="tertiary">
                {row.cost}
              </Text>
              <Text size="xs" tone="tertiary">
                {row.why}
              </Text>
              {row.name === 'planRedosPerFortnight' ? (
                <Text size="xs" tone="tertiary">
                  {limits.spend} <Link href="/admin/catalogo/imagenes">{limits.spendLink}</Link>
                </Text>
              ) : null}
              <div className={styles.tiers}>
                {(['free', 'premium'] as const).map(tier => (
                  <AllowanceField
                    ceiling={allowances.bounds[row.name].ceiling}
                    floor={allowances.bounds[row.name].floor}
                    key={tier}
                    label={tier === 'free' ? limits.free : limits.premium}
                    name={row.name}
                    shipped={allowances.shipped[tier][row.name]}
                    tier={tier}
                    value={allowances.effective[tier][row.name]}
                  />
                ))}
              </div>
            </li>
          ))}
        </Card>
      </section>

      {/* What it sends: the check-in reminder (`0054`), and a test to the owner's own devices. */}
      <section aria-labelledby="ajustes-avisos" className={styles.group}>
        <h2 className={styles.subtitle} id="ajustes-avisos">
          {words.notifications}
        </h2>
        <Card as="ul" className={styles.rows}>
          <li className={styles.row}>
            <FlagSwitch
              enabled={flags.checkInReminders ?? false}
              flag="checkInReminders"
              label={t.remindersTitle}
              offHint={t.remindersOffHint}
              onHint={t.remindersHint}
            />
          </li>
          <li className={styles.row}>
            <PushTestButton />
          </li>
        </Card>
      </section>
    </div>
  );
}

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { FlagSwitch } from 'components/FlagSwitch';
import { PushTestButton } from 'components/PushTestButton';

import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { Metadata } from 'next';
import type { SettingsView } from 'core/controllers/Settings';

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
  const [dictionary, settings] = await Promise.all([getDictionary(), serverApi<SettingsView>('/admin/settings')]);

  if (!settings) {
    notFound();
  }

  const t = dictionary.admin;
  const words = dictionary.adminSettings;
  const { flags } = settings;

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

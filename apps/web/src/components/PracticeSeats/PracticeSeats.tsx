import styles from './PracticeSeats.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';

import { formatNumber, interpolate } from 'lib/format';

interface PracticeSeatsProps {
  activeClients: number;
  pendingInvitations: number;
  /** The limit the API enforces (`CarePracticeView.seats`), never a number written here. */
  seats: number;
}

/**
 * A free practice's places (sheet «Clientes»; `docs/legal/textos/01` § P4,
 * `practice.seats`): how many are taken out of the limit the API resolves, and
 * the unanswered invitations that hold one too. The bar is only the picture of
 * the sentence beside it, so it is hidden from assistive technology.
 *
 * Nothing about plans, trials or terms: no plan can be bought from a free
 * practice (legal § 7). A paid practice keeps `PracticePlanCard`.
 */
export async function PracticeSeats({ activeClients, pendingInvitations, seats }: PracticeSeatsProps) {
  const [dictionary, locale] = await Promise.all([getDictionary(), activeLocale()]);
  const t = dictionary.practice;
  // The bar is the sentence's picture: the active clients out of the limit, as the words say.
  const share = seats > 0 ? Math.min(activeClients / seats, 1) : 0;

  return (
    <Card aria-labelledby="seats-title" as="section" className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title} id="seats-title">
          {t.seatsTitle}
        </h2>
        <Text className={styles.count} weight="semibold">
          {interpolate(t.seats, { active: formatNumber(activeClients, locale), limit: formatNumber(seats, locale) })}
        </Text>
      </div>

      <div aria-hidden="true" className={styles.track}>
        <div className={`${styles.grow} motion-grow-x`}>
          <div className={styles.bar} style={{ transform: `scaleX(${String(share)})` }} />
        </div>
      </div>

      {pendingInvitations > 0 ? (
        <Text size="sm" tone="secondary">
          {interpolate(t.seatsPending, { count: formatNumber(pendingInvitations, locale) })}
        </Text>
      ) : null}
    </Card>
  );
}

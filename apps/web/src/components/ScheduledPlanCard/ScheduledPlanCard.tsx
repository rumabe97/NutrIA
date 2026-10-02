import styles from './ScheduledPlanCard.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';

import { formatDate, interpolate } from 'lib/format';

interface ScheduledPlanCardProps {
  /** `YYYY-MM-DD`: the plan's first day. */
  startDate: string;
  /** Nothing is under way: the card is all there is to show, so it says so. */
  waiting?: boolean;
}

/**
 * "Your next plan starts on…" — a plan that exists and has not begun (project
 * 015), with the two things worth doing before it does: read its days and get
 * its shopping done.
 */
export async function ScheduledPlanCard({ startDate, waiting = false }: ScheduledPlanCardProps) {
  const [dictionary, locale] = await Promise.all([getDictionary(), activeLocale()]);
  const t = dictionary.dashboard;

  return (
    <Card as="section" padding={waiting ? 'lg' : undefined}>
      <h2 className={styles.title}>{interpolate(t.nextPlanTitle, { date: formatDate(startDate, locale, { day: 'numeric', month: 'long' }) })}</h2>
      <Text tone="secondary">{waiting ? t.nextPlanWaitingBody : t.nextPlanBody}</Text>
      <div className={styles.actions}>
        <CtaLink href="/plan/proximo" variant={waiting ? 'primary' : 'secondary'}>
          {t.nextPlanDays}
        </CtaLink>
        <CtaLink href="/compra/proxima" variant="secondary">
          {t.nextPlanShopping}
        </CtaLink>
      </div>
    </Card>
  );
}

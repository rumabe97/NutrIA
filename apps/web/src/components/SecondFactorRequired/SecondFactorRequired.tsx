import styles from './SecondFactorRequired.module.css';

import { getDictionary } from 'i18n/server';
import { Heading } from 'ui/components/Heading';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';

interface SecondFactorRequiredProps {
  /** Which door is shut: the professional's workspace or the owner's console. */
  where: 'console' | 'practice';
}

/**
 * What a privileged account with a password and no second factor sees in
 * place of the workspace or the console (PLAN 011 phase 6): why, and the way
 * to "Seguridad" in `/perfil`, where the authenticator app is turned on. The
 * API refuses the same account on every client and console route with a 404;
 * this is the screen for it.
 *
 * It never says every sign-in will ask for the code: a passkey sign-in on an
 * account with TOTP on does not (`0083`).
 */
export async function SecondFactorRequired({ where }: SecondFactorRequiredProps) {
  const t = (await getDictionary()).secondFactorRequired;

  return (
    <Card as="section" className={styles.card} padding="lg">
      <Heading level="1" size="lg">
        {t.title}
      </Heading>

      {t[where].map(paragraph => (
        <Text className={styles.paragraph} key={paragraph} tone="secondary">
          {paragraph}
        </Text>
      ))}

      <div className={styles.actions}>
        <CtaLink href="/perfil#seguridad">{t.action}</CtaLink>
      </div>
    </Card>
  );
}

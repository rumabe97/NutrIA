import styles from './page.module.css';

import { dictionaryFor, getDictionary } from 'i18n/server';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { withLocale } from 'i18n/routes';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { NoticeCampaign } from 'components/NoticeCampaign';

import { absoluteUrl } from '../../../../_shared/pages';
import { consoleMetadata } from '../../consoleMetadata';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/ajustes/aviso');
}

/** Each language's two pages as the mail links them: whole addresses, the policy at its professional's section. */
function linksFor(locale: 'en-GB' | 'es-ES') {
  return { privacyUrl: absoluteUrl(withLocale('/privacidad#tu-profesional', locale)), termsUrl: absoluteUrl(withLocale('/condiciones', locale)) };
}

/**
 * Ajustes › Aviso del cambio (project 025 phase 10; `docs/legal/textos/06` § Z): the one mail
 * that tells every account the privacy policy and the terms change, sent from here by the owner
 * before he throws the `professional` switch beside it in Interruptores. The console's gate
 * (`layout.tsx`) answers anybody else with a 404, and so does the API.
 *
 * The page hands the flow the mail's approved words in both languages — each account reads
 * its own — and the addresses the mail fills in; everything that changes (whether a campaign
 * has started, the counts, the recipients, each press) is the flow's, read from the API.
 */
export default async function AdminNoticePage() {
  const dictionary = await getDictionary();
  const t = dictionary.adminNotice;

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />
      <NoticeCampaign
        email={LEGAL_IDENTITY.email}
        links={{ 'en-GB': linksFor('en-GB'), 'es-ES': linksFor('es-ES') }}
        mail={{ 'en-GB': dictionaryFor('en-GB').adminNotice.mail, 'es-ES': dictionaryFor('es-ES').adminNotice.mail }}
      />
    </div>
  );
}

import styles from './page.module.css';

import { getDictionary } from 'i18n/server';

import { AssistantChat } from 'components/AssistantChat';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { AssistantStanding } from 'lib/assistant';
import type { HealthView } from 'core/controllers/Health';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/asistente');
}

/**
 * A new conversation (project 023 phase 5). The layout has already answered
 * 404 when the switch is off. The professional-supervision notice the profile
 * shows sits above the conversation whenever the profile carries it (PRD 6);
 * the web reads it, the model never does.
 */
export default async function AssistantPage() {
  const [dictionary, standing, health] = await Promise.all([
    getDictionary(),
    serverApi<AssistantStanding>('/assistant/standing'),
    serverApi<HealthView>('/health-data')
  ]);
  const t = dictionary.assistant;

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{t.title}</h1>
      {health?.supervisionRecommended ? (
        <p className={styles.supervision} role="note">
          {dictionary.profile.supervision}
        </p>
      ) : null}
      {standing ? <AssistantChat conversationId={null} standing={standing} turns={[]} /> : null}
    </div>
  );
}

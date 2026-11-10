import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { AssistantChat } from 'components/AssistantChat';
import { Card } from 'components/Card';
import { EmptyState } from 'components/EmptyState';

import { formatDate, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { AssistantConversation, AssistantStanding } from 'lib/assistant';
import type { HealthView } from 'core/controllers/Health';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/asistente');
}

/**
 * The assistant (project 023 phase 5): a new conversation, and the ones before it.
 *
 * `GET /assistant/standing` is 404 while the `assistant` switch is off, and so
 * is this page — the screen does not exist until the owner throws it. The
 * conversations come from the server, so they survive a reload and a second
 * device. The professional-supervision notice the profile shows sits here too
 * whenever the profile carries it (PRD 6); the web reads it, the model never does.
 */
export default async function AssistantPage() {
  const [dictionary, locale, standing, conversations, health] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AssistantStanding>('/assistant/standing'),
    serverApi<readonly AssistantConversation[]>('/assistant/conversations'),
    serverApi<HealthView>('/health-data')
  ]);

  if (!standing) {
    notFound();
  }

  const t = dictionary.assistant;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t.title}</h1>
        <Text tone="secondary">{t.intro}</Text>
      </header>

      {health?.supervisionRecommended ? (
        <p className={styles.supervision} role="note">
          {dictionary.profile.supervision}
        </p>
      ) : null}

      <AssistantChat conversationId={null} standing={standing} turns={[]} />

      {conversations && conversations.length > 0 ? (
        <section aria-labelledby="assistant-conversations" className={styles.history}>
          <h2 className={styles.heading} id="assistant-conversations">
            {t.conversationsTitle}
          </h2>
          <ul className={styles.list}>
            {conversations.map(conversation => (
              <li key={conversation.id}>
                <Card as={Link} className={styles.item} href={`/asistente/${conversation.id}`} padding="sm">
                  <span className={styles.itemTitle}>{conversation.title || t.newConversation}</span>
                  <span className={styles.itemDate}>
                    {interpolate(t.updated, { date: formatDate(conversation.updatedAt.slice(0, 10), locale, { day: 'numeric', month: 'long' }) })}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState body={t.conversationsEmptyBody} inline={true} title={t.conversationsEmptyTitle} />
      )}
    </div>
  );
}

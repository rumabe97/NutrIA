import { notFound } from 'next/navigation';

import styles from '../page.module.css';

import { getDictionary } from 'i18n/server';
import { Note } from 'ui/components/Note';

import { AssistantChat } from 'components/AssistantChat';
import { ConversationDelete } from 'components/ConversationDelete';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { AssistantStanding, AssistantThread } from 'lib/assistant';
import type { HealthView } from 'core/controllers/Health';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/asistente');
}

/**
 * One conversation, carried on (project 023). Somebody else's is the API's 404,
 * and so is this page — the same as one that never existed. Its answers arrive
 * already screened again against today's allergies.
 */
export default async function AssistantThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dictionary, standing, thread, health] = await Promise.all([
    getDictionary(),
    serverApi<AssistantStanding>('/assistant/standing'),
    serverApi<AssistantThread>(`/assistant/conversations/${encodeURIComponent(id)}`),
    serverApi<HealthView>('/health-data')
  ]);

  if (!standing || !thread) {
    notFound();
  }

  const t = dictionary.assistant;

  return (
    <div className={`${styles.page} motion-enter`}>
      <div className={styles.header}>
        <h1 className={styles.title}>{thread.conversation.title || t.title}</h1>
        {/* On a phone the assistant's bar carries this, in sight however far down the page is. */}
        <div className={styles.headerDelete}>
          <ConversationDelete conversationId={thread.conversation.id} />
        </div>
      </div>
      {health?.supervisionRecommended ? (
        // The same notice, in the same words, as the profile's and a new conversation's.
        <Note as="p" role="note" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
          {dictionary.profile.supervision}
        </Note>
      ) : null}
      <AssistantChat conversationId={thread.conversation.id} standing={standing} turns={thread.turns} />
    </div>
  );
}

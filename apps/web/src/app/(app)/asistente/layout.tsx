import { notFound } from 'next/navigation';

import styles from './layout.module.css';

import { AssistantHistory } from 'components/AssistantHistory';

import { serverApi } from 'lib/server-api';

import type { AssistantConversation, AssistantStanding } from 'lib/assistant';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

/**
 * The assistant's frame (project 023): the history beside the conversation,
 * the shape of a chat app. `GET /assistant/standing` is 404 while the switch is
 * off, and so is every page under here — the screen does not exist until the
 * owner throws it. A new conversation's first answer refreshes this layout, so
 * it appears in the list.
 */
export default async function AssistantLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [standing, conversations] = await Promise.all([
    serverApi<AssistantStanding>('/assistant/standing'),
    serverApi<readonly AssistantConversation[]>('/assistant/conversations')
  ]);

  if (!standing) {
    notFound();
  }

  return (
    <div className={styles.shell}>
      <AssistantHistory conversations={conversations ?? []} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}

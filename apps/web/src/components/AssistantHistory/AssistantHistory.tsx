'use client';
import { Fragment, useState } from 'react';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import styles from './AssistantHistory.module.css';

import { buttonClassName } from 'ui/components/Button';
import { Drawer } from 'ui/components/Drawer';
import { useDictionary } from 'i18n/LocaleProvider';

import { ConversationDelete } from 'components/ConversationDelete';

import { ConversationExport } from './ConversationExport';
import { ConversationLinks } from './ConversationLinks';

import type { AssistantConversation } from 'lib/assistant';

/**
 * The assistant's history (project 023): a side column on a wide screen, and
 * on a narrow one a bar with the same list in a sheet and a way to start over —
 * the shape of a chat app, so the conversation can have the screen to itself.
 */
export function AssistantHistory({ conversations }: { readonly conversations: readonly AssistantConversation[] }) {
  const dictionary = useDictionary();
  const t = dictionary.assistant;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // The conversation on screen, for the bar: its name stays in sight however far it is read.
  const current = conversations.find(conversation => pathname.endsWith(`/${conversation.id}`));

  return (
    <Fragment>
      <aside aria-labelledby="assistant-history" className={styles.sidebar}>
        <Link className={buttonClassName({ className: styles.newButton, size: 'sm', variant: 'secondary' })} href="/asistente">
          {t.newConversation}
        </Link>
        <h2 className={styles.heading} id="assistant-history">
          {t.conversationsTitle}
        </h2>
        <ConversationLinks conversations={conversations} />
        {conversations.length > 0 ? <ConversationExport /> : null}
      </aside>

      <div className={styles.bar}>
        <Drawer
          onOpenChange={setOpen}
          open={open}
          title={t.conversationsTitle}
          trigger={
            // With a conversation open the bar is the head of a chat: its controls are icons
            // with their names, so the conversation's own name has the room between them.
            current ? (
              <button
                aria-label={t.conversationsTitle}
                className={`${buttonClassName({ size: 'sm', variant: 'tertiary' })} ${styles.icon}`}
                type="button"
              >
                <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 7h16M4 12h16M4 17h10" />
                </svg>
              </button>
            ) : (
              <button className={buttonClassName({ size: 'sm', variant: 'tertiary' })} type="button">
                {t.conversationsTitle}
              </button>
            )
          }
        >
          <ConversationLinks conversations={conversations} onPick={() => setOpen(false)} />
          {conversations.length > 0 ? <ConversationExport /> : null}
        </Drawer>
        {/* The page's own heading says it in full, and to a screen reader; this is the same
            name kept in sight, on one line. */}
        {current ? (
          <span aria-hidden="true" className={styles.current}>
            {current.title || t.title}
          </span>
        ) : null}
        {/* Deleting the conversation on screen, from wherever it has been read to. Its
            question opens across the bar, under the controls. */}
        {current ? (
          <div className={styles.delete}>
            <ConversationDelete compact={true} conversationId={current.id} />
          </div>
        ) : null}
        <Link
          aria-label={current ? t.newConversation : undefined}
          className={`${buttonClassName({ className: styles.newShort, size: 'sm', variant: 'secondary' })} ${current ? styles.icon : ''}`}
          href="/asistente"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {current ? null : t.newShort}
        </Link>
      </div>
    </Fragment>
  );
}

'use client';
import { Fragment, useState } from 'react';

import Link from 'next/link';

import styles from './AssistantHistory.module.css';

import { buttonClassName } from 'ui/components/Button';
import { Drawer } from 'ui/components/Drawer';
import { useDictionary } from 'i18n/LocaleProvider';

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
      </aside>

      <div className={styles.bar}>
        <Drawer
          onOpenChange={setOpen}
          open={open}
          title={t.conversationsTitle}
          trigger={
            <button className={buttonClassName({ size: 'sm', variant: 'tertiary' })} type="button">
              {t.conversationsTitle}
            </button>
          }
        >
          <ConversationLinks conversations={conversations} onPick={() => setOpen(false)} />
        </Drawer>
        <Link className={buttonClassName({ className: styles.newShort, size: 'sm', variant: 'secondary' })} href="/asistente">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {t.newShort}
        </Link>
      </div>
    </Fragment>
  );
}

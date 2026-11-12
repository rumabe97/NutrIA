'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import styles from './AssistantHistory.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatDate } from 'lib/format';

import type { AssistantConversation } from 'lib/assistant';

/** The conversations, newest first, the open one marked; a link each. */
export function ConversationLinks({
  conversations,
  onPick
}: {
  readonly conversations: readonly AssistantConversation[];
  readonly onPick?: () => void;
}) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const t = dictionary.assistant;

  if (conversations.length === 0) {
    return <p className={styles.empty}>{t.conversationsEmptyBody}</p>;
  }

  return (
    <ul className={`${styles.list} motion-list`}>
      {conversations.map(conversation => {
        const href = `/asistente/${conversation.id}`;

        return (
          <li key={conversation.id}>
            <Link aria-current={pathname === href ? 'page' : undefined} className={styles.item} href={href} onClick={onPick}>
              <span className={styles.itemTitle}>{conversation.title || t.newConversation}</span>
              <span className={styles.itemDate}>{formatDate(conversation.updatedAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

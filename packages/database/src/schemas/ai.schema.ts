import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { aiRole } from './_enums';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

export const aiConversations = userOwned('ai_conversations', { title: text() });

/**
 * Stored for the user's own history. It is deliberately *not* the context sent
 * to the model — assembling a compact, structured context is the assistant
 * service's job (§ AI token efficiency); replaying a whole transcript is not.
 */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    content: text().notNull(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: aiRole().notNull(),
    tokensIn: integer(),
    tokensOut: integer(),
    ...timestamps
  },
  table => [index('ai_messages_conversation_idx').on(table.conversationId)]
);

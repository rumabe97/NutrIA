import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { aiRole } from './_enums';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

export const aiConversations = userOwned('ai_conversations', { title: text() });

/**
 * Why the assistant did not answer, as the code the web app turns into words
 * (`core/domain/Assistant`'s `ASSISTANT_DECLINES`, which a test in `core` holds
 * equal to this list). Here because the check below is written from it, and this
 * package cannot import `core`.
 *
 * **Changing this list changes a constraint on a table with rows in it.**
 * `generate` will emit `DROP CONSTRAINT` + `ADD CONSTRAINT`, which the migration
 * gate refuses without a `-- reviewed-destructive:` line, and which rescans the
 * table under an exclusive lock. Adding a code is safe in one release — the
 * migration runs before the new API serves. Removing one must wait until no API
 * writes it and no stored row holds it, or the new check fails on rows already
 * there. On a populated table, add it `NOT VALID` in one deploy and `VALIDATE` it
 * in the next. A check on text, not a `pgEnum`, for the reason `AGENTS.md` gives
 * about rebuilding an enum (migration review, 2026-11-09).
 */
export const AI_MESSAGE_DECLINES = ['acting', 'allergen', 'clinical', 'invented_figure', 'off_topic'] as const;

/**
 * Stored for the user's own history. It is deliberately *not* the context sent
 * to the model — assembling a compact, structured context is the assistant
 * service's job (§ AI token efficiency); replaying a whole transcript is not.
 *
 * Built in the workspace's first migration and unused until project 023, which
 * takes it as it is (its plan's phase 3, as built — `0104` clause 7 named new
 * tables, and these turned out to exist already) and adds one column: `decline`, the code a
 * cut question's answer or a withheld answer carries **instead of prose**, so
 * a stored thread re-renders in the language it is read in, and a declined turn
 * is never replayed to the model (`historyWindow`).
 *
 * **What a person sent is never counted from here.** They may delete any row,
 * and an allowance read from these rows would be handed back by every deletion;
 * `assistant_usage` is what counts.
 */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    content: text().notNull(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    decline: text(),
    role: aiRole().notNull(),
    tokensIn: integer(),
    tokensOut: integer(),
    ...timestamps
  },
  table => [
    index('ai_messages_conversation_idx').on(table.conversationId),
    // Written from the constant above, which is a fixed list in this file and never input.
    check(
      'ai_messages_decline',
      sql`${table.decline} is null or ${table.decline} in (${sql.raw(AI_MESSAGE_DECLINES.map(code => `'${code}'`).join(', '))})`
    )
  ]
);

/**
 * One row per message a person sent the assistant — **and no text** (project
 * 023, PRD 9 and PRD 3). The fortnight's allowance and the off-topic ceiling
 * are both counted from here.
 *
 * Its own table because neither of the other two can do this job:
 *
 * - **Not `ai_messages`**: a person may delete any message or a whole thread
 *   (PRD 10), and counting from those rows would hand the allowance back for
 *   every deletion — the limit would reward deleting history, and the abuse
 *   ceiling would reset with it.
 * - **Not the `ai_call` events**: they are the month's spend and name nobody,
 *   on purpose, so they cannot count per person (`0104` clause 7).
 *
 * It names the person and holds nothing they wrote, so a deleted message
 * leaves its row and a deleted **account** takes every row with it — the one
 * deletion that should give nothing back is the one that leaves nothing to give.
 */
export const assistantUsage = userOwned(
  'assistant_usage',
  {
    /** The question was cut as off topic — what the off-topic ceiling counts. */
    offTopic: boolean().notNull().default(false)
  },
  table => [index('assistant_usage_user_created_idx').on(table.userId, table.createdAt)]
);

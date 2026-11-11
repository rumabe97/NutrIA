import { and, asc, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { aiConversations, aiMessages, assistantUsage } from 'database/schema/ai';

import { DatabaseOperationError } from 'core/entities/Error';

import type { AssistantConversation, AssistantDecline, AssistantTurn } from 'core/entities/Assistant';
import type { SQL } from 'drizzle-orm';

/** One row of a person's copy of their conversations: a turn with its conversation, or a conversation with no turn (`role` null). */
export type AssistantExportRow = {
  readonly content: string | null;
  readonly conversationCreatedAt: Date;
  readonly conversationId: string;
  readonly conversationUpdatedAt: Date;
  readonly decline: AssistantDecline | null;
  readonly role: 'assistant' | 'user' | null;
  readonly title: string;
  readonly turnCreatedAt: Date | null;
};

/** What the usage ledger counted since a window began: every message sent, and how many were cut as off topic. */
export type AssistantUsage = { readonly messages: number; readonly offTopic: number };

/** The ledger's `WHERE`: this person's rows since the window began. Exported for its spec. */
export function usageWindow(userId: string, since: Date): SQL | undefined {
  return and(eq(assistantUsage.userId, userId), gte(assistantUsage.createdAt, since));
}

/**
 * The assistant's usage ledger (project 023, PRD 9 and PRD 3) — one row per
 * message a person sent, and no text.
 *
 * **The only place the allowance and the off-topic ceiling are counted from.**
 * Not the conversation, which the person may delete (and a count read from it
 * would hand the allowance back for every deletion), and not the `ai_call`
 * events, which are the month's spend and name nobody on purpose.
 */
/** A person's own conversation, by id — the ownership a 404 is made of. Exported for its spec. */
export function ownedConversation(userId: string, conversationId: string): SQL | undefined {
  return and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId));
}

/** The most conversations a list returns: a screen of them, newest first. */
const CONVERSATION_PAGE = 50;

export const AssistantRepository = {
  /**
   * One turn, and the conversation marked as continued. A declined turn carries
   * its code and an empty `content` — the column is `NOT NULL` since the
   * workspace's first migration, and a code is not prose.
   */
  async appendTurn(
    userId: string,
    conversationId: string,
    turn: {
      readonly content: string;
      readonly decline: AssistantDecline | null;
      readonly role: 'assistant' | 'user';
      readonly tokensIn?: number;
      readonly tokensOut?: number;
    }
  ): Promise<string | null> {
    try {
      return await database().transaction(async tx => {
        // The owner first: a conversation that is not this person's takes no turn.
        const [owned] = await tx
          .update(aiConversations)
          .set({ updatedAt: new Date() })
          .where(ownedConversation(userId, conversationId))
          .returning({ id: aiConversations.id });

        if (!owned) {
          return null;
        }

        const [row] = await tx
          .insert(aiMessages)
          .values({
            content: turn.content,
            conversationId,
            decline: turn.decline,
            role: turn.role,
            tokensIn: turn.tokensIn,
            tokensOut: turn.tokensOut
          })
          .returning({ id: aiMessages.id });

        if (!row) {
          throw new DatabaseOperationError();
        }

        return row.id;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One message sent, **claimed before anything is asked of a model**: the count
   * and the row in one transaction under a lock on the person, so a burst of
   * messages sent at once cannot all read the same count and all pass (the
   * `0097` invariant; `MailBudgetRepository` is the precedent). Null when the
   * allowance is spent — nothing is written then.
   *
   * Written for **every** outcome the message reaches — answered, cut, withheld —
   * because the unit is a message a person sent, which they can count themselves
   * (`docs/reference/marketing/assistant-messages.md` § 6).
   */
  async claimUse(userId: string, since: Date, limit: number): Promise<string | null> {
    try {
      return await database().transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`assistant-usage:${userId}`}))`);

        const [used] = await tx.select({ messages: count() }).from(assistantUsage).where(usageWindow(userId, since));

        if ((used?.messages ?? 0) >= limit) {
          return null;
        }

        const [row] = await tx.insert(assistantUsage).values({ offTopic: false, userId }).returning({ id: assistantUsage.id });

        return row?.id ?? null;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A new conversation, titled by the service from the first question — never by
   * the model, whose words would be the one unchecked text on a list screen.
   */
  async createConversation(userId: string, title: string): Promise<string> {
    try {
      const [row] = await database().insert(aiConversations).values({ title, userId }).returning({ id: aiConversations.id });

      if (!row) {
        throw new DatabaseOperationError();
      }

      return row.id;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** A whole conversation, its turns with it (`onDelete: 'cascade'`). False when it was not this person's to delete. */
  async deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      const deleted = await database().delete(aiConversations).where(ownedConversation(userId, conversationId)).returning({ id: aiConversations.id });

      return deleted.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One turn, only from a conversation this person owns. **The ledger row it was
   * counted by stays**: deleting what was said does not give back the message
   * that said it.
   *
   * The conversation's title is the first question's opening words, so deleting
   * that question takes them from the title too, in the same transaction: the
   * title becomes `retitle` applied to the next question left, or empty. Null when
   * the turn was not this person's to delete.
   */
  async deleteTurn(userId: string, turnId: string, retitle: (question: string) => string): Promise<boolean> {
    try {
      return await database().transaction(async tx => {
        const [turn] = await tx
          .select({ conversationId: aiMessages.conversationId, role: aiMessages.role })
          .from(aiMessages)
          .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
          .where(and(eq(aiMessages.id, turnId), eq(aiConversations.userId, userId)));

        if (!turn) {
          return false;
        }

        const [first] = await tx
          .select({ id: aiMessages.id })
          .from(aiMessages)
          .where(and(eq(aiMessages.conversationId, turn.conversationId), eq(aiMessages.role, 'user')))
          .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
          .limit(1);

        await tx.delete(aiMessages).where(eq(aiMessages.id, turnId));

        if (turn.role === 'user' && first?.id === turnId) {
          const [next] = await tx
            .select({ content: aiMessages.content })
            .from(aiMessages)
            .where(and(eq(aiMessages.conversationId, turn.conversationId), eq(aiMessages.role, 'user')))
            .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
            .limit(1);

          await tx
            .update(aiConversations)
            .set({ title: next ? retitle(next.content) : '' })
            .where(ownedConversation(userId, turn.conversationId));
        }

        return true;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every conversation of this person's with every turn, for the copy they
   * download (art. 20): one row per turn, or one with no turn for a
   * conversation left empty. Oldest conversation first, turns in order. No
   * page limit — the list screen's fifty are not all of them.
   */
  async everything(userId: string): Promise<readonly AssistantExportRow[]> {
    try {
      const rows = await database()
        .select({
          content: aiMessages.content,
          conversationCreatedAt: aiConversations.createdAt,
          conversationId: aiConversations.id,
          conversationUpdatedAt: aiConversations.updatedAt,
          decline: aiMessages.decline,
          role: aiMessages.role,
          title: aiConversations.title,
          turnCreatedAt: aiMessages.createdAt
        })
        .from(aiConversations)
        .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
        .where(eq(aiConversations.userId, userId))
        .orderBy(asc(aiConversations.createdAt), asc(aiConversations.id), asc(aiMessages.createdAt), asc(aiMessages.id));

      return rows.map(row => ({ ...row, decline: row.decline as AssistantDecline | null, title: row.title ?? '' }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One of this person's conversations, or null — somebody else's id reads exactly like one that does not exist. */
  async findConversation(userId: string, conversationId: string): Promise<AssistantConversation | null> {
    try {
      const [row] = await database()
        .select({ id: aiConversations.id, createdAt: aiConversations.createdAt, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
        .from(aiConversations)
        .where(ownedConversation(userId, conversationId));

      return row ? { ...row, title: row.title ?? '' } : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Every ledger row older than `before`, which no window can read any more (the `legal` agent's F3). Returns how many went. */
  async forgetOldUsage(before: Date): Promise<number> {
    try {
      const deleted = await database().delete(assistantUsage).where(lt(assistantUsage.createdAt, before)).returning({ id: assistantUsage.id });

      return deleted.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every conversation nobody has continued since `before`, its turns with it
   * (`onDelete: 'cascade'`) — the six-month retention the owner chose on
   * 2026-11-10 (`docs/decisions/LOG.md`). `updatedAt` is the last turn's time:
   * `appendTurn` sets it. Returns how many went.
   */
  async forgetQuietConversations(before: Date): Promise<number> {
    try {
      const deleted = await database().delete(aiConversations).where(lt(aiConversations.updatedAt, before)).returning({ id: aiConversations.id });

      return deleted.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** This person's conversations, the most recently continued first. */
  async listConversations(userId: string): Promise<readonly AssistantConversation[]> {
    try {
      const rows = await database()
        .select({ id: aiConversations.id, createdAt: aiConversations.createdAt, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
        .from(aiConversations)
        .where(eq(aiConversations.userId, userId))
        .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
        .limit(CONVERSATION_PAGE);

      return rows.map(row => ({ ...row, title: row.title ?? '' }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** A claimed message the label found off topic: it counts against the off-topic ceiling too. */
  async markOffTopic(userId: string, usageId: string): Promise<void> {
    try {
      await database()
        .update(assistantUsage)
        .set({ offTopic: true })
        .where(and(eq(assistantUsage.id, usageId), eq(assistantUsage.userId, userId)));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A claim given back, for a message that was never answered **through no
   * doing of the person's** — a conversation that was not theirs, a provider
   * that could not label it. Never for a message they deleted.
   */
  async releaseUse(userId: string, usageId: string): Promise<void> {
    try {
      await database()
        .delete(assistantUsage)
        .where(and(eq(assistantUsage.id, usageId), eq(assistantUsage.userId, userId)));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A conversation's turns, oldest first — of this person's conversation only;
   * anybody else's reads as none.
   */
  async turns(userId: string, conversationId: string): Promise<readonly AssistantTurn[]> {
    try {
      const rows = await database()
        .select({
          id: aiMessages.id,
          content: aiMessages.content,
          createdAt: aiMessages.createdAt,
          decline: aiMessages.decline,
          role: aiMessages.role
        })
        .from(aiMessages)
        .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
        .where(ownedConversation(userId, conversationId))
        .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id));

      return rows.map(row => ({ ...row, decline: row.decline as AssistantDecline | null }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** How many messages since `since`, and how many of them were cut as off topic — one query, one row. */
  async usageSince(userId: string, since: Date): Promise<AssistantUsage> {
    try {
      const [row] = await database()
        .select({ messages: count(), offTopic: sql<number>`count(*) filter (where ${assistantUsage.offTopic})`.mapWith(Number) })
        .from(assistantUsage)
        .where(usageWindow(userId, since));

      return { messages: row?.messages ?? 0, offTopic: row?.offTopic ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on assistant_usage: ${error.message}`);
  }

  return new DatabaseOperationError();
}

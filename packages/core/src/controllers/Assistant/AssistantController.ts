import { assistantStanding, assistantWindow } from 'core/domain/Allowance';
import { AssistantRepository } from '#repositories/Assistant';
import { madridMidnight } from 'core/domain/Period';
import { NotFoundError, QuotaExceededError } from 'core/entities/Error';
import { PlanController } from 'core/controllers/Plan';
import { PlanRepository } from '#repositories/Plan';
import { personToday } from 'core/controllers/Profile';

import type { AssistantConversation, AssistantDecline, AssistantTurn } from 'core/entities/Assistant';
import type { AssistantStanding } from 'core/domain/Allowance';

/** The longest title a conversation is given: the start of its first question, cut on a word. */
const TITLE_LENGTH = 60;

/**
 * A conversation's title, from the first question — by this service, never by a
 * model: a model's words would be the one unchecked text on a list screen.
 */
export function conversationTitle(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim();

  if (flat.length <= TITLE_LENGTH) {
    return flat;
  }

  const cut = flat.slice(0, TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** A conversation nobody has continued for this long is deleted (owner, 2026-11-10). */
export const ASSISTANT_CONVERSATION_RETENTION_MONTHS = 6;

/**
 * Ledger rows older than this are deleted. Well past any window the allowance
 * reads — one plan's fortnight, or the last fourteen days — so no count changes
 * (the `legal` agent's F3, `docs/legal/assistant-warning.md` § 3.1).
 */
export const ASSISTANT_USAGE_RETENTION_DAYS = 60;

/** What one run of the assistant's retention deleted. */
export type AssistantRetentionRun = { readonly assistantConversations: number; readonly assistantUsageRows: number };

/**
 * The assistant's bookkeeping (project 023): where a person stands in their
 * fortnight, and their conversations. **No model is called from here** — the
 * calls, the label and the stream are the API's, behind the AI module's wall;
 * this is what they read and write around them.
 *
 * Everything a person may reach is reached through their own id: somebody
 * else's conversation or turn is a `NotFoundError`, which the API answers as
 * 404 — the same answer as one that never existed.
 */
export const AssistantController = {
  /** A turn, into this person's own conversation, or a 404. */
  async append(
    userId: string,
    conversationId: string,
    turn: {
      readonly content: string;
      readonly decline: AssistantDecline | null;
      readonly role: 'assistant' | 'user';
      readonly tokensIn?: number;
      readonly tokensOut?: number;
    }
  ): Promise<string> {
    const id = await AssistantRepository.appendTurn(userId, conversationId, turn);

    if (id === null) {
      throw new NotFoundError();
    }

    return id;
  },

  /**
   * One message, claimed against the fortnight's allowance in the same
   * transaction that counts it — or a 429 when a message sent at the same moment
   * took the last one. Returns the claim, for `markOffTopic` or `release`.
   */
  async claim(userId: string, standing: AssistantStanding): Promise<string> {
    const id = await AssistantRepository.claimUse(userId, madridMidnight(standing.window.since), standing.limit);

    if (id === null) {
      throw new QuotaExceededError('assistant_message', standing.window.resetsOn);
    }

    return id;
  },

  async conversations(userId: string): Promise<readonly AssistantConversation[]> {
    return AssistantRepository.listConversations(userId);
  },

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    if (!(await AssistantRepository.deleteConversation(userId, conversationId))) {
      throw new NotFoundError();
    }
  },

  /**
   * One turn. The ledger row it was counted by stays: deleting what was said
   * gives back nothing. Deleting the first question takes its words from the
   * title too — the title becomes the next question's, or nothing.
   */
  async deleteTurn(userId: string, turnId: string): Promise<void> {
    if (!(await AssistantRepository.deleteTurn(userId, turnId, conversationTitle))) {
      throw new NotFoundError();
    }
  },

  /**
   * The assistant's retention, run by the daily sweep: conversations quiet for
   * six months, and ledger rows past any window. Nobody's in particular — by
   * date alone.
   */
  async forget(now: Date = new Date()): Promise<AssistantRetentionRun> {
    const quietSince = new Date(now);

    quietSince.setUTCMonth(quietSince.getUTCMonth() - ASSISTANT_CONVERSATION_RETENTION_MONTHS);

    const usageBefore = new Date(now.getTime() - ASSISTANT_USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    return {
      assistantConversations: await AssistantRepository.forgetQuietConversations(quietSince),
      assistantUsageRows: await AssistantRepository.forgetOldUsage(usageBefore)
    };
  },

  /** A claimed message the label found off topic. */
  async markOffTopic(userId: string, claim: string): Promise<void> {
    await AssistantRepository.markOffTopic(userId, claim);
  },

  /** The conversation a message continues — this person's own, or a 404 — or a new one titled from the message. */
  async open(userId: string, conversationId: string | undefined, question: string): Promise<string> {
    if (conversationId === undefined) {
      return AssistantRepository.createConversation(userId, conversationTitle(question));
    }

    const conversation = await AssistantRepository.findConversation(userId, conversationId);

    if (!conversation) {
      throw new NotFoundError();
    }

    return conversation.id;
  },

  /** A claim given back: the message was never answered, through no doing of the person's. */
  async release(userId: string, claim: string): Promise<void> {
    await AssistantRepository.releaseUse(userId, claim);
  },

  /**
   * The fortnight's count, its window and whether a question may still be
   * labelled. The window starts at Madrid's midnight of its first day, the
   * product's default zone: for somebody elsewhere in Spain the edge of a
   * fourteen-day window moves by an hour, which no allowance can feel.
   */
  async standing(userId: string, now: Date = new Date()): Promise<AssistantStanding> {
    const [today, active, limits] = await Promise.all([personToday(userId, now), PlanRepository.findActive(userId), PlanController.limitsOf(userId)]);
    const window = assistantWindow(active ? { endDate: active.endDate, startDate: active.startDate } : undefined, today);
    const usage = await AssistantRepository.usageSince(userId, madridMidnight(window.since));

    return assistantStanding(usage, window, limits);
  },

  /** One of this person's conversations with its turns, oldest first. */
  async thread(
    userId: string,
    conversationId: string
  ): Promise<{ readonly conversation: AssistantConversation; readonly turns: readonly AssistantTurn[] }> {
    const conversation = await AssistantRepository.findConversation(userId, conversationId);

    if (!conversation) {
      throw new NotFoundError();
    }

    return { conversation, turns: await AssistantRepository.turns(userId, conversation.id) };
  }
};

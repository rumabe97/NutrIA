import { decideMail } from 'core/domain/MailBudget';
import { MailBudgetRepository } from '#repositories/MailBudget';

/**
 * The per-address budget of mails anybody can make the product send (PLAN 011
 * phase 8). The API turns an address into its key (`mailBudgetKey`) and asks
 * here before sending; the rule itself is `core/domain/MailBudget`.
 */
export const MailBudgetController = {
  /** One more mail for the key: true when it may go (and it is counted), false when the hour's budget is spent. */
  async spend(key: string, now: Date = new Date()): Promise<boolean> {
    const decision = await MailBudgetRepository.spend(key, now, sent => decideMail(sent, now));

    return decision.kind === 'send';
  }
};

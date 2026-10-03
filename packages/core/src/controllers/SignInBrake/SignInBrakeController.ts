import { decideAttempt, SIGN_IN_BRAKE } from 'core/domain/SignInBrake';
import { SignInBrakeRepository } from '#repositories/SignInBrake';

import type { BrakeDecision } from 'core/domain/SignInBrake';

/**
 * The per-address brake on password sign-in (PLAN 011 phase 7). The API turns
 * an address into its key (`signInBrakeKey`) and asks here before Better Auth
 * checks the password; the rule itself is `core/domain/SignInBrake`.
 */
export const SignInBrakeController = {
  /** One more attempt for the key: counted and allowed, or braked with the seconds left. */
  async attempt(key: string, now: Date = new Date()): Promise<BrakeDecision> {
    return SignInBrakeRepository.attempt(key, now, attempts => decideAttempt(attempts, now));
  },

  /** The daily sweep: every row a day quiet, and how many went. */
  async forgetQuiet(now: Date = new Date()): Promise<number> {
    return SignInBrakeRepository.forgetQuiet(new Date(now.getTime() - SIGN_IN_BRAKE.forgottenAfterMs));
  },

  /** The right password: the key starts from nothing. */
  async signedIn(key: string): Promise<void> {
    await SignInBrakeRepository.clear(key);
  }
};

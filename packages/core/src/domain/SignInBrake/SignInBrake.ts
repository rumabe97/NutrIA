import { createHmac } from 'node:crypto';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

/**
 * The per-address brake on password sign-in (PLAN 011 phase 7, PRD 011
 * criterion 12). Better Auth's limiter counts per IP; this counts per address,
 * so many IPs guessing one account's password slow down together.
 *
 * Every attempt in a window counts — a correct password then deletes the row,
 * so what is left counted is the failures. The tenth attempt in fifteen
 * minutes still runs, and leaves the next one waiting thirty seconds; each
 * attempt after a wait doubles it, up to fifteen minutes. Never a hard lock:
 * the owner of the address gets in with the right password once the wait is
 * over, however long somebody else has been guessing.
 */
export const SIGN_IN_BRAKE = {
  firstWaitMs: 30 * SECOND,
  /** A row a day quiet is the daily sweep's to delete; by then it brakes nothing. */
  forgottenAfterMs: DAY,
  maxWaitMs: 15 * MINUTE,
  /** The attempt in one window that starts the waits. */
  threshold: 10,
  /** Fifteen quiet minutes — after the window began, or after the last wait ended — and the count starts again. */
  windowMs: 15 * MINUTE
} as const;

/** What the brake holds for one address — the row, without its key. */
export type SignInAttempts = {
  readonly count: number;
  /** Null until the attempts reach the threshold. */
  readonly nextAllowedAt: Date | null;
  readonly windowStartedAt: Date;
};

export type BrakeDecision =
  { readonly kind: 'allowed'; readonly next: SignInAttempts } | { readonly kind: 'braked'; readonly retryAfterSeconds: number };

/**
 * The key an address is counted under: an HMAC of the lower-cased address,
 * the way Better Auth looks the account up, with the auth secret. Never the
 * address, and the same for an address with an account and one without. The
 * label keeps this HMAC apart from anything else Better Auth signs with the
 * same secret.
 */
export function signInBrakeKey(email: string, secret: string): string {
  return createHmac('sha256', secret).update(`sign-in-brake:${email.toLowerCase()}`).digest('hex');
}

/** How long the attempt numbered `count` in its window leaves the next one waiting: none below the threshold. */
export function waitAfter(count: number): number {
  if (count < SIGN_IN_BRAKE.threshold) {
    return 0;
  }

  return Math.min(SIGN_IN_BRAKE.firstWaitMs * 2 ** (count - SIGN_IN_BRAKE.threshold), SIGN_IN_BRAKE.maxWaitMs);
}

/** The later of the window's start and the end of its last wait: what "quiet since" is measured from. */
function lastActive(attempts: SignInAttempts): number {
  return Math.max(attempts.windowStartedAt.getTime(), attempts.nextAllowedAt?.getTime() ?? 0);
}

/**
 * One more attempt for an address: braked while its wait runs, otherwise
 * counted. A window fifteen minutes quiet starts again at one; while the waits
 * keep being used up, it does not, so a patient guesser stays at the longest
 * wait rather than earning nine free tries back.
 */
export function decideAttempt(attempts: SignInAttempts | undefined, now: Date): BrakeDecision {
  if (attempts?.nextAllowedAt && attempts.nextAllowedAt > now) {
    return { kind: 'braked', retryAfterSeconds: Math.max(1, Math.ceil((attempts.nextAllowedAt.getTime() - now.getTime()) / SECOND)) };
  }

  const fresh = !attempts || now.getTime() - lastActive(attempts) >= SIGN_IN_BRAKE.windowMs;
  const count = fresh ? 1 : attempts.count + 1;
  const wait = waitAfter(count);

  return {
    kind: 'allowed',
    next: { count, nextAllowedAt: wait > 0 ? new Date(now.getTime() + wait) : null, windowStartedAt: fresh ? now : attempts.windowStartedAt }
  };
}

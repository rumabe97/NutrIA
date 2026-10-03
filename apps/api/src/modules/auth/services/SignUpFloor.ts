import type { Context } from './PasswordPolicy.js';

const SIGN_UP = '/sign-up/email';

/**
 * How long `/sign-up/email` takes at the least, counted from the moment the
 * password checks are done (PLAN 011 phase 8, amended). Better Auth keeps 500
 * ms on `/send-verification-email` for the same reason; this one is 800 with
 * margin, because what it hides was measured only here (~95 ms for the new
 * address, local Postgres) and not on Neon, where the new branch's few extra
 * round trips may stretch its tail: a floor below the slow branch's p99 leaks
 * in the tail. Raise it if production timing ever shows a sign-up near it.
 */
export const SIGN_UP_FLOOR_MS = 800;

export type SignUpFloor = {
  /** `hooks.after`: waits out what is left of the floor, whatever the answer. */
  readonly hold: (context: Context) => Promise<void>;
  /** `hooks.before`, once the password checks have passed: the clock starts for this request. */
  readonly start: (context: Context) => void;
};

/**
 * A time floor on `/sign-up/email` (PLAN 011 phase 8, amended). A new address
 * is the slower branch — the row, the credential and `onAccountCreated`, inline,
 * a few round trips more than an address that already has an account, whose
 * mail goes after the response — so its time said which it was. Both now
 * answer no earlier than the floor.
 *
 * The clock starts after the password checks, not at the request: HIBP can take
 * up to two seconds, the same for any address, and counting it would let a slow
 * HIBP push the new-address branch past the floor. What the floor covers is the
 * part that depends on the address. A refused password never reaches the clock
 * and is not held: its answer is the same for every address.
 *
 * Over HTTP only, keyed on the request: a call through `auth.api` has none, and
 * no stranger can make one.
 */
export function signUpFloor(
  floorMs: number = SIGN_UP_FLOOR_MS,
  now: () => number = () => performance.now(),
  wait: (ms: number) => Promise<void> = async ms =>
    new Promise(resolve => {
      setTimeout(resolve, ms);
    })
): SignUpFloor {
  const started = new WeakMap<Request, number>();

  return {
    async hold(context) {
      const startedAt = context.path === SIGN_UP && context.request ? started.get(context.request) : undefined;

      if (startedAt === undefined || !context.request) {
        return;
      }

      started.delete(context.request);

      const remaining = floorMs - (now() - startedAt);

      if (remaining > 0) {
        await wait(remaining);
      }
    },
    start(context) {
      if (context.path === SIGN_UP && context.request) {
        started.set(context.request, now());
      }
    }
  };
}

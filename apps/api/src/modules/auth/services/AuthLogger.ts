import { format } from 'node:util';

import { Logger } from '@nestjs/common';

import type { BetterAuthOptions } from 'better-auth';

const logger = new Logger('BetterAuth');

/** A WebAuthn challenge in a line: the error `@simplewebauthn/server` throws quotes it, and the expected one beside it. */
const CHALLENGE = /challenge/i;
const QUOTED = /"[^"]*"/g;

/**
 * A line with no WebAuthn challenge in it (PLAN 011 phase 5, the 2026-10-03
 * review): the passkey plugin logs the error of a verify that failed, and
 * `@simplewebauthn/server`'s says `Unexpected … challenge "<sent>", expected
 * "<ours>"`. A challenge is live for five minutes and is what a signature is
 * made over, so a line that mentions one has every quoted value in it
 * replaced — the challenge, the expected one, and whatever else sits beside
 * them. Everything else is left as it was.
 */
export function withoutChallenges(line: string): string {
  return line
    .split('\n')
    .map(part => (CHALLENGE.test(part) ? part.replace(QUOTED, '"[redacted]"') : part))
    .join('\n');
}

/**
 * Better Auth's `logger`: its lines through Nest's logger, at Better Auth's
 * own threshold (`warn`), each scrubbed by `withoutChallenges` after its
 * arguments are formatted — an `Error` is formatted with its stack, which
 * repeats its message.
 */
export function authLogger(): NonNullable<BetterAuthOptions['logger']> {
  return {
    log: (level, message, ...args: unknown[]) => {
      const line = withoutChallenges(format(message, ...args));

      if (level === 'error') {
        logger.error(line);
      } else if (level === 'warn') {
        logger.warn(line);
      } else if (level === 'debug') {
        logger.debug(line);
      } else {
        logger.log(line);
      }
    }
  };
}

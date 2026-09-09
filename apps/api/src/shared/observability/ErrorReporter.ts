import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import { ENV } from '../../config/index.js';
import { redactSecrets } from '../../modules/ai/clients/redact.js';

import type { Env } from '../../config/index.js';

/**
 * Where a failure goes when nobody is watching the log.
 *
 * Until now every fault reached the owner as a screenshot from whoever hit it,
 * which means the ones nobody reported were never known at all. This reports
 * them to Sentry — off entirely without `SENTRY_DSN`, like every other optional
 * integration here, so a fresh clone and the local machine send nothing.
 *
 * **What is deliberately not sent.** This is a health product: a plan is what
 * someone eats, a prompt carries their conditions and their body, and an email
 * is an identifier. So the report is the error and its stack, the route, the
 * release and nothing else — no request body, no query, no headers, no cookies,
 * no user, and messages pass through the same secret redaction the AI logs use.
 * A crash report that carries a medication would be a worse leak than the crash.
 */
@Injectable()
export class ErrorReporter {
  private readonly logger = new Logger(ErrorReporter.name);
  private readonly enabled: boolean;

  constructor(@Inject(ENV) env: Env) {
    this.enabled = Boolean(env.SENTRY_DSN);

    if (!this.enabled) {return;}

    Sentry.init({
      beforeSend(event) {
        // Whatever the SDK collected on its own, it does not leave here.
        delete event.request;
        delete event.user;
        delete event.contexts?.response;

        if (event.message) {event.message = redactSecrets(event.message);}

        for (const value of event.exception?.values ?? []) {
          if (value.value) {value.value = redactSecrets(value.value);}
        }

        return event;
      },
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      // The commit is the release, so a spike can be read against a deploy.
      release: env.VERCEL_GIT_COMMIT_SHA,
      sendDefaultPii: false,
      // Errors only. Traces would carry route timings for every request and buy
      // nothing a log line does not already give.
      tracesSampleRate: 0
    });
    this.logger.log(`Error reporting on (${env.NODE_ENV})`);
  }

  /**
   * Reports one failure. `where` is a stable label — a route, a job — so the
   * same fault groups across releases; never a value from a request.
   */
  report(error: unknown, where: string): void {
    if (!this.enabled) {return;}

    Sentry.withScope(scope => {
      scope.setTag('where', where);
      Sentry.captureException(error instanceof Error ? error : new Error(redactSecrets(String(error))));
    });
  }
}

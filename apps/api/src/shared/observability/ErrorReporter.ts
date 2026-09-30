import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import { ENV } from '../../config/index.js';
import { redactSecrets } from '../../modules/ai/clients/redact.js';

import type { Env } from '../../config/index.js';
import type { NodeClient } from '@sentry/node';

type ResolvedDataCollection = ReturnType<NodeClient['getDataCollectionOptions']>;

/**
 * Sentry 11 collects by default what 10 collected only with `sendDefaultPii`:
 * request bodies, headers, cookies, query strings, the user, database query
 * data, queue arguments, gen-AI inputs and outputs and the local variables of
 * every stack frame. This is a health product, so each category is switched off
 * by name. Written as an exhaustive literal (`satisfies` the SDK's own
 * `ResolvedDataCollection`, where every field and nested field is required) so a field a later SDK adds stops the type-check until
 * somebody decides it — an omitted field would silently take the collecting
 * default.
 *
 * `frameContextLines` is the one that stays on: it is lines of this project's
 * own source code around each frame, never a runtime value.
 */
export const DATA_COLLECTION = {
  cookies: false,
  databaseQueryData: false,
  frameContextLines: 5,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: { request: false, response: false },
  queues: false,
  stackFrameVariables: false,
  urlQueryParams: false,
  userInfo: false
} as const satisfies ResolvedDataCollection;

/**
 * Every secret this process holds, not only the AI provider keys
 * `redact.ts` scrubs for its own narrower purpose (a provider's own echoed
 * error text). This is the wider net a crash report needs: a driver error
 * can embed `DATABASE_URL` whole, a misconfigured webhook handler can echo
 * `CRON_SECRET` or `STRIPE_WEBHOOK_SECRET` back, a thrown `Error` can carry
 * anything a developer interpolated into its message. Trimmed the same way
 * `providerCredentials` trims — a value stored with stray whitespace would
 * search for a string the message never contains — and short values dropped,
 * since a placeholder is a word, not a credential.
 */
const MIN_SECRET_LENGTH = 12;

/** DrizzleQueryError appends the bound values after a `\nparams:` line. */
function cutParams(text: string): string {
  const at = text.indexOf('\nparams:');

  return at === -1 ? text : text.slice(0, at);
}

function allSecrets(env: Env): readonly string[] {
  const configured = [
    env.ANTHROPIC_API_KEY,
    env.GOOGLE_API_KEY,
    env.OMNIROUTE_API_KEY,
    env.OPENROUTER_API_KEY,
    env.BETTER_AUTH_SECRET,
    env.CRON_SECRET,
    env.DATABASE_URL,
    env.DIRECT_DATABASE_URL,
    env.STRIPE_SECRET_KEY,
    env.STRIPE_WEBHOOK_SECRET,
    env.VAPID_PRIVATE_KEY,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    env.APPLE_OAUTH_PRIVATE_KEY,
    env.SMTP_PASS,
    env.BLOB_READ_WRITE_TOKEN,
    env.OPENROUTER_IMAGE_API_KEY
  ].map(value => value?.trim());

  return [...new Set(configured.filter((value): value is string => (value?.length ?? 0) >= MIN_SECRET_LENGTH))];
}

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
  /** Resolved once at boot: a report is built inside a callback the SDK owns, which has no `Env`. */
  private readonly secrets: readonly string[];

  constructor(@Inject(ENV) env: Env) {
    this.enabled = Boolean(env.SENTRY_DSN);
    this.secrets = allSecrets(env);

    if (!this.enabled) {
      return;
    }

    const secrets = this.secrets;

    // The SDK falls back to this variable when no rate is passed, and any
    // rate — even 0 — loads the tracing integrations. Traces stay off only if
    // no rate reaches the SDK at all.
    Reflect.deleteProperty(process.env, 'SENTRY_TRACES_SAMPLE_RATE');

    Sentry.init({
      beforeSend(event) {
        // Whatever the SDK collected on its own, it does not leave here.
        // Breadcrumbs and extra context are nothing this codebase ever sets
        // deliberately — only the SDK's own auto-instrumentation would, and
        // that is exactly the "collected on its own" this rule already
        // refuses for `request`, `user` and the response context.
        delete event.request;
        delete event.user;
        delete event.contexts?.response;
        delete event.breadcrumbs;
        delete event.extra;
        // The http integration names it "METHOD raw-path": ids, and an
        // invitation token. `tags.where` already holds the route pattern.
        delete event.transaction;

        if (event.message) {
          event.message = redactSecrets(cutParams(event.message), secrets);
        }

        for (const value of event.exception?.values ?? []) {
          if (value.value) {
            value.value = redactSecrets(cutParams(value.value), secrets);
          }
        }

        // The only tag this codebase sets is `where` (a route or job name,
        // never a value from a request) — scrubbed anyway, on the same
        // belt-and-braces reasoning as the wider secret list above.
        if (event.tags) {
          for (const [key, value] of Object.entries(event.tags)) {
            if (typeof value === 'string') {
              event.tags[key] = redactSecrets(value, secrets);
            }
          }
        }

        return event;
      },
      beforeSendLog: () => null,
      beforeSendMetric: () => null,
      dataCollection: DATA_COLLECTION,
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      includeServerName: false,
      // The commit is the release, so a spike can be read against a deploy.
      release: env.VERCEL_GIT_COMMIT_SHA,
      // Errors only. There is deliberately NO `tracesSampleRate` (nor a
      // `tracesSampler`): the SDK enables tracing whenever one is defined, even
      // as 0, and an incoming `sentry-trace: ...-1` header then sends a span
      // envelope that never passes `beforeSend`. Omitting it is what keeps
      // tracing off.
      // No trace headers on outgoing calls (OpenRouter, Stripe, Google).
      tracePropagationTargets: []
    });
    this.logger.log(`Error reporting on (${env.NODE_ENV})`);
  }

  /**
   * Reports one failure. `where` is a stable label — a route, a job — so the
   * same fault groups across releases; never a value from a request.
   */
  report(error: unknown, where: string): void {
    if (!this.enabled) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setTag('where', where);
      Sentry.captureException(error instanceof Error ? error : new Error(redactSecrets(String(error), this.secrets)));
    });
  }
}

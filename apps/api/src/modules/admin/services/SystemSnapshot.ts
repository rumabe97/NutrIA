import { PROMPT_VERSION, STEPS_VERSION } from '../../ai/prompts/PoolPrompt.js';
import { resolvePictureSettings } from '../../ai/ai.config.js';

import type { Env } from '../../../config/index.js';
import type { SystemSnapshot } from 'core/controllers/Admin';

/** What the console may know of the two channels' own state, which their services decide. */
export type ChannelState = { readonly mail: boolean; readonly push: boolean };

/**
 * The environment turned into what Ajustes › Sistema may show (`0071`): a yes
 * or a no per integration, the versions the code runs, and the commit.
 *
 * **Nothing is copied from the environment except a hash and a cap.** Every
 * integration is `Boolean(...)` of its variable, never the variable; the commit
 * is passed on for `AdminSystemController` to accept only if it is a hash. A
 * spec fills every variable with a recognisable secret and proves none of them
 * appears in the answer.
 */
export function systemSnapshot(env: Env, channels: ChannelState): SystemSnapshot {
  return {
    commit: env.VERCEL_GIT_COMMIT_SHA ?? null,
    integrations: {
      cronSecret: Boolean(env.CRON_SECRET),
      mail: channels.mail,
      ownerAddress: Boolean(env.OWNER_EMAIL),
      // Drawn and kept: the pictures' key (and not the stub) and the blob token, as `ai.module` wires them.
      pictures: resolvePictureSettings(env) !== null && Boolean(env.BLOB_READ_WRITE_TOKEN?.trim()),
      push: channels.push,
      rewriteSweep: env.AI_REWRITE_STEPS,
      sentry: Boolean(env.SENTRY_DSN)
    },
    pictureMonthlyCapUsd: env.AI_IMAGE_MONTHLY_CAP_USD,
    promptVersion: PROMPT_VERSION,
    stepsVersion: STEPS_VERSION
  };
}

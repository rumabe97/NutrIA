import type { ReminderRun } from '../../../notifications/index.js';
import type { RewriteHeldBack, RewriteRun } from '../../../ai/index.js';
import type { AuthRetentionRun } from '../../../auth/services/AuthRetention.service.js';
import type { TwoFactorRemovalRun } from '../../../auth/services/TwoFactorRemovals.service.js';

/** What one reminder sweep considered, sent, and failed to send. */
export type ReminderRunDto = ReminderRun;

/** What one rewrite sweep rewrote, skipped, and left. */
export type RewriteRunDto = RewriteHeldBack | RewriteRun;

/**
 * How many expired verification rows one prune deleted (`deleted`), and what
 * the authentication's retention deleted after it (PLAN 011 phase 7): quiet
 * sign-in brake rows and `auth.*` audit rows past twelve months.
 */
export type VerificationSweepDto = AuthRetentionRun & { readonly deleted: number };

/** What the nightly activation did (project 015): plans made active on their day, and owners it could not reach. */
export type PlanActivationDto = { readonly activated: number; readonly failed: number };

/** How many due removals of a second factor one run carried out, and how many failed (PLAN 011 phase 4). */
export type TwoFactorRemovalRunDto = TwoFactorRemovalRun;

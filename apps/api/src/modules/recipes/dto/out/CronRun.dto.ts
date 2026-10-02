import type { ReminderRun } from '../../../notifications/index.js';
import type { RewriteHeldBack, RewriteRun } from '../../../ai/index.js';

/** What one reminder sweep considered, sent, and failed to send. */
export type ReminderRunDto = ReminderRun;

/** What one rewrite sweep rewrote, skipped, and left. */
export type RewriteRunDto = RewriteHeldBack | RewriteRun;

/** How many expired verification rows one prune deleted. */
export type VerificationSweepDto = { readonly deleted: number };

/** What the nightly activation did (project 015): plans made active on their day, and owners it could not reach. */
export type PlanActivationDto = { readonly activated: number; readonly failed: number };

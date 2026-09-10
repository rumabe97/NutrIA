import type { IllustrationRun } from '../../../ai/index.js';
import type { ReminderRun } from '../../../notifications/index.js';
import type { RewriteRun } from '../../../ai/index.js';

/** What one illustration sweep drew, failed on, and left. */
export type IllustrationRunDto = IllustrationRun;

/** What one reminder sweep considered, sent, and failed to send. */
export type ReminderRunDto = ReminderRun;

/** What one rewrite sweep rewrote, skipped, and left. */
export type RewriteRunDto = RewriteRun;

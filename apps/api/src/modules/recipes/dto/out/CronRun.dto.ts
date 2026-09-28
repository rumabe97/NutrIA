import type { ReminderRun } from '../../../notifications/index.js';
import type { RewriteRun } from '../../../ai/index.js';

/** What one reminder sweep considered, sent, and failed to send. */
export type ReminderRunDto = ReminderRun;

/** What one rewrite sweep rewrote, skipped, and left. */
export type RewriteRunDto = RewriteRun;

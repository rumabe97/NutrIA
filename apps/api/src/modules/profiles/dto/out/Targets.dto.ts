import type { ResolvedTargets } from 'core/domain/Nutrition';

/**
 * The computed set with the person's own corrections merged over it, re-judged
 * against the same bounds on every read — so a target that no longer fits comes
 * back marked stale rather than applied or deleted.
 */
export type TargetsDto = ResolvedTargets;

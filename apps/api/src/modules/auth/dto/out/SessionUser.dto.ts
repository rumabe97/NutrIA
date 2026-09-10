import type { SessionUser } from '../../../../shared/index.js';

/**
 * Who the session belongs to, exactly as the guard resolved it — the state of
 * both locks included, because the waiting screen reads them (`0031`).
 */
export type SessionUserDto = SessionUser;

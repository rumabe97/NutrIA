import { z } from 'zod';

/**
 * The admin console's periods (`0068`): every chart and every "in the last N
 * days" figure covers 7, 30 or 90 calendar days, 30 when nothing is asked for,
 * and is compared with the period of the same length just before it.
 *
 * The grammar is here, as data; what a period *means* — its window, its day
 * keys, the zeros — is `core/domain/Period`.
 */
export const PERIODS = [7, 30, 90] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = 30;

/**
 * Whose calendar a day belongs to. The owner's: an evening in Spain counted as
 * the next UTC day would move a sign-up across the line on every chart (`0068`).
 * The SQL groups by the same zone, so the two can never disagree.
 */
export const CONSOLE_TIME_ZONE = 'Europe/Madrid';

/** A period's text in a query string. Derived from `PERIODS`, so the list is written once. */
const periodText = z.enum(PERIODS.map(String) as [`${Period}`, ...`${Period}`[]]);

/**
 * `?period=` as the console sends it: absent means the default, anything but
 * `7`, `30` or `90` is refused. The answer is a number.
 */
export const periodSchema = periodText.optional().transform((text): Period => (text === undefined ? DEFAULT_PERIOD : (Number(text) as Period)));

/** Every console read that covers a period takes this query and nothing else. */
export const periodQuerySchema = z.object({ period: periodSchema });

export type PeriodQuery = z.infer<typeof periodQuerySchema>;

/**
 * The instants a period covers.
 *
 * - `from` is the first Madrid midnight of the period, and `to` is the moment
 *   it was asked for: the current period is `[from, to)`, today included.
 * - `previousFrom` starts the period before it, which is `[previousFrom, from)`:
 *   the same number of whole calendar days.
 */
export type PeriodWindow = { readonly from: Date; readonly previousFrom: Date; readonly to: Date };

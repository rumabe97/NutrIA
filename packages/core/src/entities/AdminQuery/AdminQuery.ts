import { z } from 'zod';

/**
 * The query strings of the console's three people tables (`0068`): accounts,
 * the inbox and the professionals. Each is a Zod schema because the API binds
 * it as a query DTO, and a DTO's schema lives here.
 *
 * Every sort column is an allow-list: anything else is refused before a query
 * runs (422 `INVALID_INPUT`), so a column name never travels from a URL into
 * SQL. A value repeated in the URL arrives as an array and is refused too.
 */

/** Which way a column sorts. `desc` when absent: the useful end is the recent one. */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** The page sizes the console offers. The API accepts any size from 1 to `MAX_PAGE_SIZE`. */
export const PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

export const MAX_PAGE_SIZE = 100;

/** Far past any real list, short of anything that would stop being an integer. */
const MAX_OFFSET = 1_000_000;

/** Long enough for any address, short enough that a pasted page is refused. */
export const MAX_SEARCH_LENGTH = 200;

/** A two-way filter as the URL says it. Absent means "either". */
export const YES_NO = ['yes', 'no'] as const;

export type YesNo = (typeof YES_NO)[number];

const yesNo = z.enum(YES_NO).optional();

/**
 * Free text to look for, as a literal "contains". Blank is the same as absent. A NUL
 * character is refused here: Postgres cannot hold one in text, and would answer a 500.
 */
const search = z
  .string()
  .trim()
  .max(MAX_SEARCH_LENGTH)
  .refine(text => !text.includes('\u0000'), { message: 'A search cannot contain a NUL character' })
  .optional()
  .transform(text => (text === '' ? undefined : text));

const direction = z.enum(SORT_DIRECTIONS).default('desc');

const offset = z.coerce.number().int().min(0).max(MAX_OFFSET).default(0);

const size = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

/** The columns the account table sorts by. */
export const ACCOUNT_SORTS = ['createdAt', 'email', 'lastActiveAt', 'plans'] as const;

export type AccountSort = (typeof ACCOUNT_SORTS)[number];

/**
 * `GET /admin/accounts`: search by address, filter by the two locks, the
 * milestones, the tier and the role, sort, page. Every filter is about the
 * account — never about what it eats or its profile (`0028`).
 */
export const accountQuerySchema = z.object({
  activated: yesNo,
  confirmed: yesNo,
  dir: direction,
  offset,
  onboarded: yesNo,
  professional: yesNo,
  q: search,
  role: z.enum(['admin', 'user']).optional(),
  size,
  sort: z.enum(ACCOUNT_SORTS).default('createdAt'),
  tier: z.enum(['free', 'premium']).optional()
});

export type AccountQuery = z.infer<typeof accountQuerySchema>;

/** Which messages the inbox shows: every one, the ones still waiting, or the ones marked seen. */
export const FEEDBACK_STATES = ['all', 'waiting', 'seen'] as const;

export type FeedbackState = (typeof FEEDBACK_STATES)[number];

export const FEEDBACK_SORTS = ['createdAt'] as const;

/** `GET /admin/feedback`: search the message or the sender's address, filter by state, sort by date, page. */
export const feedbackQuerySchema = z.object({
  dir: direction,
  offset,
  q: search,
  size,
  sort: z.enum(FEEDBACK_SORTS).default('createdAt'),
  state: z.enum(FEEDBACK_STATES).default('all')
});

export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;

/** `links` sorts by active links, then by every link. */
export const PROFESSIONAL_SORTS = ['grantedAt', 'email', 'links'] as const;

export type ProfessionalSort = (typeof PROFESSIONAL_SORTS)[number];

/** `GET /admin/professionals`: search by address and sort. Unpaged: there are few. */
export const professionalQuerySchema = z.object({ dir: direction, q: search, sort: z.enum(PROFESSIONAL_SORTS).default('grantedAt') });

export type ProfessionalQuery = z.infer<typeof professionalQuerySchema>;

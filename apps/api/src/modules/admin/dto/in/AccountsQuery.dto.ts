import { accountQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The account table's query string (`0068`): search, filters about the account,
 * a sort from an allow-list, and the page. Anything else is a 422 before a
 * query runs; `?offset=` alone is today's call and still works.
 */
export const AccountsQueryDto = zodDto('AccountsQuery', accountQuerySchema);
export type AccountsQueryDto = InferDto<typeof AccountsQueryDto>;

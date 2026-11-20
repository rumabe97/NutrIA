import { noticeDateSchema } from 'core/entities/Notice';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The day the notice announces — the day the owner means to make the change (`textos/06` § Z). After today; the controller checks. */
export const NoticeDateDto = zodDto('NoticeDate', noticeDateSchema);
export type NoticeDateDto = InferDto<typeof NoticeDateDto>;

import { noticeDateSchema, noticePageSchema, noticeSendSchema } from 'core/entities/Notice';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The day the notice announces — the day the owner means to make the change (`textos/06` § Z). After today; the controller checks. */
export const NoticeDateDto = zodDto('NoticeDate', noticeDateSchema);
export type NoticeDateDto = InferDto<typeof NoticeDateDto>;

/** A send's body: the day, and the `after` cursor the previous press answered (absent: from the oldest account owed). */
export const NoticeSendBodyDto = zodDto('NoticeSend', noticeSendSchema);
export type NoticeSendBodyDto = InferDto<typeof NoticeSendBodyDto>;

/** The preview's page of recipients: `?offset=&size=`, as `/admin/cuentas` pages (size at most 100). */
export const NoticePageDto = zodDto('NoticePage', noticePageSchema);
export type NoticePageDto = InferDto<typeof NoticePageDto>;

import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminNoticesService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { NoticeDateDto, NoticePageDto, NoticeSendBodyDto } from '../dto/in/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { NoticePreviewDto, NoticeSendDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The owner's notice to every account, from the console (project 025 phase 10,
 * `docs/legal/textos/06` § Z): first who it would go to, then the next batch.
 *
 * `@Roles('admin')` on the class: the owner, with the second factor the
 * console's guard asks for, and the same 404 for anybody else. `:notice` names
 * one of core's closed list (`ACCOUNT_NOTICES`); any other is that 404 too. The
 * body is the day the change will be made — after today, and the same day for
 * every press of one notice — refused with a 422 that says which.
 */
@ApiTags('admin')
@Controller('admin/notices')
@Roles('admin')
export class AdminNoticesController {
  constructor(private readonly notices: AdminNoticesService) {}

  @ApiOkResponse({
    description:
      "The totals, the announced day as each language's mail writes it, and one page (`?offset=&size=`, size at most 100) of the accounts owed this notice with the language each mail would be in. Nothing is sent or written. 422 `date: not_after_today`, `too_far` or `campaign_date:<day>`."
  })
  @ApiOperation({ summary: 'Preview a notice to every account (project 025 phase 10)' })
  @HttpCode(HttpStatus.OK)
  @Post(':notice/preview')
  async preview(
    @Param('notice') notice: string,
    @ZodBody(NoticeDateDto) body: NoticeDateDto,
    @ZodQuery(NoticePageDto) page: NoticePageDto
  ): Promise<NoticePreviewDto> {
    return this.notices.preview(notice, body, page);
  }

  @ApiOkResponse({
    description:
      "Mails the next batch (at most 25, within the day's cap of 200), after the `after` cursor the previous press answered, one by one, each recorded once its mail is accepted; answers sent, failed with the failed addresses, skipped as unconfirmed, still owed, whether it stopped early on its time budget, and the next cursor. Safe to press again: a told account is never mailed again. 409 `CONFLICT` while another press runs, 409 `NOTICE_DAILY_CAP` once the day's cap is spent; 422 as the preview."
  })
  @ApiOperation({ summary: 'Send the next batch of a notice (project 025 phase 10)' })
  @HttpCode(HttpStatus.OK)
  @Post(':notice/send')
  async send(
    @CurrentUser() owner: SessionUser,
    @Param('notice') notice: string,
    @ZodBody(NoticeSendBodyDto) body: NoticeSendBodyDto
  ): Promise<NoticeSendDto> {
    return this.notices.send(notice, owner.id, body);
  }
}

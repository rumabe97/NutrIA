import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminNoticesService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { NoticeDateDto } from '../dto/in/index.js';

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
      'Who a send would mail — every account with a confirmed address and no row for this notice, with the language its mail would be in — and the counts. Nothing is sent or written. 422 `date: not_after_today` or `date: campaign_date:<day>`.'
  })
  @ApiOperation({ summary: 'Preview a notice to every account (project 025 phase 10)' })
  @HttpCode(HttpStatus.OK)
  @Post(':notice/preview')
  async preview(@Param('notice') notice: string, @ZodBody(NoticeDateDto) body: NoticeDateDto): Promise<NoticePreviewDto> {
    return this.notices.preview(notice, body);
  }

  @ApiOkResponse({
    description:
      'Mails the next batch (at most 25), one by one, each recorded once its mail is accepted, and answers sent, failed, skipped as unconfirmed and still owed. Safe to press again: a told account is never mailed again. 409 while another press of the same notice runs; 422 as the preview.'
  })
  @ApiOperation({ summary: 'Send the next batch of a notice (project 025 phase 10)' })
  @HttpCode(HttpStatus.OK)
  @Post(':notice/send')
  async send(
    @CurrentUser() owner: SessionUser,
    @Param('notice') notice: string,
    @ZodBody(NoticeDateDto) body: NoticeDateDto
  ): Promise<NoticeSendDto> {
    return this.notices.send(notice, owner.id, body);
  }
}

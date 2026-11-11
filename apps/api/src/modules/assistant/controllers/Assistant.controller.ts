import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AskAssistantDto } from '../dto/in/index.js';
import { AssistantService } from '../services/index.js';
import { AssistantSwitchGuard } from '../../../shared/guards/AssistantSwitch.guard.js';
import { CurrentUser, RateLimit, ZodBody } from '../../../shared/index.js';

import type { AssistantConversationDto, AssistantExportDto, AssistantStandingDto, AssistantThreadDto } from '../dto/out/index.js';
import type { Response } from 'express';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The nutrition assistant (project 023).
 *
 * Every route is a signed-in person's own. Asking and the standing sit behind
 * the `assistant` switch (off: 404, like a route never written); reading and
 * deleting one's own conversations do not, so turning it off never strands
 * what somebody said. Somebody else's conversation or turn is a 404, the same
 * answer as one that does not exist.
 */
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @ApiOkResponse({
    description: 'This fortnight: how many messages are used and left, when the count resets, and whether questions are still labelled.'
  })
  @ApiOperation({ summary: 'Where this person stands with the assistant' })
  @Get('standing')
  @UseGuards(AssistantSwitchGuard)
  async standing(@CurrentUser() user: SessionUser): Promise<AssistantStandingDto> {
    return this.assistant.standing(user.id);
  }

  @ApiOkResponse({ description: 'Their conversations, the most recently continued first.' })
  @ApiOperation({ summary: 'List conversations' })
  @Get('conversations')
  async conversations(@CurrentUser() user: SessionUser): Promise<readonly AssistantConversationDto[]> {
    return this.assistant.conversations(user.id);
  }

  /**
   * Declared before `conversations/:id`, which would otherwise take `export` as
   * an id and refuse it as no UUID. Not behind the switch, like reading: a copy
   * of what somebody said is theirs whether the assistant is on or off.
   */
  @ApiOkResponse({ description: 'Every conversation of theirs with its turns, as their own copy to download (art. 20).' })
  @ApiOperation({ summary: 'Download a copy of every conversation' })
  @Get('conversations/export')
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async everything(@CurrentUser() user: SessionUser): Promise<AssistantExportDto> {
    return this.assistant.everything(user.id);
  }

  @ApiOkResponse({ description: 'One conversation and its turns, oldest first. 404 for one that is not theirs.' })
  @ApiOperation({ summary: 'Read a conversation' })
  @Get('conversations/:id')
  async thread(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<AssistantThreadDto> {
    return this.assistant.thread(user.id, id);
  }

  @ApiNoContentResponse({ description: 'Deleted, with every turn in it. 404 for one that is not theirs.' })
  @ApiOperation({ summary: 'Delete a conversation' })
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.assistant.deleteConversation(user.id, id);
  }

  @ApiNoContentResponse({ description: 'Deleted. The message it was counted as stays counted. 404 for one that is not theirs.' })
  @ApiOperation({ summary: 'Delete one turn' })
  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTurn(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.assistant.deleteTurn(user.id, id);
  }

  /**
   * One question, answered as NDJSON while it is written (`AssistantEventDto`).
   *
   * Refusals that can be a status are one — 429 past the allowance, 503 when
   * the assistant is down for everybody, 404 for somebody else's conversation —
   * and arrive before the first byte. After that, the answer can only end.
   *
   * **`Cache-Control: no-transform` is load-bearing.** The API compresses every
   * response, and `compression` holds a compressible body until it ends: measured
   * on 2026-11-09 with this stack, three chunks 300 ms apart arrived as **one**
   * lump at 937 ms with `text/plain`, and on time with `no-transform`. NDJSON is
   * not on compression's list today, which is luck, not design; the header is
   * the design, and it also tells anything between here and the screen not to
   * buffer or rewrite the body.
   */
  @ApiOperation({ summary: 'Ask the assistant a question; the answer streams as NDJSON' })
  @Post('messages')
  @UseGuards(AssistantSwitchGuard)
  @RateLimit({ limit: 20, ttlSeconds: 600 })
  async ask(@CurrentUser() user: SessionUser, @ZodBody(AskAssistantDto) body: AskAssistantDto, @Res() response: Response): Promise<void> {
    const abort = new AbortController();

    // The person left: stop paying for an answer nobody will read.
    response.on('close', () => {
      if (!response.writableEnded) {
        abort.abort();
      }
    });

    const events = await this.assistant.ask(user.id, body, abort.signal);

    response
      .status(HttpStatus.OK)
      .set({ 'Cache-Control': 'no-store, no-transform', 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();

    try {
      for await (const event of events) {
        if (response.destroyed) {
          break;
        }

        response.write(`${JSON.stringify(event)}\n`);
      }
    } catch {
      // The status went out with the headers; an error now can only end the
      // body, never become one. The exception filter would try to send a second
      // response on this one.
      if (!response.destroyed) {
        response.write(`${JSON.stringify({ type: 'error' })}\n`);
      }
    }

    response.end();
  }
}

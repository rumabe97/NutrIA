import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AddEventDto } from '../dto/in/index.js';
import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { EventsService } from '../services/index.js';

import type { EventDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Days that ask more of the body (`0043`). Every route is scoped to the
 * caller's own session, and the id in the URL is checked against it rather
 * than trusted.
 *
 * Not behind `@RequiresOnboarding()`, like vacations: knowing the date of a
 * race before finishing a profile is an ordinary order of events, and the
 * plan that eats for it is generated later anyway.
 */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @ApiOkResponse({ description: 'Events that have not happened yet, soonest first.' })
  @ApiOperation({ summary: 'Events that have not happened yet, soonest first' })
  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<readonly EventDto[]> {
    return this.events.list(user.id);
  }

  @ApiCreatedResponse({ description: 'The event, and the days that will eat for it at the next generation.' })
  @ApiOperation({ summary: 'Declare a day the days before it should eat for' })
  @Post()
  async add(@CurrentUser() user: SessionUser, @ZodBody(AddEventDto) body: AddEventDto): Promise<EventDto> {
    return this.events.add(user.id, body);
  }

  @ApiNoContentResponse({ description: 'Removed. Days already built for it keep saying so.' })
  @ApiOperation({ summary: 'Remove an event' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.events.remove(user.id, id);
  }
}

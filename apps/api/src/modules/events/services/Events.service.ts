import { Injectable } from '@nestjs/common';

import { EventController } from 'core/controllers/Event';

import { PlanLoadRebuildService } from './PlanLoadRebuild.service.js';

import type { AddEventDto } from '../dto/in/index.js';
import type { AddedEventDto, EventDto } from '../dto/out/index.js';

@Injectable()
export class EventsService {
  constructor(private readonly rebuild: PlanLoadRebuildService) {}

  /**
   * Declares the event, then — for an account whose tier allows it — rebuilds
   * the days of the fortnight under way that eat for it (`0044`). The event is
   * written first and stands whatever the rebuild decides: a rebuild that does
   * not happen is the free tier's ordinary answer, and the answer says which
   * days it did reach.
   */
  async add(userId: string, body: AddEventDto): Promise<AddedEventDto> {
    const event = await EventController.add(userId, body);

    return { ...event, rebuiltDates: await this.rebuild.forEvent(userId, event) };
  }

  async list(userId: string): Promise<readonly EventDto[]> {
    return EventController.list(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await EventController.remove(userId, id);
  }
}

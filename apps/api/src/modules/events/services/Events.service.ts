import { Injectable } from '@nestjs/common';

import { EventController } from 'core/controllers/Event';

import type { AddEventDto } from '../dto/in/index.js';
import type { EventDto } from '../dto/out/index.js';

@Injectable()
export class EventsService {
  async add(userId: string, body: AddEventDto): Promise<EventDto> {
    return EventController.add(userId, body);
  }

  async list(userId: string): Promise<readonly EventDto[]> {
    return EventController.list(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await EventController.remove(userId, id);
  }
}

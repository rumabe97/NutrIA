import { Injectable } from '@nestjs/common';

import { PantryController } from 'core/controllers/Pantry';

import type { AddPantryItemDto } from '../dto/in/index.js';
import type { PantryDto } from '../dto/out/index.js';

/**
 * The cupboard's one seam onto `packages/core`.
 *
 * Every method is a line, which is the point: the seam exists before the day
 * something needs to go in it — phase 2's generation spends the draft through
 * `PantryController` too, from the meal-plans side, and nothing about that
 * belongs in a route handler.
 */
@Injectable()
export class PantryService {
  async add(userId: string, body: AddPantryItemDto): Promise<PantryDto> {
    return PantryController.add(userId, body);
  }

  async clear(userId: string): Promise<PantryDto> {
    return PantryController.clear(userId);
  }

  async read(userId: string): Promise<PantryDto> {
    return PantryController.read(userId);
  }

  async remove(userId: string, id: string): Promise<PantryDto> {
    return PantryController.remove(userId, id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';

import { PlanController } from 'core/controllers/Plan';

import type { SetShoppingItemDto } from '../dto/in/index.js';
import type { ShoppingListDto } from '../dto/out/index.js';

@Injectable()
export class ShoppingListsService {
  /**
   * Two calls, because "the active plan" is not something a list can be looked
   * up by: the plan resolves ownership and the list hangs off it. The order
   * lives here rather than in a route handler — a second call in a handler is
   * how orchestration ends up on the wrong side of the seam (`0039`).
   */
  async active(userId: string, locale: string | null): Promise<ShoppingListDto> {
    const plan = await PlanController.getActivePlan(userId, locale);

    if (!plan) {
      throw new NotFoundException();
    }

    return PlanController.getShoppingList(userId, plan.id, locale);
  }

  async setChecked(userId: string, itemId: string, body: SetShoppingItemDto): Promise<void> {
    await PlanController.setShoppingItemChecked(userId, itemId, body.checked);
  }
}

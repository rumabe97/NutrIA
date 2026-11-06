import { Injectable, NotFoundException } from '@nestjs/common';

import { UserController } from 'core/controllers/User';

import type { AccountsQueryDto, SetTierDto } from '../dto/in/index.js';
import type { AccountsDto, ActivatedAccountDto, TierChangedDto } from '../dto/out/index.js';

@Injectable()
export class AdminAccountsService {
  async activate(id: string, actorId: string): Promise<ActivatedAccountDto> {
    const opened = await UserController.activate({ id }, { actorId, via: 'console' });

    if (!opened) {
      throw new NotFoundException();
    }

    return opened;
  }

  /**
   * Moves one account between tiers (`0042`).
   *
   * A 404 when nothing matched, like every other denial: the owner typing an id
   * that does not exist learns the same thing a stranger would.
   */
  async setTier(id: string, body: SetTierDto, actorId: string): Promise<TierChangedDto> {
    const moved = await UserController.setTier(id, body.tier, actorId);

    if (!moved) {
      throw new NotFoundException();
    }

    return { email: moved.email, tier: body.tier };
  }

  /** The query arrives validated (`AccountsQueryDto`); the rules of the table are `packages/core`'s. */
  async list(query: AccountsQueryDto): Promise<AccountsDto> {
    return UserController.accounts(query);
  }
}

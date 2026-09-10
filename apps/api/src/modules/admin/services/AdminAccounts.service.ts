import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { UserController } from 'core/controllers/User';

import { ENV } from '../../../config/index.js';
import { verifyActivationToken } from '../../auth/services/ActivationLink.js';

import type { SetTierDto } from '../dto/in/index.js';
import type { AccountsDto, ActivatedAccountDto, TierChangedDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';

@Injectable()
export class AdminAccountsService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async activate(id: string): Promise<ActivatedAccountDto> {
    const opened = await UserController.activate({ id });

    if (!opened) {
      throw new NotFoundException();
    }

    return opened;
  }

  /**
   * The button in the owner's mail (`0030`). The signed token is the authority:
   * it names one account, it expires, and it can do nothing else. A bad or
   * stale token is a 404 like every other denial, so the route tells a stranger
   * nothing — including whether the account exists.
   */
  async activateByToken(token: string | undefined): Promise<ActivatedAccountDto> {
    const userId = token ? verifyActivationToken(token, this.env.BETTER_AUTH_SECRET) : null;

    if (!userId) {
      throw new NotFoundException();
    }

    return this.activate(userId);
  }

  /**
   * Moves one account between tiers (`0042`).
   *
   * A 404 when nothing matched, like every other denial: the owner typing an id
   * that does not exist learns the same thing a stranger would.
   */
  async setTier(id: string, body: SetTierDto): Promise<TierChangedDto> {
    const moved = await UserController.setTier(id, body.tier);

    if (!moved) {
      throw new NotFoundException();
    }

    return { email: moved.email, tier: body.tier };
  }

  /**
   * Parsed leniently on purpose: a pager that 422s on a hand-typed URL is a
   * pager that costs the owner a page load to learn nothing. The bounds are
   * `packages/core`'s.
   */
  async list(offset?: string, size?: string): Promise<AccountsDto> {
    return UserController.accounts({ offset: Number.parseInt(offset ?? '', 10) || 0, size: Number.parseInt(size ?? '', 10) || undefined });
  }
}

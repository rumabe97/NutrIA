import { Controller, Get, Headers, Inject, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ENV } from '../../config/index.js';
import { RecipeIllustrator } from '../ai/RecipeIllustrator.service.js';
import { Public, SkipRateLimit } from '../../shared/decorators/index.js';

import type { Env } from '../../config/index.js';
import type { IllustrationRun } from '../ai/RecipeIllustrator.service.js';

/** Per sweep. Ten seconds an image; a minute of work, well inside the function's ceiling. */
const PER_SWEEP = 6;

/**
 * The cron's entry: draw whatever the after-generation batch left behind.
 *
 * The platform calls it with `Authorization: Bearer <CRON_SECRET>`. Anything else
 * — the wrong secret, no secret configured at all — is a 404 like every other
 * denial here, so the route's existence is not confirmed to whoever probes it.
 */
@ApiExcludeController()
@Controller('cron')
export class IllustrateController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly illustrator: RecipeIllustrator
  ) {}

  @Get('illustrate')
  @Public()
  @SkipRateLimit()
  async illustrate(@Headers('authorization') authorization: string | undefined): Promise<IllustrationRun> {
    if (!this.env.CRON_SECRET || authorization !== `Bearer ${this.env.CRON_SECRET}`) {throw new NotFoundException();}

    return this.illustrator.illustrateMissing(PER_SWEEP);
  }
}

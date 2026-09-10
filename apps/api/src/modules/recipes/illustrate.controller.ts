import { Controller, Get, Headers, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ENV } from '../../config/index.js';
import { Public, SkipRateLimit } from '../../shared/decorators/index.js';
import { CheckInReminderService } from '../notifications/index.js';
import { RecipeIllustrator } from '../ai/RecipeIllustrator.service.js';
import { RecipeRewriter } from '../ai/RecipeRewriter.service.js';

import type { Env } from '../../config/index.js';
import type { IllustrationRun } from '../ai/RecipeIllustrator.service.js';
import type { ReminderRun } from '../notifications/index.js';
import type { RewriteRun } from '../ai/RecipeRewriter.service.js';

/** Six images a sweep: ten seconds each, a minute of work, well inside the function's ceiling. */
const IMAGES_PER_SWEEP = 6;

/** Text is faster and free-tier, so the library drains in a few sweeps rather than a day. */
const REWRITES_PER_SWEEP = 10;

/**
 * The platform's cron calls these; nothing else may.
 *
 * It sends `Authorization: Bearer <CRON_SECRET>`. Anything else — the wrong
 * secret, no secret, no secret configured at all — is a 404 like every other
 * denial here, so probing does not confirm the route exists.
 *
 * The unconfigured case is logged, once per call, at warn: an operator watching
 * a cron quietly 404 every ten minutes needs to be able to tell "you have not set
 * CRON_SECRET" from "someone is knocking", and the response cannot tell them.
 */
@ApiExcludeController()
@Controller('cron')
export class IllustrateController {
  private readonly logger = new Logger(IllustrateController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly illustrator: RecipeIllustrator,
    private readonly reminders: CheckInReminderService,
    private readonly rewriter: RecipeRewriter
  ) {}

  @Get('illustrate')
  @Public()
  @SkipRateLimit()
  async illustrate(@Headers('authorization') authorization: string | undefined): Promise<IllustrationRun> {
    this.authorise(authorization);

    return this.illustrator.illustrateMissing(IMAGES_PER_SWEEP);
  }

  /** Once a day: everyone whose fortnight closed and who has not been told. */
  @Get('reminders')
  @Public()
  @SkipRateLimit()
  async checkInReminders(@Headers('authorization') authorization: string | undefined): Promise<ReminderRun> {
    this.authorise(authorization);

    return this.reminders.sweep();
  }

  @Get('rewrite-steps')
  @Public()
  @SkipRateLimit()
  async rewriteSteps(@Headers('authorization') authorization: string | undefined): Promise<RewriteRun> {
    this.authorise(authorization);

    return this.rewriter.rewriteOutdated(REWRITES_PER_SWEEP);
  }

  private authorise(authorization: string | undefined): void {
    if (!this.env.CRON_SECRET) {
      this.logger.warn('A cron route was called but CRON_SECRET is not configured; every call will 404 until it is set');
      throw new NotFoundException();
    }

    if (authorization !== `Bearer ${this.env.CRON_SECRET}`) {throw new NotFoundException();}
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowUnverified, Public } from '../../../shared/index.js';
import { SettingsService } from '../services/index.js';

import type { SettingsDto, SignInProvidersDto } from '../dto/out/index.js';

/**
 * The one switch a signed-in person needs to know about themselves: whether
 * registration is open, which is what decides if confirming their address
 * opens their account or leaves them waiting for the owner (`0031`).
 *
 * `@AllowUnverified()` because the only screen that asks is the waiting room,
 * and an account stuck there is exactly the one the guard would refuse. Not
 * `@Public()`: it says nothing about any person, but a signed-in caller is a
 * small enough audience for a switch that is nobody's business but ours.
 *
 * Read-only. Throwing the switch stays on `/admin`, behind the role.
 */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @AllowUnverified()
  @ApiOkResponse({ description: 'Whether confirming an address opens the account by itself.' })
  @ApiOperation({ summary: 'Whether signing up is open' })
  @Get()
  async read(): Promise<SettingsDto> {
    return this.settings.read();
  }

  /*
   * `@Public()`, unlike the switch above, because the pages that ask are the
   * ones nobody has a session on yet. It says which buttons this deployment
   * can honour and nothing about anybody: the same answer the sign-in page
   * gives away by drawing them (`0058`).
   */
  @ApiOkResponse({ description: 'The providers with credentials on this deployment, in display order. Empty when there are none.' })
  @ApiOperation({ summary: 'Which providers somebody can sign in through' })
  @Get('sign-in-providers')
  @Public()
  signInProviders(): SignInProvidersDto {
    return this.settings.signInProviders();
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SafetyController as SafetyService } from 'core/controllers/Safety';
import { setAllergiesSchema } from 'core/entities/Safety';

import { CurrentUser, Public } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { Allergen, SetAllergies } from 'core/entities/Safety';
import type { SessionUser } from '../../shared/decorators/index.js';

@ApiTags('safety')
@Controller('safety')
export class SafetyRestController {
  @ApiOperation({ summary: 'The allergen catalogue (EU-14 plus common intolerance triggers)' })
  @Get('allergens')
  @Public()
  async allergens(): Promise<readonly Allergen[]> {
    // Reference data, identical for everyone and needed by the onboarding form
    // before a session necessarily exists.
    return SafetyService.listAllergens();
  }

  @ApiOperation({ summary: "The signed-in user's allergies and intolerances" })
  @Get('restrictions')
  async restrictions(@CurrentUser() user: SessionUser) {
    return SafetyService.getRestrictions(user.id);
  }

  @ApiOperation({ summary: 'Replace the full set of allergies and intolerances' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('restrictions')
  async setRestrictions(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(setAllergiesSchema)) body: SetAllergies): Promise<void> {
    // PUT, not PATCH: the client sends the complete set, so removing an allergy
    // is expressible. A partial update could never delete one.
    await SafetyService.setRestrictions(user.id, body);
  }
}

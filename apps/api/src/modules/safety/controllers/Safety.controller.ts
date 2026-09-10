import { Controller, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public, ZodBody } from '../../../shared/index.js';
import { SafetyService } from '../services/index.js';
import { SetAllergiesDto } from '../dto/in/index.js';

import type { AllergenDto, RestrictionsDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

@ApiTags('safety')
@Controller('safety')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @ApiOkResponse({ description: 'The catalogue, identical for everyone.' })
  @ApiOperation({ summary: 'The allergen catalogue (EU-14 plus common intolerance triggers)' })
  @Get('allergens')
  @Public()
  async allergens(): Promise<readonly AllergenDto[]> {
    // Reference data, identical for everyone and needed by the onboarding form
    // before a session necessarily exists.
    return this.safety.listAllergens();
  }

  @ApiOkResponse({ description: 'Declared allergies, intolerances and free-text allergens.' })
  @ApiOperation({ summary: "The signed-in user's allergies and intolerances" })
  @Get('restrictions')
  async restrictions(@CurrentUser() user: SessionUser): Promise<RestrictionsDto> {
    return this.safety.restrictions(user.id);
  }

  @ApiNoContentResponse({ description: 'Replaced. Read them back to see how free text resolved.' })
  @ApiOperation({ summary: 'Replace the full set of allergies and intolerances' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('restrictions')
  async setRestrictions(@CurrentUser() user: SessionUser, @ZodBody(SetAllergiesDto) body: SetAllergiesDto): Promise<void> {
    // PUT, not PATCH: the client sends the complete set, so removing an allergy
    // is expressible. A partial update could never delete one.
    await this.safety.setRestrictions(user.id, body);
  }
}

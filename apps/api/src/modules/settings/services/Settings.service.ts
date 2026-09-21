import { Inject, Injectable } from '@nestjs/common';

import { SettingsController } from 'core/controllers/Settings';

import { configuredSocialProviders } from '../../auth/services/SocialProviders.js';
import { ENV } from '../../../config/index.js';

import type { SettingsDto, SignInProvidersDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';

@Injectable()
export class SettingsService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async read(): Promise<SettingsDto> {
    return SettingsController.read();
  }

  /** Read from the environment, not the database: a provider is on when its credentials are here (`0058`). */
  signInProviders(): SignInProvidersDto {
    return { providers: configuredSocialProviders(this.env) };
  }
}

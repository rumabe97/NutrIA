import { Injectable } from '@nestjs/common';

import { ProfessionalController } from 'core/controllers/Professional';

import type { GrantProfessionalDto } from '../dto/in/index.js';
import type { ProfessionalAccountDto, ProfessionalsDto } from '../dto/out/index.js';

@Injectable()
export class AdminProfessionalsService {
  /**
   * The owner's act (`0059`). `id` names the account being granted; `grantedBy`
   * is the session's user — the owner — and is what the row remembers.
   */
  async grant(id: string, body: GrantProfessionalDto, grantedBy: string): Promise<ProfessionalAccountDto> {
    return ProfessionalController.grant(id, body, grantedBy);
  }

  async list(): Promise<ProfessionalsDto> {
    return ProfessionalController.list();
  }

  async revoke(id: string): Promise<void> {
    await ProfessionalController.revoke(id);
  }
}

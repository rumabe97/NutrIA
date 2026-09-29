import { Injectable } from '@nestjs/common';

import { AuditController } from 'core/controllers/Audit';

import type { AdminAuditDto } from '../dto/out/index.js';
import type { AuditQueryDto } from '../dto/in/index.js';

@Injectable()
export class AdminAuditService {
  /** The query arrives validated (`AuditQueryDto`). */
  async list(query: AuditQueryDto): Promise<AdminAuditDto> {
    return AuditController.list(query);
  }
}

import { auditQuerySchema } from 'core/entities/Audit';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Ajustes › Registro de acciones' query string (`0071`): filter by action, page. */
export const AuditQueryDto = zodDto('AuditQuery', auditQuerySchema);
export type AuditQueryDto = InferDto<typeof AuditQueryDto>;

import type { AuditLogView } from 'core/controllers/Audit';
import type { Paged } from 'core/controllers/User';

/** One page of Ajustes › Registro de acciones (`0071`), newest first. */
export type AdminAuditDto = Paged<AuditLogView>;

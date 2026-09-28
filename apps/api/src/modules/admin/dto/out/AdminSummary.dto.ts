import type { AdminSummaryView } from 'core/controllers/Admin';

/** Resumen over a period: tiles against the previous period, sign-ups and generations per day, and what needs the owner. Counts only (`0028`). */
export type AdminSummaryDto = AdminSummaryView;

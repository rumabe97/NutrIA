import type { AdminPlansView } from 'core/controllers/Admin';

/** Planes: every plan by state, and plans made per day over the period. Counts only — no plan is read (`0028`). */
export type AdminPlansDto = AdminPlansView;

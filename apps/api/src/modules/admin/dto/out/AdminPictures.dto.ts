import type { AdminPicturesPeriodView } from 'core/controllers/Admin';

/**
 * This month's dish-picture spend against the cap and how many are ready,
 * failed, released or being drawn (`0066`), and the spend per day over a
 * period (`0068`). Counts and sums only.
 */
export type AdminPicturesPeriodDto = AdminPicturesPeriodView;

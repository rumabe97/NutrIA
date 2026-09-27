import type { PictureStatusView } from 'core/controllers/Recipe';

/**
 * Where a dish's picture stands, for the meal page to poll while it says
 * `drawing` (`0066`): `ready` with the picture's public address, or `drawing`,
 * or `none` — a failure included, which is the placeholder and nothing else.
 */
export type PictureStatusDto = PictureStatusView;

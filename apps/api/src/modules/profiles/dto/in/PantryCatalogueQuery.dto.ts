import { pantryCatalogueQuerySchema } from 'core/entities/Pantry';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The word the picker is asking about.
 *
 * **A body for a read**, which is the whole point of it: a query string reaches
 * the platform's own request log, which is not ours to redact, and
 * `/privacidad` promises that nothing somebody writes is kept there. `0100` is
 * the precedent and the route's own comment carries the reasoning.
 *
 * Absent and empty are the same ask — *"nothing typed yet"* — so a picker's
 * first render is a valid request and gets the top of the catalogue.
 */
export const PantryCatalogueQueryDto = zodDto('PantryCatalogueQuery', pantryCatalogueQuerySchema);
export type PantryCatalogueQueryDto = InferDto<typeof PantryCatalogueQueryDto>;

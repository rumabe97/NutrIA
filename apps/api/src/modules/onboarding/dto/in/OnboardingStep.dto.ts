import { onboardingStepSchema } from 'core/entities/Onboarding';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * One step per request. The discriminated union means a step can only carry its
 * own fields, and each save is independently valid — which is what makes the
 * flow resumable from another device mid-way through.
 */
export const OnboardingStepDto = zodDto('OnboardingStep', onboardingStepSchema);
export type OnboardingStepDto = InferDto<typeof OnboardingStepDto>;

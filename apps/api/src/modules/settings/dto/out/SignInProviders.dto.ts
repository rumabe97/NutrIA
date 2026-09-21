import type { SocialProviderId } from '../../../auth/services/SocialProviders.js';

/**
 * Which "Continue with…" buttons the sign-in and sign-up pages may draw, in
 * the order to draw them (`0058`). Empty — the shipped default — means none.
 */
export type SignInProvidersDto = { readonly providers: readonly SocialProviderId[] };

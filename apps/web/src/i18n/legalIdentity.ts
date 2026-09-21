/**
 * Who answers for the service: the name and the address the privacy policy and
 * the terms of use must print (`0058`).
 *
 * The one tracked file that names a person, and on purpose. A privacy policy
 * that does not say who the controller is, or how to reach them, is not one —
 * and both are on a public page anyway. Everything else in this repository is
 * held to `scripts/check-leaks.sh`, which skips this file and only this file,
 * so the documents carry `{name}` and `{email}` and are filled in from here.
 */
export const LEGAL_IDENTITY = { email: 'rumabe97@gmail.com', name: 'Rubén Martínez' } as const;

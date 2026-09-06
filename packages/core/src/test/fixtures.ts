import type { Profile } from 'core/entities/Profile';
import type { User } from 'core/entities/User';

// Test fixtures (object-mother / test-data-builder pattern).
//
// Each `makeX` returns a complete, valid entity with sensible defaults. Pass
// `overrides` to set only the fields that matter to your test — the rest stay
// stable. This makes tests both DRY and more readable: `makeUser({ email: 'taken@…' })`
// signals "the email is what matters here," whereas a full literal makes every
// property look equally important.
//
// When adding a new entity to packages/core/src/entities/, add a matching factory here.

export function makeUser(overrides?: Partial<User>): User {
  return {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    ...overrides
  };
}

export function makeProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'b7e9c8d1-9f3a-4b2c-8e5d-1a2b3c4d5e6f',
    avatarUrl: undefined,
    bio: undefined,
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    username: 'ada',
    ...overrides
  };
}

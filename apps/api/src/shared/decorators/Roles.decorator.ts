import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restricts a route to the listed roles. Enforced by `AdminGuard`. */
export function Roles(...roles: readonly ('admin' | 'user')[]): ClassDecorator & MethodDecorator {
  return SetMetadata(ROLES_KEY, roles);
}

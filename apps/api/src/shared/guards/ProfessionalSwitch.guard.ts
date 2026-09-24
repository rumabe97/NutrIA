import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { ProfessionalController } from 'core/controllers/Professional';

/**
 * The `professional` switch alone, for the workspace routes an invited
 * *client* uses (`0059`): there is no grant to ask about, only whether the
 * workspace exists. Off, a 404 — the same shape as every other denial; it
 * names no person, only that the route is there, as `ProfessionalGuard` does.
 *
 * A guard because guards run before pipes: checked inside the handler, the
 * switch would come after `@ZodBody` and `@Param` pipes, and a malformed body
 * or path would answer 422 or 400 — telling anybody who asked that the route
 * is there while the switch says it is not.
 *
 * Not on a client's own link (`GET /care/links/me`, ending it): consent stays
 * revocable, and visible, whatever the switch says (PRD 004, criterion 4).
 * Read on every request, never cached, as `ProfessionalGuard` is.
 */
@Injectable()
export class ProfessionalSwitchGuard implements CanActivate {
  async canActivate(): Promise<boolean> {
    if (!(await ProfessionalController.isOpen())) {
      throw new NotFoundException();
    }

    return true;
  }
}

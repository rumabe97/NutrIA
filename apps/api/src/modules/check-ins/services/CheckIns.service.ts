import { Injectable } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';
import { CheckInController } from 'core/controllers/CheckIn';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { CheckInSubmittedService } from '../../notifications/index.js';

import type { CheckInResultDto, CheckInStatusDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';
import type { SubmitCheckInDto } from '../dto/in/index.js';

@Injectable()
export class CheckInsService {
  constructor(
    private readonly background: BackgroundTaskService,
    private readonly notifier: CheckInSubmittedService
  ) {}

  async status(userId: string): Promise<CheckInStatusDto> {
    return CheckInController.status(userId);
  }

  /**
   * Records the check-in, then — for a client with an `active` link — tells
   * their professional in the background, so a slow mail or push never delays
   * the answer (PRD 004, criterion 10). `activeProfessional` is asked *after*
   * `submit` succeeds: a duplicate submission throws before either runs, which
   * is what keeps the notice to at most one per check-in. It is null unless the
   * link opens `full` (project 025, `0111` § 4): a practitioner without the
   * badge, or whose client consented to the plan list only, is never told a
   * check-in happened — by mail or by push.
   */
  async submit(user: SessionUser, body: SubmitCheckInDto): Promise<CheckInResultDto> {
    const result = await CheckInController.submit(user.id, body);
    const professional = await CareController.activeProfessional(user.id);

    if (professional) {
      this.background.run('checkin-submitted-notify', () => this.notifier.notify(professional, user.name));
    }

    return result;
  }
}

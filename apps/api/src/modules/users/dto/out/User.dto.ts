import type { UserView } from 'core/controllers/User';

/** The signed-in account: who they are, the state of both locks (`0030`, `0031`), whether it is a professional today (`0059`), and whether to offer it the practice-opening form (PRD 025 phase 8). */
export type UserDto = UserView;

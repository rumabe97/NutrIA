import type { UserView } from 'core/controllers/User';

/** The signed-in account: who they are, the state of both locks (`0030`, `0031`), and whether it is a professional today (`0059`). */
export type UserDto = UserView;

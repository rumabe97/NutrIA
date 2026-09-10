/**
 * The switches the owner can throw while the service runs.
 *
 * One table backs all of them (`app_settings`: a key, a boolean, a timestamp),
 * and this file is the only place that says which keys exist. A switch nobody
 * has thrown has no row at all, so every flag must also say what its absence
 * means — and that is a product question, never a database one.
 *
 * The direction of the fallback is the part worth arguing about, so each entry
 * argues it. The rule behind all of them: fall back to the behaviour that is
 * safe to have on the day the settings table is empty, which is the day the
 * service is first deployed and every day a migration runs before a seed.
 */

export type FlagName = 'automaticActivation' | 'premium';

export type FlagAudience =
  /** The owner, on `/admin`, and nobody else. */
  | 'owner'
  /** Anyone with a session — the flag decides what a screen shows them. */
  | 'signed-in';

export type Flag = {
  /**
   * Who may learn its position.
   *
   * Not a secret in the security sense: a flag says nothing about any person.
   * But an operational switch is nobody's business but the owner's, and a
   * signed-in reader has no use for one. Declaring the audience per flag is
   * what stops the answer to "is registration open" from turning into a list
   * of everything the service can be told to do.
   */
  readonly audience: FlagAudience;
  /** What an absent row means. Argued per flag below. */
  readonly fallback: boolean;
  /**
   * The row's primary key.
   *
   * Never rename one. The row *is* the state: a renamed key reads as a flag
   * nobody has ever thrown, which silently restores the fallback — and the
   * fallback is the position somebody deliberately moved away from.
   */
  readonly key: string;
};

export const FLAGS: Readonly<Record<FlagName, Flag>> = {
  /**
   * Confirming the address opens the account, unless the owner says otherwise
   * (`0031`).
   *
   * Falls back to on. A service that starts holding everybody in a queue
   * because a settings row went missing is a service that fails shut for the
   * wrong reason: nobody gets in, and nothing says why. Turning it off is a
   * deliberate act and it leaves a row saying so.
   */
  automaticActivation: { audience: 'signed-in', fallback: true, key: 'automatic_activation' },

  /**
   * Whether the paid tier exists at all.
   *
   * Falls back to off, which is the opposite direction from the switch above
   * and for the opposite reason. Off, every account is on the free allowances
   * and no screen mentions paying — which is exactly the product as it was
   * before this flag existed. A missing row must never be what puts a price in
   * front of somebody or quietly raises what an account is allowed to spend.
   */
  premium: { audience: 'signed-in', fallback: false, key: 'premium' }
};

export const FLAG_NAMES = Object.keys(FLAGS) as readonly FlagName[];

export type FlagSet = Readonly<Record<FlagName, boolean>>;

/**
 * The flags, as the stored rows leave them.
 *
 * Pure on purpose: the merge of "what the table says" onto "what absence
 * means" is the whole rule, and it is worth testing without a database. Rows
 * for keys this file does not declare are ignored rather than an error — a
 * flag removed in code leaves its row behind, and a deploy that fails because
 * an old row still exists would be a deploy blocked by tidiness.
 */
export function flagsFrom(rows: readonly { readonly enabled: boolean; readonly key: string }[]): FlagSet {
  const stored = new Map(rows.map(row => [row.key, row.enabled]));

  return Object.fromEntries(FLAG_NAMES.map(name => [name, stored.get(FLAGS[name].key) ?? FLAGS[name].fallback])) as FlagSet;
}

/** The subset an audience may read. The owner reads everything. */
export function flagsFor(flags: FlagSet, audience: FlagAudience): Partial<FlagSet> {
  if (audience === 'owner') {
    return flags;
  }

  return Object.fromEntries(FLAG_NAMES.filter(name => FLAGS[name].audience === audience).map(name => [name, flags[name]]));
}

/** Every fallback, for the one caller that cannot reach the database and must still answer. */
export function fallbackFlags(): FlagSet {
  return Object.fromEntries(FLAG_NAMES.map(name => [name, FLAGS[name].fallback])) as FlagSet;
}

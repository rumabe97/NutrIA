/**
 * Puts the test process's clock inside the Madrid/UTC date gap (22:00-24:00 UTC,
 * when Madrid's date is already tomorrow's), whatever time it really is.
 *
 * Loaded only by `jest-e2e-gap.json` (`--config ./test/jest-e2e-gap.json`). It moves `Date` only in the test process, where
 * the API runs too, so product code and tests see the same clock; the database
 * keeps its own. Time still passes: only the offset is fixed, at the start.
 */
export function installClockGap(): void {
  const RealDate = Date;
  const real = new RealDate();
  const target = new RealDate(Date.UTC(real.getUTCFullYear(), real.getUTCMonth(), real.getUTCDate(), 22, 30));
  // Always forward into tonight's gap, so a plan's dates never land in the past.
  const offset = target.getTime() - real.getTime() + (target.getTime() < real.getTime() ? 24 * 60 * 60 * 1000 : 0);

  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      super(...((args.length === 0 ? [RealDate.now() + offset] : args) as [number]));
    }

    static override now(): number {
      return RealDate.now() + offset;
    }
  }

  globalThis.Date = ShiftedDate as DateConstructor;
}

/**
 * The answer to "is the process alive". Composed here, not by Terminus: it
 * touches no dependency at all, which is the whole difference between liveness
 * and readiness.
 */
export interface LivenessDto {
  readonly status: 'ok';
}
